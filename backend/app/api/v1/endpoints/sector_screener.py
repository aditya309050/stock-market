from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any
import yfinance as yf
import pandas as pd
import asyncio

router = APIRouter()

class SectorResult(BaseModel):
    sector: str
    ticker: str
    sector_return: float
    nifty_return: float
    relative_strength: float
    trend: str # "up" or "down"

class SectorScreenerResponse(BaseModel):
    timeframe: str
    nifty_return: float
    results: List[SectorResult]
    chart_data: List[Dict[str, Any]]

TIMEFRAME_MAP = {
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y"
}

def fetch_sector_data_sync(period: str) -> Dict[str, Any]:
    tickers = {
        "NIFTY_50": "^NSEI",
        "IT": "^CNXIT",
        "BANK": "^NSEBANK",
        "PHARMA": "^CNXPHARMA",
        "AUTO": "^CNXAUTO",
        "FMCG": "^CNXFMCG",
        "ENERGY": "^CNXENERGY",
        "PSU_BANK": "^CNXPSUBANK",
        "METAL": "^CNXMETAL"
    }
    
    dfs = {}
    for name, ticker in tickers.items():
        try:
            tk = yf.Ticker(ticker)
            df = tk.history(period=period)
            if df is not None and not df.empty:
                dfs[name] = df['Close']
        except Exception:
            continue
            
    if not dfs or "NIFTY_50" not in dfs:
        raise ValueError("Failed to fetch benchmark and sector data from yfinance.")
        
    merged_df = pd.DataFrame(dfs)
    # Forward fill then backward fill to handle holidays/missing dates
    merged_df = merged_df.ffill().bfill()
    
    if merged_df.empty:
        raise ValueError("Merged dataset is empty.")
        
    initial_prices = merged_df.iloc[0]
    cum_returns_df = ((merged_df - initial_prices) / initial_prices) * 100
    
    latest_returns = cum_returns_df.iloc[-1]
    nifty_ret = float(latest_returns["NIFTY_50"])
    
    results = []
    sector_tickers = {
        "IT": "^CNXIT",
        "BANK": "^NSEBANK",
        "PHARMA": "^CNXPHARMA",
        "AUTO": "^CNXAUTO",
        "FMCG": "^CNXFMCG",
        "ENERGY": "^CNXENERGY",
        "PSU_BANK": "^CNXPSUBANK",
        "METAL": "^CNXMETAL"
    }
    
    for name, ticker in sector_tickers.items():
        if name in latest_returns:
            sec_ret = float(latest_returns[name])
            rs = sec_ret - nifty_ret
            trend = "up" if rs >= 0 else "down"
            results.append({
                "sector": name,
                "ticker": ticker,
                "sector_return": round(sec_ret, 2),
                "nifty_return": round(nifty_ret, 2),
                "relative_strength": round(rs, 2),
                "trend": trend
            })
            
    # Sort by relative strength descending
    results.sort(key=lambda x: x["relative_strength"], reverse=True)
    
    # Prepare chart data
    chart_data = []
    for date, row in cum_returns_df.iterrows():
        entry = {"date": date.strftime("%Y-%m-%d")}
        for col in cum_returns_df.columns:
            val = row[col]
            if pd.isna(val):
                entry[col] = 0.0
            else:
                entry[col] = round(float(val), 2)
        chart_data.append(entry)
        
    return {
        "nifty_return": round(nifty_ret, 2),
        "results": results,
        "chart_data": chart_data
    }

@router.get("", response_model=SectorScreenerResponse)
async def get_sector_screener(timeframe: str = Query("1M", pattern="^(1M|3M|6M|1Y)$")):
    period = TIMEFRAME_MAP.get(timeframe, "1mo")
    try:
        data = await asyncio.to_thread(fetch_sector_data_sync, period)
        return SectorScreenerResponse(
            timeframe=timeframe,
            nifty_return=data["nifty_return"],
            results=data["results"],
            chart_data=data["chart_data"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
