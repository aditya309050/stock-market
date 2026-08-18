from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import io
from typing import Any

import httpx
import pandas as pd

from app.core.config import settings
from app.services.nse.client import nse_client

SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv"


class DhanClient:
    def __init__(self) -> None:
        self._scrip_master_cache: list[dict[str, Any]] = []
        self._scrip_master_loaded_at: datetime | None = None

    async def fetch_scrip_master(self, force_refresh: bool = False) -> list[dict[str, Any]]:
        """
        Downloads official Dhan Scrip Master CSV and extracts all NSE Equity stocks.
        Filters for Exchange = NSE and Instrument = EQUITY / Series = EQ.
        """
        now = datetime.now(timezone.utc)
        if (
            not force_refresh
            and self._scrip_master_cache
            and self._scrip_master_loaded_at
            and (now - self._scrip_master_loaded_at) < timedelta(hours=12)
        ):
            return self._scrip_master_cache

        url = settings.DHAN_SCRIP_MASTER_URL or SCRIP_MASTER_URL
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
            res = await client.get(url)
            res.raise_for_status()

            csv_data = res.text
            df = await asyncio.to_thread(pd.read_csv, io.StringIO(csv_data), low_memory=False)

            # Standardize column headers
            df.columns = [str(c).strip().upper() for c in df.columns]

            # Dhan CSV column names mapping:
            # SEM_EXM_EXCH_ID / EXCHANGE, SEM_INSTRUMENT_NAME / INSTRUMENT_TYPE, SEM_SMST_SECURITY_ID / SECURITY_ID,
            # SEM_TRADING_SYMBOL / TRADING_SYMBOL, SEM_SERIES
            exch_col = next((c for c in ["SEM_EXM_EXCH_ID", "EXCHANGE", "EXCH_ID"] if c in df.columns), None)
            inst_col = next((c for c in ["SEM_INSTRUMENT_NAME", "INSTRUMENT_TYPE", "INSTRUMENT"] if c in df.columns), None)
            sec_col = next((c for c in ["SEM_SMST_SECURITY_ID", "SECURITY_ID", "SECURITYID"] if c in df.columns), None)
            sym_col = next((c for c in ["SEM_TRADING_SYMBOL", "TRADING_SYMBOL", "SYMBOL"] if c in df.columns), None)
            series_col = next((c for c in ["SEM_SERIES", "SERIES"] if c in df.columns), None)
            name_col = next((c for c in ["SEM_CUSTOM_SYMBOL", "COMPANY_NAME", "NAME"] if c in df.columns), None)
            isin_col = next((c for c in ["SEM_ISIN", "ISIN"] if c in df.columns), None)

            filtered_rows = []
            for _, row in df.iterrows():
                exch = str(row.get(exch_col, "")).upper().strip() if exch_col else ""
                inst = str(row.get(inst_col, "")).upper().strip() if inst_col else ""
                series = str(row.get(series_col, "")).upper().strip() if series_col else ""

                # Filter for NSE EQ (Equity only, no ETFs, no derivatives, no indices, no bonds/G-Secs)
                if (exch == "NSE" or exch == "NSE_EQ") and (
                    "EQUITY" in inst or series in ["EQ"] or inst == "EQ"
                ):
                    raw_sym = str(row.get(sym_col, "")).strip()
                    if not raw_sym:
                        continue

                    clean_sym = raw_sym.split("-")[0].strip()

                    # Exclude Government Securities, State Loans, Sovereign Gold Bonds, and Debt instruments
                    if (
                        clean_sym[0].isdigit()
                        or clean_sym.startswith("SGB")
                        or clean_sym.startswith("GS")
                        or "-GS" in raw_sym
                        or "-GB" in raw_sym
                        or "-SG" in raw_sym
                    ):
                        continue

                    filtered_rows.append(
                        {
                            "security_id": str(row.get(sec_col, "")).strip(),
                            "symbol": clean_sym,
                            "trading_symbol": raw_sym,
                            "company_name": str(row.get(name_col, "")).strip() if name_col else clean_sym,
                            "isin": str(row.get(isin_col, "")).strip() if isin_col else "",
                            "exchange_segment": "NSE_EQ",
                            "instrument_type": "EQUITY",
                        }
                    )


            if filtered_rows:
                self._scrip_master_cache = filtered_rows
                self._scrip_master_loaded_at = now

            return self._scrip_master_cache

    async def fetch_historical_daily(
        self, symbol: str, security_id: str = "", limit: int = 250
    ) -> pd.DataFrame:
        """
        Fetches 200+ days of historical daily OHLCV candles.
        Tries Dhan HQ Historical API first if configured; falls back to NSE/YFinance client.
        """
        if settings.dhan_configured:
            try:
                headers = {
                    "access-token": settings.DHAN_ACCESS_TOKEN,
                    "client-id": settings.DHAN_CLIENT_ID,
                    "Content-Type": "application/json",
                }
                to_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                from_date = (datetime.now(timezone.utc) - timedelta(days=limit * 1.5)).strftime("%Y-%m-%d")
                payload = {
                    "symbol": symbol,
                    "exchangeSegment": "NSE_EQ",
                    "instrument": "EQUITY",
                    "securityId": security_id,
                    "fromDate": from_date,
                    "toDate": to_date,
                }
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(
                        f"{settings.DHAN_BASE_URL}/charts/historical",
                        json=payload,
                        headers=headers,
                    )
                    if res.status_code == 200:
                        data = res.json()
                        # Dhan returns {open: [], high: [], low: [], close: [], volume: [], start_Time: []}
                        if "close" in data and len(data["close"]) > 0:
                            df = pd.DataFrame(
                                {
                                    "open": data.get("open", []),
                                    "high": data.get("high", []),
                                    "low": data.get("low", []),
                                    "close": data.get("close", []),
                                    "volume": data.get("volume", []),
                                }
                            )
                            return df.tail(limit)
            except Exception:
                pass

        # Fallback to robust NSE / Yahoo Finance client
        return await nse_client.fetch_ohlc(symbol, timeframe="1d", limit=limit)


dhan_client = DhanClient()
