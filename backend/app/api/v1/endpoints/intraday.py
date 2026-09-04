from __future__ import annotations

import asyncio
from datetime import datetime, timezone, time
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Query
import pandas as pd
import numpy as np

from app.services.nse.client import nse_client
from app.services.dhan.dhan_client import dhan_client
from app.services.indicators.engine import enrich_dataframe, latest_signals

router = APIRouter()


class IntradayLevels(BaseModel):
    entry: float
    stop_loss: float
    target_1: float
    target_2: float
    risk_reward: str


class IntradayStockItem(BaseModel):
    symbol: str
    company_name: str
    last_price: float
    change_pct: float
    day_high: float
    day_low: float
    day_open: float
    vwap: float
    dist_from_vwap_pct: float
    vwap_signal: str            # "ABOVE", "BELOW", "AT_VWAP"
    volume: int
    volume_ratio: float
    rsi: float
    supertrend_bull: bool
    ema20: float
    ema50: float
    setup_category: str        # "VWAP_BULLISH", "VOLUME_SURGE", "ORB_BREAKOUT", "MOMENTUM_RSI", "SUPPORT_BOUNCE", "SHORT_WATCH"
    intraday_score: float
    confluence_tags: List[str]
    levels: IntradayLevels


class IntradayScanResponse(BaseModel):
    index: str
    timeframe: str
    scanned: int
    matched: int
    summary: dict[str, int]
    results: List[IntradayStockItem]


class IntradayOverviewResponse(BaseModel):
    market_sentiment: str
    session_status: str
    advances: int
    declines: int
    top_gainers: List[dict[str, Any]]
    top_losers: List[dict[str, Any]]
    timestamp: str


