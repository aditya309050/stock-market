from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import asyncio
import pandas as pd
import numpy as np

from app.services.nse.client import nse_client
from app.services.indicators.dma_engine import calculate_dma_metrics, DMAMetrics
from app.services.indicators.sr_engine import calculate_sr_analysis, SRAnalysisResult

router = APIRouter()


class SRLevelSchema(BaseModel):
    level_type: str
    label: str
    price: float
    zone_low: float
    zone_high: float
    distance_pct: float
    strength: float
    test_count: int
    reasons: List[str]


class VolumeProfileSchema(BaseModel):
    poc: float
    vah: float
    val: float


class DMAMetricsSchema(BaseModel):
    symbol: str
    last_price: float
    dma20: float
    dma50: float
    dma200: float
    prev_dma50: float
    prev_dma200: float
    gap_pct: float
    dist_50_pct: float
    dist_200_pct: float
    dma50_slope: float
    dma50_slope_trend: str
    dma200_slope: float
    dma200_slope_trend: str
    rsi: float
    volume_mult: float
    is_golden_cross: bool
    is_crossed_today: bool
    is_recent_cross: bool
    is_established_cross: bool
    is_near_cross: bool
    is_above_200: bool
    is_above_50: bool
    status: str
    cross_category: str
    setup_category: str
    score: float


class DMAScanItem(BaseModel):
    symbol: str
    price: float
    dma50: float
    dma200: float
    dist_50_pct: float
    dist_200_pct: float
    dma50_slope_trend: str
    rsi: float
    volume_mult: float
    setup_category: str
    score: float
    is_golden_cross: bool
    nearest_support: Optional[SRLevelSchema] = None
    nearest_resistance: Optional[SRLevelSchema] = None
    confluence_tags: List[str]


class DMAScanResponse(BaseModel):
    index: str
    scanned: int
    matched: int
    results: List[DMAScanItem]


class StockDetailResponse(BaseModel):
    symbol: str
    price: float
    dma_metrics: DMAMetricsSchema
    supports: List[SRLevelSchema]
    resistances: List[SRLevelSchema]
    volume_profile: VolumeProfileSchema
    confluence_tags: List[str]
    chart_data: List[Dict[str, Any]]


def _process_single_stock_scan(symbol: str, df: pd.DataFrame) -> DMAScanItem | None:
    if df is None or len(df) < 50:
        return None

    dma_m = calculate_dma_metrics(df, symbol)
    if not dma_m:
        return None

    sr_res = calculate_sr_analysis(df, dma_m.last_price, dma_m.dma50, dma_m.dma200)

    ns_schema = (
        SRLevelSchema(
            level_type=sr_res.nearest_support.level_type,
            label=sr_res.nearest_support.label,
            price=sr_res.nearest_support.price,
            zone_low=sr_res.nearest_support.zone_low,
            zone_high=sr_res.nearest_support.zone_high,
            distance_pct=sr_res.nearest_support.distance_pct,
            strength=sr_res.nearest_support.strength,
            test_count=sr_res.nearest_support.test_count,
            reasons=sr_res.nearest_support.reasons,
        )
        if sr_res.nearest_support
        else None
    )

    nr_schema = (
        SRLevelSchema(
            level_type=sr_res.nearest_resistance.level_type,
            label=sr_res.nearest_resistance.label,
            price=sr_res.nearest_resistance.price,
            zone_low=sr_res.nearest_resistance.zone_low,
            zone_high=sr_res.nearest_resistance.zone_high,
            distance_pct=sr_res.nearest_resistance.distance_pct,
            strength=sr_res.nearest_resistance.strength,
            test_count=sr_res.nearest_resistance.test_count,
            reasons=sr_res.nearest_resistance.reasons,
        )
        if sr_res.nearest_resistance
        else None
    )

    return DMAScanItem(
        symbol=symbol,
        price=dma_m.last_price,
        dma50=dma_m.dma50,
        dma200=dma_m.dma200,
        dist_50_pct=dma_m.dist_50_pct,
        dist_200_pct=dma_m.dist_200_pct,
        dma50_slope_trend=dma_m.dma50_slope_trend,
        rsi=dma_m.rsi,
        volume_mult=dma_m.volume_mult,
        setup_category=dma_m.setup_category,
        score=dma_m.score,
        is_golden_cross=dma_m.is_golden_cross,
        nearest_support=ns_schema,
        nearest_resistance=nr_schema,
        confluence_tags=sr_res.confluence_tags,
    )


