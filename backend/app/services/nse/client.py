"""NSE India data via official JSON APIs (session) + Yahoo Finance OHLC fallback."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pandas as pd
import yfinance as yf

from app.core.config import settings

NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}

TIMEFRAME_YF = {
    "1d": {"interval": "1d", "period": "1y"},
    "1h": {"interval": "1h", "period": "60d"},
    "2h": {"interval": "1h", "period": "60d"},  # resampled from 1h
}


def to_yahoo_symbol(symbol: str) -> str:
    s = symbol.upper().strip()
    return s if s.endswith(".NS") else f"{s}.NS"


class NSEClient:
    def __init__(self) -> None:
        self._symbols_cache: dict[str, list[str]] = {}
        self._cache_at: dict[str, datetime] = {}

    async def _nse_session_get(self, path: str) -> dict[str, Any]:
        """Fetch NSE JSON with cookie session to reduce 403 blocks."""
        async with httpx.AsyncClient(
            timeout=30.0, follow_redirects=True, headers=NSE_HEADERS
        ) as client:
            await client.get("https://www.nseindia.com")
            res = await client.get(f"https://www.nseindia.com{path}")
            res.raise_for_status()
            return res.json()

    async def get_index_symbols(self, index: str = "NIFTY 50") -> list[str]:
        cached = self._symbols_cache.get(index)
        cached_at = self._cache_at.get(index)
        if cached and cached_at:
            if datetime.now(timezone.utc) - cached_at < timedelta(hours=6):
                return cached

        index_map = {
            "NIFTY 50": "NIFTY%2050",
            "NIFTY 100": "NIFTY%20100",
            "NIFTY 500": "NIFTY%20500",
            "NIFTY TOTAL MARKET": "NIFTY%20TOTAL%20MARKET",
        }
        key = index_map.get(index.upper(), index.replace(" ", "%20"))
        try:
            data = await self._nse_session_get(
                f"/api/equity-stockIndices?index={key}"
            )
            symbols = [
                row["symbol"]
                for row in data.get("data", [])
                if row.get("symbol")
            ]
            if symbols:
                self._symbols_cache[index] = symbols
                self._cache_at[index] = datetime.now(timezone.utc)
                return symbols
        except Exception:
            pass

        # Fallback liquid NSE names
        return [
            "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR",
            "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK",
            "ASIANPAINT", "MARUTI", "TITAN", "SUNPHARMA", "BAJFINANCE",
            "WIPRO", "ULTRACEMCO", "NESTLEIND",
        ]

    def fetch_ohlc_sync(
        self, symbol: str, timeframe: str = "1d", limit: int = 200
    ) -> pd.DataFrame:
        ysym = to_yahoo_symbol(symbol)
        cfg = TIMEFRAME_YF.get(timeframe, TIMEFRAME_YF["1d"])
        ticker = yf.Ticker(ysym)
        df = ticker.history(period=cfg["period"], interval=cfg["interval"])
        if df is None or df.empty:
            return pd.DataFrame()

        df = df.rename(
            columns={
                "Open": "open",
                "High": "high",
                "Low": "low",
                "Close": "close",
                "Volume": "volume",
            }
        )
        df = df[["open", "high", "low", "close", "volume"]].dropna()
        df.index = pd.to_datetime(df.index, utc=True)

        if timeframe == "2h":
            df = (
                df.resample("2h")
                .agg(
                    {
                        "open": "first",
                        "high": "max",
                        "low": "min",
                        "close": "last",
                        "volume": "sum",
                    }
                )
                .dropna()
            )

        return df.tail(limit)

    async def fetch_ohlc(
        self, symbol: str, timeframe: str = "1d", limit: int = 200
    ) -> pd.DataFrame:
        return await asyncio.to_thread(self.fetch_ohlc_sync, symbol, timeframe, limit)

    async def get_market_movers(self, index: str = "NIFTY 50") -> dict[str, list[dict]]:
        """Top gainers/losers from index snapshot."""
        try:
            index_map = {"NIFTY 50": "NIFTY%2050", "NIFTY 100": "NIFTY%20100"}
            key = index_map.get(index.upper(), "NIFTY%2050")
            data = await self._nse_session_get(
                f"/api/equity-stockIndices?index={key}"
            )
            rows = []
            for row in data.get("data", []):
                pct = float(row.get("pChange") or row.get("perChange") or 0)
                rows.append(
                    {
                        "symbol": row.get("symbol"),
                        "last_price": float(row.get("lastPrice") or row.get("ltp") or 0),
                        "change_pct": pct,
                        "volume": int(row.get("totalTradedVolume") or 0),
                    }
                )
            rows.sort(key=lambda x: x["change_pct"], reverse=True)
            return {
                "gainers": rows[:10],
                "losers": list(reversed(rows[-10:])),
            }
        except Exception:
            return {"gainers": [], "losers": []}


nse_client = NSEClient()