def _check_market_hours() -> str:
    """Returns 'OPEN', 'PRE_OPEN', or 'CLOSED' in IST."""
    now_utc = datetime.now(timezone.utc)
    # Convert UTC to IST (+5:30)
    ist_hour = (now_utc.hour + 5 + (now_utc.minute + 30) // 60) % 24
    ist_minute = (now_utc.minute + 30) % 60
    current_ist_time = time(ist_hour, ist_minute)

    weekday = now_utc.weekday()
    if weekday in (5, 6):  # Saturday or Sunday
        return "WEEKEND_CLOSED"

    if time(9, 0) <= current_ist_time < time(9, 15):
        return "PRE_OPEN"
    elif time(9, 15) <= current_ist_time <= time(15, 30):
        return "LIVE_OPEN"
    else:
        return "MARKET_CLOSED"


@router.get("/overview", response_model=IntradayOverviewResponse)
async def get_intraday_overview(index: str = Query("NIFTY 50")) -> IntradayOverviewResponse:
    """
    Returns market pulse, advance/decline count, live gainers/losers, and session state.
    """
    movers = await nse_client.get_market_movers(index)
    gainers = movers.get("gainers", [])
    losers = movers.get("losers", [])

    adv = len([g for g in gainers if g.get("change_pct", 0) > 0])
    dec = len([l for l in losers if l.get("change_pct", 0) < 0])

    if adv > dec * 1.5:
        sentiment = "STRONG_BULLISH"
    elif adv > dec:
        sentiment = "MODERATE_BULLISH"
    elif dec > adv * 1.5:
        sentiment = "STRONG_BEARISH"
    elif dec > adv:
        sentiment = "MODERATE_BEARISH"
    else:
        sentiment = "NEUTRAL"

    return IntradayOverviewResponse(
        market_sentiment=sentiment,
        session_status=_check_market_hours(),
        advances=adv,
        declines=dec,
        top_gainers=gainers[:6],
        top_losers=losers[:6],
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


def _process_intraday_stock(
    symbol: str, company: str, df: pd.DataFrame
) -> IntradayStockItem | None:
    if df is None or len(df) < 15:
        return None

    try:
        enriched = enrich_dataframe(df)
        signals = latest_signals(df)
        last = enriched.iloc[-1]
        prev = enriched.iloc[-2] if len(enriched) > 1 else last

        last_price = round(float(last["close"]), 2)
        day_high = round(float(df["high"].max()), 2)
        day_low = round(float(df["low"].min()), 2)
        day_open = round(float(df["open"].iloc[0]), 2)
        change_pct = round(((last_price - day_open) / day_open) * 100, 2) if day_open > 0 else 0.0

        # VWAP metrics
        vwap_val = round(float(last.get("vwap", last_price)), 2)
        dist_vwap_pct = round(((last_price - vwap_val) / vwap_val) * 100, 2) if vwap_val > 0 else 0.0
        if dist_vwap_pct > 0.3:
            vwap_signal = "ABOVE"
        elif dist_vwap_pct < -0.3:
            vwap_signal = "BELOW"
        else:
            vwap_signal = "AT_VWAP"

        # Volume ratio
        vol = int(last["volume"])
        vol_sma = float(last.get("vol_sma20", vol))
        vol_ratio = round(vol / vol_sma, 2) if vol_sma > 0 else 1.0

        # RSI & EMAs
        rsi_val = round(float(last.get("rsi", 50.0)), 1)
        st_bull = bool(signals.get("supertrend_bull", False))
        ema20_val = round(float(last.get("ema20", last_price)), 2)
        ema50_val = round(float(last.get("ema50", last_price)), 2)
        atr_val = round(float(last.get("atr", last_price * 0.01)), 2)

        # Tags and scoring
        tags: list[str] = []
        score = 50.0

        if vwap_signal == "ABOVE":
            tags.append("Above VWAP")
            score += 12
        elif vwap_signal == "BELOW":
            tags.append("Below VWAP")
            score -= 10

        if vol_ratio >= 2.0:
            tags.append(f"Vol Surge {vol_ratio}x")
            score += 15
        elif vol_ratio >= 1.4:
            tags.append(f"Vol Rise {vol_ratio}x")
            score += 8

        if st_bull:
            tags.append("Supertrend Bull")
            score += 10

        if signals.get("macd_bullish_cross"):
            tags.append("MACD Bull Cross")
            score += 10

        if 55 <= rsi_val <= 68:
            tags.append(f"RSI Bull {rsi_val}")
            score += 8
        elif rsi_val > 75:
            tags.append(f"RSI Overbought {rsi_val}")
            score -= 4
        elif rsi_val < 35:
            tags.append(f"RSI Oversold {rsi_val}")

        if last_price >= day_high * 0.995:
            tags.append("At Day High")
            score += 10
        elif last_price <= day_low * 1.005:
            tags.append("At Day Low")
            score -= 8

        if signals.get("swing_high_breakout") or signals.get("resistance_breakout"):
            tags.append("Breakout Alert")
            score += 12

        # Setup categorization
        if vol_ratio >= 1.8 and last_price > vwap_val:
            setup_category = "VOLUME_SURGE"
        elif vwap_signal == "ABOVE" and 0 <= dist_vwap_pct <= 1.5:
            setup_category = "VWAP_BULLISH"
        elif "Breakout Alert" in tags or "At Day High" in tags:
            setup_category = "ORB_BREAKOUT"
        elif 58 <= rsi_val <= 72 and st_bull:
            setup_category = "MOMENTUM_RSI"
        elif vwap_signal == "BELOW" and not st_bull and rsi_val < 45:
            setup_category = "SHORT_WATCH"
        else:
            setup_category = "SUPPORT_BOUNCE" if last_price > ema20_val else "SHORT_WATCH"

        final_score = round(max(5.0, min(98.0, score)), 1)

        # Dynamic trade levels based on ATR
        if setup_category in ("SHORT_WATCH"):
            entry = last_price
            stop_loss = round(entry + (atr_val * 1.2), 2)
            target_1 = round(entry - (atr_val * 1.8), 2)
            target_2 = round(entry - (atr_val * 2.8), 2)
            rr = "1:1.5"
        else:
            entry = last_price
            stop_loss = round(max(0.1, entry - (atr_val * 1.2)), 2)
            target_1 = round(entry + (atr_val * 1.8), 2)
            target_2 = round(entry + (atr_val * 3.0), 2)
            rr = "1:2"

        levels = IntradayLevels(
            entry=entry,
            stop_loss=stop_loss,
            target_1=target_1,
            target_2=target_2,
            risk_reward=rr,
        )

        return IntradayStockItem(
            symbol=symbol,
            company_name=company,
            last_price=last_price,
            change_pct=change_pct,
            day_high=day_high,
            day_low=day_low,
            day_open=day_open,
            vwap=vwap_val,
            dist_from_vwap_pct=dist_vwap_pct,
            vwap_signal=vwap_signal,
            volume=vol,
            volume_ratio=vol_ratio,
            rsi=rsi_val,
            supertrend_bull=st_bull,
            ema20=ema20_val,
            ema50=ema50_val,
            setup_category=setup_category,
            intraday_score=final_score,
            confluence_tags=tags,
            levels=levels,
        )
    except Exception:
        return None


@router.get("/scan", response_model=IntradayScanResponse)
async def scan_intraday_opportunities(
    index: str = Query("NIFTY 50", description="Universe: NIFTY 50, NIFTY 100, NIFTY 500, LIQUID"),
    timeframe: str = Query("15m", description="Timeframe: 5m, 15m, 30m, 1h"),
    strategy: Optional[str] = Query("ALL", description="ALL, VWAP_BULLISH, VOLUME_SURGE, ORB_BREAKOUT, MOMENTUM_RSI, SUPPORT_BOUNCE, SHORT_WATCH"),
    search: Optional[str] = Query(None),
) -> IntradayScanResponse:
    """
    Intraday live scanner computing VWAP, Volume Burst, Momentum, and Trade Levels.
    """
    # Fetch symbols for the universe
    try:
        symbols = await nse_client.get_index_symbols(index)
    except Exception:
        symbols = []

    if not symbols:
        symbols = [
            "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN",
            "BHARTIARTL", "LT", "TITAN", "MARUTI", "BAJFINANCE", "TATAMOTORS",
            "SUNPHARMA", "AXISBANK", "WIPRO", "HCLTECH", "KOTAKBANK", "NTPC",
        ]

    # Limit scan targets for snappy response (top 35)
    scan_targets = symbols[:35]
    if search:
        s_query = search.strip().upper()
        scan_targets = [s for s in scan_targets if s_query in s.upper()] or [s_query]

    sem = asyncio.Semaphore(15)

    async def scan_single(sym: str) -> IntradayStockItem | None:
        async with sem:
            try:
                df = await nse_client.fetch_ohlc(sym, timeframe=timeframe, limit=60)
                return _process_intraday_stock(sym, sym, df)
            except Exception:
                return None

    tasks = [scan_single(s) for s in scan_targets]
    results_raw = await asyncio.gather(*tasks)
    items: list[IntradayStockItem] = [r for r in results_raw if r is not None]

    # Filter by strategy
    if strategy and strategy != "ALL":
        items = [item for item in items if item.setup_category == strategy]

    # Sort descending by intraday score
    items.sort(key=lambda x: x.intraday_score, reverse=True)

    # Summary counts
    summary = {
        "VWAP_BULLISH": sum(1 for i in items if i.setup_category == "VWAP_BULLISH"),
        "VOLUME_SURGE": sum(1 for i in items if i.setup_category == "VOLUME_SURGE"),
        "ORB_BREAKOUT": sum(1 for i in items if i.setup_category == "ORB_BREAKOUT"),
        "MOMENTUM_RSI": sum(1 for i in items if i.setup_category == "MOMENTUM_RSI"),
        "SUPPORT_BOUNCE": sum(1 for i in items if i.setup_category == "SUPPORT_BOUNCE"),
        "SHORT_WATCH": sum(1 for i in items if i.setup_category == "SHORT_WATCH"),
    }

    return IntradayScanResponse(
        index=index,
        timeframe=timeframe,
        scanned=len(scan_targets),
        matched=len(items),
        summary=summary,
        results=items,
    )
