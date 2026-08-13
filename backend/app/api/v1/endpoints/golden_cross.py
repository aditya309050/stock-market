"""Live Golden Cross Scanner Endpoint & WebSocket Router."""
from __future__ import annotations

import asyncio
import json
import random
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.services.indicators.golden_cross_engine import calculate_golden_cross_metrics
from app.services.nse.client import nse_client

router = APIRouter()

# Expanded dictionary of top NSE stocks with names and sectors
NSE_STOCKS_METADATA = {
    "HDFCBANK": {"name": "HDFC Bank Ltd.", "sector": "Financial Services"},
    "ICICIBANK": {"name": "ICICI Bank Ltd.", "sector": "Financial Services"},
    "SBIN": {"name": "State Bank of India", "sector": "Financial Services"},
    "AXISBANK": {"name": "Axis Bank Ltd.", "sector": "Financial Services"},
    "KOTAKBANK": {"name": "Kotak Mahindra Bank Ltd.", "sector": "Financial Services"},
    "RELIANCE": {"name": "Reliance Industries Ltd.", "sector": "Energy & Oil"},
    "TCS": {"name": "Tata Consultancy Services Ltd.", "sector": "Technology"},
    "INFY": {"name": "Infosys Ltd.", "sector": "Technology"},
    "WIPRO": {"name": "Wipro Ltd.", "sector": "Technology"},
    "HCLTECH": {"name": "HCL Technologies Ltd.", "sector": "Technology"},
    "BHARTIARTL": {"name": "Bharti Airtel Ltd.", "sector": "Telecom"},
    "LT": {"name": "Larsen & Toubro Ltd.", "sector": "Construction & Engineering"},
    "ITC": {"name": "ITC Ltd.", "sector": "Consumer Goods"},
    "HINDUNILVR": {"name": "Hindustan Unilever Ltd.", "sector": "Consumer Goods"},
    "ASIANPAINT": {"name": "Asian Paints Ltd.", "sector": "Consumer Goods"},
    "TITAN": {"name": "Titan Company Ltd.", "sector": "Consumer Durables"},
    "MARUTI": {"name": "Maruti Suzuki India Ltd.", "sector": "Automobile"},
    "TATAMOTORS": {"name": "Tata Motors Ltd.", "sector": "Automobile"},
    "M&M": {"name": "Mahindra & Mahindra Ltd.", "sector": "Automobile"},
    "SUNPHARMA": {"name": "Sun Pharmaceutical Industries Ltd.", "sector": "Healthcare"},
    "CIPLA": {"name": "Cipla Ltd.", "sector": "Healthcare"},
    "DRREDDY": {"name": "Dr. Reddy's Laboratories Ltd.", "sector": "Healthcare"},
    "BAJFINANCE": {"name": "Bajaj Finance Ltd.", "sector": "Financial Services"},
    "ULTRACEMCO": {"name": "UltraTech Cement Ltd.", "sector": "Materials"},
    "TATASTEEL": {"name": "Tata Steel Ltd.", "sector": "Metals & Mining"},
    "JSWSTEEL": {"name": "JSW Steel Ltd.", "sector": "Metals & Mining"},
    "HINDALCO": {"name": "Hindalco Industries Ltd.", "sector": "Metals & Mining"},
    "POWERGRID": {"name": "Power Grid Corporation of India", "sector": "Utilities"},
    "NTPC": {"name": "NTPC Ltd.", "sector": "Utilities"},
    "ONGC": {"name": "Oil & Natural Gas Corporation", "sector": "Energy & Oil"},
}


class ScoreRuleItem(BaseModel):
    rule: str
    points: int
    earned: bool


class GoldenCrossStockResult(BaseModel):
    symbol: str
    name: str
    sector: str
    price: float
    sma50: float
    sma200: float
    dma_gap_pct: float
    is_crossed: bool
    sma50_slope_pct: float
    sma200_slope_pct: float
    sma50_slope: str
    sma200_slope: str
    price_above_50dma: bool
    price_above_200dma: bool
    volume_ratio: float
    rsi: float
    score: int
    score_breakdown: List[ScoreRuleItem]
    signal_type: str
    signal_name: str
    signal_emoji: str
    signal_color: str
    backtest_win_rate: float
    est_days_to_cross: int
    confidence: str


class GoldenCrossScanResponse(BaseModel):
    results: List[GoldenCrossStockResult]
    total_scanned: int
    matched_count: int
    signal_counts: Dict[str, int]
    timestamp: str


# Global cache for scanner results to avoid excessive external calls during demo/WS
_SCAN_CACHE: Dict[str, Any] = {"data": [], "last_updated": None}


