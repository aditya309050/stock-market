from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Any
from app.services.nse.client import NSEClient
from app.services.nse.scanner import _scan_symbol
from app.services.indicators.engine import enrich_dataframe, latest_signals
from app.services.indicators.probability import score_50dma_breakout
import pandas as pd
import numpy as np

router = APIRouter()
nse_client = NSEClient()

class DMAScanResult(BaseModel):
    symbol: str
    price: float
    sma50: float
    sma200: float
    distance_pct: float
    volume_spike: float
    rsi: float
    macd_bullish: bool
    probability_score: float
    probability_class: str
    setup_type: str
    ai_analysis: str

class DMAScanResponse(BaseModel):
    results: List[DMAScanResult]
    scanned: int
    matched: int

@router.get("/scan", response_model=DMAScanResponse)
async def scan_dma_opportunities(index: str = "NIFTY 500"):
    """
    Scans the index for 50 DMA opportunities (Near 50 DMA, Crossing, Bouncing, Golden Trend).
    """
    try:
        symbols = nse_client.get_index_constituents(index)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid index: {str(e)}")

    results = []
    
    # Normally we would do this asynchronously or in parallel, 
    # but keeping it simple for the implementation.
    for sym in symbols[:100]: # Limiting to 100 for performance during live request
        try:
            hist = nse_client.get_historical_data(sym, period="3mo")
            if hist.empty or len(hist) < 50:
                continue
                
            df_enriched = enrich_dataframe(hist)
            signals = latest_signals(df_enriched)
            prob_data = score_50dma_breakout(df_enriched, signals)
            
            cmp = signals["price"]
            sma50 = signals.get("sma50")
            sma200 = signals.get("sma200")
            
            if not sma50 or pd.isna(sma50):
                continue
                
            dist_pct = prob_data["distance_from_50dma_pct"]
            setup_type = None
            
            # 1. Near 50 DMA
            if dist_pct <= 2.0:
                setup_type = "Near 50 DMA"
            # 2. Golden Trend
            elif sma200 and not pd.isna(sma200) and sma50 > sma200:
                setup_type = "Golden Trend"
            # 3. Crossing Above 50 DMA (Price slightly below, but MACD bull cross + volume)
            elif cmp < sma50 and dist_pct <= 3.0 and signals.get("macd_bullish_cross") and prob_data["volume_spike"] > 1.2:
                setup_type = "Crossing Above"
            
            if setup_type:
                results.append(DMAScanResult(
                    symbol=sym,
                    price=cmp,
                    sma50=round(sma50, 2),
                    sma200=round(sma200, 2) if sma200 else 0.0,
                    distance_pct=dist_pct,
                    volume_spike=prob_data["volume_spike"],
                    rsi=signals.get("rsi") or 50.0,
                    macd_bullish=signals.get("macd_bullish_cross") or False,
                    probability_score=prob_data["probability_score"],
                    probability_class=prob_data["probability_class"],
                    setup_type=setup_type,
                    ai_analysis=prob_data["ai_analysis"]
                ))
        except Exception:
            continue
            
    # Sort by probability score descending
    results.sort(key=lambda x: x.probability_score, reverse=True)
    
    return DMAScanResponse(
        results=results,
        scanned=len(symbols),
        matched=len(results)
    )

@router.get("/history/{symbol}")
async def get_stock_history(symbol: str, period: str = "1y"):
    """
    Returns OHLCV data + SMA50 and SMA200 for TradingView lightweight charts.
    """
    try:
        hist = nse_client.get_historical_data(symbol, period=period)
        if hist.empty:
            raise HTTPException(status_code=404, detail="No data found")
            
        df = enrich_dataframe(hist)
        
        # We need to format the data for lightweight-charts
        # Requires: { time: 'YYYY-MM-DD', open, high, low, close, value (volume) }
        
        chart_data = []
        for index, row in df.iterrows():
            date_str = index.strftime("%Y-%m-%d")
            chart_data.append({
                "time": date_str,
                "open": float(row["open"]),
                "high": float(row["high"]),
                "low": float(row["low"]),
                "close": float(row["close"]),
                "volume": float(row["volume"]),
                "sma50": round(float(row["sma50"]), 2) if pd.notna(row.get("sma50")) else None,
                "sma200": round(float(row["sma200"]), 2) if pd.notna(row.get("sma200")) else None,
            })
            
        return chart_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
