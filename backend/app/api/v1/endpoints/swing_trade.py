from __future__ import annotations

import asyncio
from typing import Any
from fastapi import APIRouter, Query

from app.schemas.swing_trade import SwingTradeItem, SwingTradeScanResponse
from app.services.dhan.dhan_client import dhan_client
from app.services.indicators.swing_engine import calculate_swing_metrics
from app.services.nse.client import nse_client

router = APIRouter()


@router.get("/scan", response_model=SwingTradeScanResponse)
async def run_swing_trade_scan(
    universe: str = Query("NIFTY 500", description="'NSE ALL', 'NIFTY 500', 'NIFTY 200', 'NIFTY 100', 'LIQUID'"),
    timeframe: str = Query("15m", description="'5m', '15m', '30m', '1h', '1d'"),
    min_score: float = Query(0.0, ge=0.0, le=100.0),
    symbol: str | None = Query(None, description="Scan a single stock symbol"),
) -> SwingTradeScanResponse:

    """
    Scans selected universe using live tick/candle feed for Swing High/Low structure, HH+HL trends,
    support/resistance levels, volume ratio, and multi-timeframe swing scores.
    """
    try:
        min_score_val = float(min_score)
    except Exception:
        min_score_val = 0.0

    sym_str = str(symbol) if symbol and not hasattr(symbol, 'default') else None
    scrip_list: list[dict[str, Any]] = []

    if sym_str:
        scrip_list = [{"symbol": sym_str.upper()}]
    elif universe.upper() in ["NSE ALL", "ALL"]:
        try:
            scrip_list = await dhan_client.fetch_scrip_master()
        except Exception:
            pass
    else:
        try:
            symbols = await nse_client.get_index_symbols(universe)
            if len(symbols) > 25:
                scrip_list = [{"symbol": s} for s in symbols]
            else:
                scrip_list = await dhan_client.fetch_scrip_master()
        except Exception:
            pass

    if not scrip_list:
        try:
            scrip_list = await dhan_client.fetch_scrip_master()
        except Exception:
            symbols = await nse_client.get_index_symbols("NIFTY 500")
            scrip_list = [{"symbol": s} for s in symbols]

    # Concurrently process target pool
    sem = asyncio.Semaphore(35)
    target_pool = scrip_list[:1000]

    async def process_one(item: dict[str, Any]) -> SwingTradeItem | None:
        sym = item.get("symbol", "")
        if not sym:
            return None
        async with sem:
            try:
                df = await dhan_client.fetch_historical_daily(sym, limit=120)
                if df.empty or len(df) < 30:
                    return None

                metrics = calculate_swing_metrics(df, symbol=sym, timeframe=timeframe)
                if not metrics or metrics.swing_score < min_score_val:
                    return None


                return SwingTradeItem(
                    symbol=sym,
                    timeframe=timeframe,
                    last_price=metrics.last_price,
                    volume=metrics.volume,
                    volume_ratio=metrics.volume_ratio,
                    trend=metrics.trend,
                    structure=metrics.structure,
                    swing_score=metrics.swing_score,
                    setup_category=metrics.setup_category,
                    rsi=metrics.rsi,
                    ema20=metrics.ema20,
                    ema50=metrics.ema50,
                    ema200=metrics.ema200,
                    nearest_resistance=metrics.nearest_resistance,
                    nearest_support=metrics.nearest_support,
                    dist_resistance_pct=metrics.dist_resistance_pct,
                    dist_support_pct=metrics.dist_support_pct,
                    is_breakout=metrics.is_breakout,
                    is_hh_hl=metrics.is_hh_hl,
                    tags=metrics.tags,
                )
            except Exception:
                return None

    tasks = [process_one(s) for s in target_pool]
    raw_results = await asyncio.gather(*tasks)
    valid_results = [r for r in raw_results if r is not None]

    # Sort results by swing score descending
    valid_results.sort(key=lambda x: -x.swing_score)

    breakouts = [r for r in valid_results if r.setup_category == "BREAKOUT"]
    pullbacks = [r for r in valid_results if r.setup_category == "PULLBACK"]
    near_res = [r for r in valid_results if r.setup_category == "NEAR RESISTANCE"]

    return SwingTradeScanResponse(
        scanned=len(target_pool),
        matched=len(valid_results),
        breakout_candidates=breakouts,
        pullback_setups=pullbacks,
        near_resistance=near_res,
        results=valid_results[:30],
    )