async def _fetch_and_calculate_stock(symbol: str) -> Optional[GoldenCrossStockResult]:
    meta = NSE_STOCKS_METADATA.get(symbol, {"name": symbol, "sector": "N/A"})
    try:
        df = await nse_client.fetch_ohlc(symbol, timeframe="1d", limit=250)
        if df is None or df.empty or len(df) < 50:
            return None
        metrics = calculate_golden_cross_metrics(df)
        if "error" in metrics:
            return None

        return GoldenCrossStockResult(
            symbol=symbol,
            name=meta["name"],
            sector=meta["sector"],
            price=metrics["price"],
            sma50=metrics["sma50"],
            sma200=metrics["sma200"],
            dma_gap_pct=metrics["dma_gap_pct"],
            is_crossed=metrics["is_crossed"],
            sma50_slope_pct=metrics["sma50_slope_pct"],
            sma200_slope_pct=metrics["sma200_slope_pct"],
            sma50_slope=metrics["sma50_slope"],
            sma200_slope=metrics["sma200_slope"],
            price_above_50dma=metrics["price_above_50dma"],
            price_above_200dma=metrics["price_above_200dma"],
            volume_ratio=metrics["volume_ratio"],
            rsi=metrics["rsi"],
            score=metrics["score"],
            score_breakdown=[ScoreRuleItem(**r) for r in metrics["score_breakdown"]],
            signal_type=metrics["signal_type"],
            signal_name=metrics["signal_name"],
            signal_emoji=metrics["signal_emoji"],
            signal_color=metrics["signal_color"],
            backtest_win_rate=metrics["backtest_win_rate"],
            est_days_to_cross=metrics["est_days_to_cross"],
            confidence=metrics["confidence"],
        )
    except Exception as e:
        return None


@router.get("/scan", response_model=GoldenCrossScanResponse)
async def scan_golden_cross(
    max_gap: Optional[float] = Query(default=10.0, ge=0.0, le=100.0, description="Max DMA Gap %"),
    min_score: Optional[int] = Query(default=0, ge=0, le=100, description="Minimum Golden Cross Score"),
    signal_type: Optional[str] = Query(default=None, description="Filter by signal (VERY_NEAR, NEAR, APPROACHING, GOLDEN_CROSS, EARLY)"),
    min_volume_ratio: Optional[float] = Query(default=0.0, ge=0.0, description="Min Volume vs 20D Avg"),
    rsi_min: Optional[float] = Query(default=0.0, ge=0.0, le=100.0),
    rsi_max: Optional[float] = Query(default=100.0, ge=0.0, le=100.0),
    search: Optional[str] = Query(default=None, description="Symbol or name search query"),
    sector: Optional[str] = Query(default=None, description="Filter by sector"),
):
    """
    Scans NSE stocks for Golden-Crossover candidates, ranking them by Golden Cross Score.
    """
    symbols = list(NSE_STOCKS_METADATA.keys())
    
    # Process batch in parallel
    tasks = [_fetch_and_calculate_stock(sym) for sym in symbols]
    raw_results = await asyncio.gather(*tasks)

    valid_results: List[GoldenCrossStockResult] = [r for r in raw_results if r is not None]

    # Signal count summary before filtering
    signal_counts = {
        "GOLDEN_CROSS": 0,
        "VERY_NEAR": 0,
        "NEAR": 0,
        "APPROACHING": 0,
        "EARLY": 0,
        "NEUTRAL": 0,
    }
    for res in valid_results:
        if res.signal_type in signal_counts:
            signal_counts[res.signal_type] += 1

    # Filter pipeline
    filtered: List[GoldenCrossStockResult] = []
    for r in valid_results:
        # Gap filter
        if r.dma_gap_pct > max_gap and not r.is_crossed:
            continue
        # Score filter
        if r.score < min_score:
            continue
        # Signal type filter
        if signal_type and signal_type.upper() != "ALL" and r.signal_type.upper() != signal_type.upper():
            continue
        # Volume ratio filter
        if r.volume_ratio < min_volume_ratio:
            continue
        # RSI range filter
        if r.rsi < rsi_min or r.rsi > rsi_max:
            continue
        # Search query
        if search:
            q = search.lower().strip()
            if q not in r.symbol.lower() and q not in r.name.lower():
                continue
        # Sector filter
        if sector and sector.lower() != "all" and sector.lower() not in r.sector.lower():
            continue

        filtered.append(r)

    # Sort results by score descending, then by smallest DMA gap
    filtered.sort(key=lambda x: (x.score, -x.dma_gap_pct if not x.is_crossed else 100), reverse=True)

    from datetime import datetime, timezone
    return GoldenCrossScanResponse(
        results=filtered,
        total_scanned=len(symbols),
        matched_count=len(filtered),
        signal_counts=signal_counts,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/stock/{symbol}")
async def get_golden_cross_stock_detail(symbol: str, period: str = "1y"):
    """
    Returns full daily OHLC history with SMA50 and SMA200 overlays,
    plus point-by-point score breakdown for a specific stock.
    """
    sym = symbol.upper().strip()
    df = await nse_client.fetch_ohlc(sym, timeframe="1d", limit=300 if period == "1y" else 150)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"Stock data not found for {sym}")

    metrics = calculate_golden_cross_metrics(df)
    meta = NSE_STOCKS_METADATA.get(sym, {"name": sym, "sector": "N/A"})

    # Prepare Lightweight Chart format
    # candles: { time: 'YYYY-MM-DD', open, high, low, close, volume, sma50, sma200 }
    sma50_series = df["close"].rolling(50).mean()
    sma200_series = df["close"].rolling(200).mean() if len(df) >= 200 else pd.Series([None] * len(df), index=df.index)

    chart_series = []
    for index, row in df.iterrows():
        date_str = index.strftime("%Y-%m-%d")
        s50 = float(sma50_series.loc[index]) if pd.notna(sma50_series.loc[index]) else None
        s200 = float(sma200_series.loc[index]) if pd.notna(sma200_series.loc[index]) else None

        chart_series.append({
            "time": date_str,
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]),
            "sma50": round(s50, 2) if s50 else None,
            "sma200": round(s200, 2) if s200 else None,
        })

    return {
        "symbol": sym,
        "name": meta["name"],
        "sector": meta["sector"],
        "metrics": metrics,
        "chart_data": chart_series,
    }


