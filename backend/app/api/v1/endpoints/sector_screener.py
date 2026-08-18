from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any
import yfinance as yf
import pandas as pd
import numpy as np
import asyncio

router = APIRouter()

class SectorResult(BaseModel):
    rank: int
    sector: str
    display_name: str
    ticker: str
    sector_return: float
    nifty_return: float
    relative_strength: float
    chg_5d: int
    chg_21d: int
    category: str  # "OUTPERFORM", "MIXED", "UNDERPERFORM"
    trend: str     # "up", "mixed", "down"

class RotationSummary(BaseModel):
    outperform_count: int
    mixed_count: int
    underperform_count: int

class SectorScreenerResponse(BaseModel):
    timeframe: str
    benchmark_symbol: str
    benchmark_name: str
    benchmark_return: float
    sentiment: str  # "NEUTRAL", "BULLISH", "BEARISH"
    rotation: RotationSummary
    results: List[SectorResult]
    outperform_list: List[SectorResult]
    mixed_list: List[SectorResult]
    underperform_list: List[SectorResult]
    chart_data: List[Dict[str, Any]]

TIMEFRAME_MAP = {
    "1M": "3mo",  # Fetch enough history for 21d rank shift calculation
    "3M": "6mo",
    "6M": "1y",
    "1Y": "2y"
}

SECTOR_TICKERS = {
    "NIFTY_AUTO": "^CNXAUTO",
    "NIFTY_BANK": "^NSEBANK",
    "NIFTY_ENERGY": "^CNXENERGY",
    "NIFTY_FMCG": "^CNXFMCG",
    "NIFTY_IT": "^CNXIT",
    "NIFTY_METAL": "^CNXMETAL",
    "NIFTY_PHARMA": "^CNXPHARMA",
    "NIFTY_PSU_BANK": "^CNXPSUBANK",
    "NIFTY_REALTY": "^CNXREALTY",
    "NIFTY_INFRA": "^CNXINFRA",
    "NIFTY_SERVICES": "^CNXSERVICE",
    "NIFTY_MEDIA": "^CNXMEDIA",
}

SECTOR_DISPLAY_NAMES = {
    "NIFTY_AUTO": "CNXAUTO",
    "NIFTY_BANK": "NSEBANK",
    "NIFTY_ENERGY": "CNXENERGY",
    "NIFTY_FMCG": "CNXFMCG",
    "NIFTY_IT": "CNXIT",
    "NIFTY_METAL": "CNXMETAL",
    "NIFTY_PHARMA": "CNXPHARMA",
    "NIFTY_PSU_BANK": "CNXPSUBANK",
    "NIFTY_REALTY": "CNXREALTY",
    "NIFTY_INFRA": "CNXINFRA",
    "NIFTY_SERVICES": "CNXSERVICES",
    "NIFTY_MEDIA": "CNXMEDIA",
}