@router.get("/scan", response_model=DMAScanResponse)
async def scan_dma_opportunities(
    index: str = Query("NIFTY 500"),
    filter_category: Optional[str] = Query(None, description="ALL, GOLDEN_CROSS, NEAR_50_DMA, NEAR_200_DMA, CONFLUENCE, BREAKOUT_WATCH"),
):
    """
    Scans NSE stocks for real DMA metrics, S/R levels, Confluence, and Setup Scores.
    """
    index_str = str(getattr(index, "default", index)) if not isinstance(index, str) else index
    if not index_str or not isinstance(index_str, str):
        index_str = "NIFTY 500"

    try:
        symbols = await nse_client.get_index_symbols(index_str)
    except Exception:
        symbols = []

    if not symbols:
        symbols = [
            "BEL", "HAL", "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK",
            "SBIN", "LT", "MARUTI", "TITAN", "SUNPHARMA", "BAJFINANCE", "WIPRO"
        ]

    # Fetch OHLC in parallel batch for top candidates (limit 35 for live response speed)
    scan_targets = symbols[:35]
    results = []

    for sym in scan_targets:
        try:
            df = await nse_client.fetch_ohlc(sym, timeframe="1d", limit=120)
            item = _process_single_stock_scan(sym, df)
            if item:
                if filter_category and filter_category != "ALL":
                    if filter_category == "GOLDEN_CROSS" and not item.is_golden_cross:
                        continue
                    if filter_category == "NEAR_50_DMA" and abs(item.dist_50_pct) > 3.0:
                        continue
                    if filter_category == "NEAR_200_DMA" and abs(item.dist_200_pct) > 3.0:
                        continue
                    if filter_category == "CONFLUENCE" and not item.confluence_tags:
                        continue
                    if filter_category == "BREAKOUT_WATCH" and item.setup_category != "BREAKOUT_WATCH":
                        continue
                results.append(item)
        except Exception:
            continue

    # Sort results by setup score descending
    results.sort(key=lambda x: x.score, reverse=True)

    return DMAScanResponse(
        index=index_str,
        scanned=len(scan_targets),
        matched=len(results),
        results=results,
    )


@router.get("/stock/{symbol}", response_model=StockDetailResponse)
async def get_stock_detail_analysis(symbol: str):
    """
    Full single stock analysis: live OHLC, 20/50/200 DMAs, S1-S3 / R1-R3 strength levels, Volume Profile, Confluence tags, and Chart Series.
    """
    sym = symbol.upper().strip()
    df = await nse_client.fetch_ohlc(sym, timeframe="1d", limit=150)
    if df.empty or len(df) < 20:
        raise HTTPException(status_code=404, detail=f"No market data found for {sym}")

    dma_m = calculate_dma_metrics(df, sym)
    if not dma_m:
        raise HTTPException(status_code=500, detail="Failed to calculate DMA metrics")

    sr_res = calculate_sr_analysis(df, dma_m.last_price, dma_m.dma50, dma_m.dma200)

    supports_schema = [
        SRLevelSchema(
            level_type=s.level_type,
            label=s.label,
            price=s.price,
            zone_low=s.zone_low,
            zone_high=s.zone_high,
            distance_pct=s.distance_pct,
            strength=s.strength,
            test_count=s.test_count,
            reasons=s.reasons,
        )
        for s in sr_res.supports
    ]

    resistances_schema = [
        SRLevelSchema(
            level_type=r.level_type,
            label=r.label,
            price=r.price,
            zone_low=r.zone_low,
            zone_high=r.zone_high,
            distance_pct=r.distance_pct,
            strength=r.strength,
            test_count=r.test_count,
            reasons=r.reasons,
        )
        for r in sr_res.resistances
    ]

    chart_data = []
    for date, row in df.tail(100).iterrows():
        date_str = date.strftime("%Y-%m-%d")
        chart_data.append({
            "time": date_str,
            "open": round(float(row["open"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "close": round(float(row["close"]), 2),
            "volume": int(row["volume"]),
        })

    return StockDetailResponse(
        symbol=sym,
        price=dma_m.last_price,
        dma_metrics=DMAMetricsSchema(**dma_m.__dict__),
        supports=supports_schema,
        resistances=resistances_schema,
        volume_profile=VolumeProfileSchema(
            poc=sr_res.volume_profile.poc,
            vah=sr_res.volume_profile.vah,
            val=sr_res.volume_profile.val,
        ),
        confluence_tags=sr_res.confluence_tags,
        chart_data=chart_data,
    )