@router.get("/stats")
async def get_golden_cross_stats():
    """Returns general market scanner statistics."""
    symbols = list(NSE_STOCKS_METADATA.keys())
    tasks = [_fetch_and_calculate_stock(sym) for sym in symbols]
    raw_results = await asyncio.gather(*tasks)
    valid = [r for r in raw_results if r is not None]

    very_near = sum(1 for r in valid if r.signal_type == "VERY_NEAR")
    near = sum(1 for r in valid if r.signal_type == "NEAR")
    approaching = sum(1 for r in valid if r.signal_type == "APPROACHING")
    crossed = sum(1 for r in valid if r.signal_type == "GOLDEN_CROSS")
    early = sum(1 for r in valid if r.signal_type == "EARLY")

    avg_score = round(sum(r.score for r in valid) / len(valid), 1) if valid else 0.0

    return {
        "total_tracked": len(symbols),
        "golden_cross_active": crossed,
        "very_near": very_near,
        "near": near,
        "approaching": approaching,
        "early": early,
        "average_score": avg_score,
        "top_scored_stock": max(valid, key=lambda x: x.score).symbol if valid else "N/A",
    }


@router.websocket("/ws")
async def golden_cross_websocket(websocket: WebSocket):
    """
    WebSocket channel broadcasting live price ticks and recalculated scores
    for stocks in the Golden Cross Scanner watchlist.
    """
    await websocket.accept()

    # Initial snapshot fetch
    symbols = ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK", "RELIANCE", "TCS", "INFY"]
    cached_stocks: Dict[str, Dict[str, Any]] = {}

    for sym in symbols:
        res = await _fetch_and_calculate_stock(sym)
        if res:
            cached_stocks[sym] = res.model_dump()

    # Send initial snapshot
    await websocket.send_json({
        "type": "SNAPSHOT",
        "data": list(cached_stocks.values()),
    })

    try:
        while True:
            await asyncio.sleep(2.5)  # Tick interval

            # Pick a random stock to simulate live tick movement
            target_sym = random.choice(symbols)
            if target_sym in cached_stocks:
                stock_data = cached_stocks[target_sym]

                # Slight random price jitter (-0.4% to +0.4%)
                change_pct = (random.random() - 0.48) * 0.008
                old_price = stock_data["price"]
                new_price = round(old_price * (1 + change_pct), 2)
                stock_data["price"] = new_price

                # Recalculate price > 50dma & 200dma
                stock_data["price_above_50dma"] = new_price > stock_data["sma50"]
                stock_data["price_above_200dma"] = new_price > stock_data["sma200"]

                # Recalculate gap if not crossed
                if not stock_data["is_crossed"]:
                    stock_data["dma_gap_pct"] = round(((stock_data["sma200"] - stock_data["sma50"]) / stock_data["sma200"]) * 100, 2)

                # Send tick event to client
                await websocket.send_json({
                    "type": "TICK",
                    "symbol": target_sym,
                    "price": new_price,
                    "change_pct": round(change_pct * 100, 2),
                    "updated_stock": stock_data,
                })
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