def fetch_sector_data_sync(period: str, benchmark: str = "NIFTY_500") -> Dict[str, Any]:
    ticker_to_name = {v: k for k, v in SECTOR_TICKERS.items()}
    bench_ticker = "^CRSLDX" if benchmark == "NIFTY_500" else "^NSEI"
    ticker_to_name[bench_ticker] = "BENCHMARK"

    all_symbols = list(SECTOR_TICKERS.values()) + [bench_ticker]
    if bench_ticker != "^NSEI":
        all_symbols.append("^NSEI")
        ticker_to_name["^NSEI"] = "BENCHMARK_ALT"

    try:
        raw_df = yf.download(all_symbols, period=period, progress=False)
        if raw_df is not None and not raw_df.empty and "Close" in raw_df:
            close_df = raw_df["Close"]
        else:
            close_df = pd.DataFrame()
    except Exception:
        close_df = pd.DataFrame()

    dfs = {}
    for sym in all_symbols:
        if sym in close_df and not close_df[sym].dropna().empty:
            name = ticker_to_name.get(sym)
            if name:
                dfs[name] = close_df[sym]

    if "BENCHMARK" not in dfs or dfs["BENCHMARK"].dropna().empty:
        if "BENCHMARK_ALT" in dfs and not dfs["BENCHMARK_ALT"].dropna().empty:
            dfs["BENCHMARK"] = dfs["BENCHMARK_ALT"]

    if "BENCHMARK_ALT" in dfs:
        del dfs["BENCHMARK_ALT"]

    if "BENCHMARK" not in dfs:
        # Emergency fallback for benchmark
        try:
            bench_df = yf.Ticker("^NSEI").history(period=period)["Close"]
            if bench_df is not None and not bench_df.empty:
                dfs["BENCHMARK"] = bench_df
        except Exception:
            pass

    if "BENCHMARK" not in dfs:
        raise ValueError("Failed to fetch benchmark data from Yahoo Finance.")

    merged_df = pd.DataFrame(dfs).ffill().bfill()
    if merged_df.empty or len(merged_df) < 2:
        raise ValueError("Insufficient price data points.")

    # Calculate normalized returns (%) relative to initial row
    initial_prices = merged_df.iloc[0]
    cum_returns_df = ((merged_df - initial_prices) / initial_prices) * 100

    latest_returns = cum_returns_df.iloc[-1]
    nifty_ret = float(latest_returns["BENCHMARK"])

    # Calculate relative strength df for rank tracking over time
    rs_df = pd.DataFrame()
    for col in cum_returns_df.columns:
        if col != "BENCHMARK":
            rs_df[col] = cum_returns_df[col] - cum_returns_df["BENCHMARK"]

    total_rows = len(rs_df)
    idx_5d = max(0, total_rows - 6)
    idx_21d = max(0, total_rows - 22)

    ranks_now = rs_df.iloc[-1].rank(ascending=False, method='min')
    ranks_5d = rs_df.iloc[idx_5d].rank(ascending=False, method='min')
    ranks_21d = rs_df.iloc[idx_21d].rank(ascending=False, method='min')

    results = []
    for name in rs_df.columns:
        sec_ret = float(latest_returns[name])
        rs_val = float(rs_df[name].iloc[-1])
        cur_rank = int(ranks_now[name])
        r5_rank = int(ranks_5d[name])
        r21_rank = int(ranks_21d[name])

        # Positive shift means rank improved (e.g. 5th -> 2nd = +3)
        chg_5d = r5_rank - cur_rank
        chg_21d = r21_rank - cur_rank

        # Category determination based on RS threshold
        if rs_val >= 1.5:
            cat = "OUTPERFORM"
            trend = "up"
        elif rs_val <= -1.5:
            cat = "UNDERPERFORM"
            trend = "down"
        else:
            cat = "MIXED"
            trend = "mixed"

        display_name = SECTOR_DISPLAY_NAMES.get(name, name.replace("NIFTY_", ""))
        ticker_symbol = SECTOR_TICKERS.get(name, "")

        results.append({
            "rank": cur_rank,
            "sector": name,
            "display_name": display_name,
            "ticker": ticker_symbol,
            "sector_return": round(sec_ret, 2),
            "nifty_return": round(nifty_ret, 2),
            "relative_strength": round(rs_val, 2),
            "chg_5d": chg_5d,
            "chg_21d": chg_21d,
            "category": cat,
            "trend": trend,
        })

    # Sort results by current rank ascending
    results.sort(key=lambda x: x["rank"])

    # Split into OUTPERFORM, MIXED, UNDERPERFORM lists
    outperform_list = [r for r in results if r["category"] == "OUTPERFORM"]
    mixed_list = [r for r in results if r["category"] == "MIXED"]
    underperform_list = [r for r in results if r["category"] == "UNDERPERFORM"]

    # Sentiment analysis
    out_cnt = len(outperform_list)
    mix_cnt = len(mixed_list)
    under_cnt = len(underperform_list)

    if out_cnt > under_cnt + 2:
        sentiment = "BULLISH"
    elif under_cnt > out_cnt + 2:
        sentiment = "BEARISH"
    else:
        sentiment = "NEUTRAL"

    # Prepare chart data for line chart plotting
    chart_data = []
    # Slice chart data to user requested timeframe length
    chart_slice = cum_returns_df.tail(60 if period == "3mo" else 120)
    for date, row in chart_slice.iterrows():
        entry = {"date": date.strftime("%b %d")}
        for col in chart_slice.columns:
            val = row[col]
            entry[col] = 0.0 if pd.isna(val) else round(float(val), 2)
        chart_data.append(entry)

    return {
        "benchmark_symbol": "CNX500" if benchmark == "NIFTY_500" else "NIFTY 50",
        "benchmark_name": "NSE CNX500" if benchmark == "NIFTY_500" else "NIFTY 50",
        "benchmark_return": round(nifty_ret, 2),
        "sentiment": sentiment,
        "rotation": {
            "outperform_count": out_cnt,
            "mixed_count": mix_cnt,
            "underperform_count": under_cnt,
        },
        "results": results,
        "outperform_list": outperform_list,
        "mixed_list": mixed_list,
        "underperform_list": underperform_list,
        "chart_data": chart_data,
    }

@router.get("", response_model=SectorScreenerResponse)
async def get_sector_screener(
    timeframe: str = Query("1M", pattern="^(1M|3M|6M|1Y)$"),
    benchmark: str = Query("NIFTY_500", pattern="^(NIFTY_500|NIFTY_50)$")
):
    period = TIMEFRAME_MAP.get(timeframe, "3mo")
    try:
        data = await asyncio.to_thread(fetch_sector_data_sync, period, benchmark)
        return SectorScreenerResponse(
            timeframe=timeframe,
            benchmark_symbol=data["benchmark_symbol"],
            benchmark_name=data["benchmark_name"],
            benchmark_return=data["benchmark_return"],
            sentiment=data["sentiment"],
            rotation=RotationSummary(**data["rotation"]),
            results=[SectorResult(**r) for r in data["results"]],
            outperform_list=[SectorResult(**r) for r in data["outperform_list"]],
            mixed_list=[SectorResult(**r) for r in data["mixed_list"]],
            underperform_list=[SectorResult(**r) for r in data["underperform_list"]],
            chart_data=data["chart_data"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
