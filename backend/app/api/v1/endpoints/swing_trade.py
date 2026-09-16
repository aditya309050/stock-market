from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from fastapi import APIRouter, Query

from app.schemas.swing_trade import SwingTradeItem, SwingTradeScanResponse
from app.services.indicators.swing_engine import calculate_swing_metrics
from app.services.nse.client import nse_client

router = APIRouter()

# In-memory scan cache: key -> (timestamp, response)
_scan_cache: dict[str, tuple[datetime, SwingTradeScanResponse]] = {}
CACHE_TTL_SECONDS = 90


def _clean_symbol(sym: str) -> str:
    s = sym.upper().strip().split("-")[0].replace(".NS", "")
    return s


@router.get("/scan", response_model=SwingTradeScanResponse)
async def run_swing_trade_scan(
    universe: str = Query("NIFTY 500", description="'NSE ALL', 'NIFTY 500', 'NIFTY 200', 'NIFTY 100', 'NIFTY 50', 'LIQUID'"),
    timeframe: str = Query("15m", description="'5m', '15m', '30m', '1h', '1d'"),
    min_score: float = Query(0.0, ge=0.0, le=100.0),
    symbol: Optional[str] = Query(None, description="Scan a single stock symbol"),
    search: Optional[str] = Query(None, description="Search symbol or keyword"),
    refresh: bool = Query(False, description="Force refresh cache"),
) -> SwingTradeScanResponse:
    """
    Scans selected universe using live tick/candle feed for Swing High/Low structure, HH+HL trends,
    support/resistance levels, volume ratio, and multi-timeframe swing scores.
    Uses concurrency and smart caching for fast (<5s) response times.
    """
    try:
        min_score_val = float(min_score)
    except Exception:
        min_score_val = 0.0

    universe_key = universe.strip().upper()
    timeframe_key = timeframe.strip()
    sym_query = symbol.strip().upper() if symbol and not hasattr(symbol, "default") and str(symbol).strip() else None
    search_query = search.strip().upper() if search and not hasattr(search, "default") and str(search).strip() else None

    # Check cache when running standard universe scan (without specific search)
    cache_key = f"{universe_key}:{timeframe_key}:{min_score_val}"
    now = datetime.now(timezone.utc)
    if not refresh and not sym_query and not search_query and cache_key in _scan_cache:
        cached_time, cached_resp = _scan_cache[cache_key]
        if (now - cached_time).total_seconds() < CACHE_TTL_SECONDS:
            return cached_resp

    # Determine list of target symbols
    target_symbols: list[str] = []

    if sym_query:
        target_symbols = [_clean_symbol(sym_query)]
    elif search_query:
        # User searched for a specific symbol or prefix
        clean_q = _clean_symbol(search_query)
        try:
            all_symbols = await nse_client.get_index_symbols(universe)
        except Exception:
            all_symbols = []
        matched = [s for s in all_symbols if clean_q in s.upper()]
        if not matched:
            matched = [clean_q]
        target_symbols = matched[:20]
    else:
        # Standard universe scan: take top active liquid names
        try:
            symbols = await nse_client.get_index_symbols(universe)
        except Exception:
            symbols = []

        if not symbols:
            symbols = [
                "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN",
                "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK", "MARUTI", "TITAN",
                "SUNPHARMA", "BAJFINANCE", "TATAMOTORS", "TATASTEEL", "NTPC",
                "BEL", "HAL", "ZOMATO", "COALINDIA", "ONGC", "JSWSTEEL", "TECHM",
            ]

        # Scan top 35 symbols for snappy response time (< 5 seconds)
        target_symbols = [_clean_symbol(s) for s in symbols if s and len(s) >= 2][:35]

    # Concurrently process symbols with bounded semaphore
    sem = asyncio.Semaphore(15)

    async def process_one(sym: str) -> SwingTradeItem | None:
        if not sym or len(sym) < 2:
            return None
        async with sem:
            try:
                # Fetch OHLC candles for the actual requested timeframe
                df = await nse_client.fetch_ohlc(sym, timeframe=timeframe_key, limit=80)
                if df is None or df.empty or len(df) < 15:
                    return None

                metrics = calculate_swing_metrics(df, symbol=sym, timeframe=timeframe_key)
                if not metrics or metrics.swing_score < min_score_val:
                    return None

                return SwingTradeItem(
                    symbol=sym,
                    timeframe=timeframe_key,
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

    tasks = [process_one(s) for s in target_symbols]
    raw_results = await asyncio.gather(*tasks)
    valid_results = [r for r in raw_results if r is not None]

    # Sort results by swing score descending
    valid_results.sort(key=lambda x: -x.swing_score)

    breakouts = [r for r in valid_results if r.setup_category == "BREAKOUT"]
    pullbacks = [r for r in valid_results if r.setup_category == "PULLBACK"]
    near_res = [r for r in valid_results if r.setup_category == "NEAR RESISTANCE"]

    response = SwingTradeScanResponse(
        scanned=len(target_symbols),
        matched=len(valid_results),
        breakout_candidates=breakouts,
        pullback_setups=pullbacks,
        near_resistance=near_res,
        results=valid_results[:30],
    )

    # Cache standard universe scan results
    if not sym_query and not search_query:
        _scan_cache[cache_key] = (now, response)

    return response
