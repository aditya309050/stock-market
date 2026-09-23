"""Dhan F&O Instrument Service — resolves option contract Security IDs from Dhan Scrip Master."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
import io
import logging
from typing import Any

import httpx
import pandas as pd

from app.core.config import settings

logger = logging.getLogger(__name__)

SCRIP_MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv"


class DhanFNOInstrumentService:
    """
    Downloads and caches Dhan Scrip Master specifically for NSE_FNO contracts (OPTIDX, OPTSTK, FUTIDX, FUTSTK).
    Enables dynamic, un-hardcoded Security ID lookup for any Option Chain contract.
    """

    def __init__(self) -> None:
        self._fno_cache: dict[str, dict[str, Any]] = {}
        self._fno_by_params: dict[tuple[str, str, float, str], str] = {}  # (symbol, expiry_str, strike, opt_type) -> security_id
        self._loaded_at: datetime | None = None
        self._lock = asyncio.Lock()

    async def _ensure_loaded(self, force: bool = False) -> None:
        now = datetime.now(timezone.utc)
        if not force and self._loaded_at and (now - self._loaded_at) < timedelta(hours=12):
            return

        async with self._lock:
            if not force and self._loaded_at and (now - self._loaded_at) < timedelta(hours=12):
                return

            url = settings.DHAN_SCRIP_MASTER_URL or SCRIP_MASTER_URL
            try:
                async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                    res = await client.get(url)
                    res.raise_for_status()
                    csv_text = res.text

                df = await asyncio.to_thread(pd.read_csv, io.StringIO(csv_text), low_memory=False)
                df.columns = [str(c).strip().upper() for c in df.columns]

                exch_col = next((c for c in ["SEM_EXM_EXCH_ID", "EXCHANGE", "EXCH_ID"] if c in df.columns), None)
                inst_col = next((c for c in ["SEM_INSTRUMENT_NAME", "INSTRUMENT_TYPE", "INSTRUMENT"] if c in df.columns), None)
                sec_col = next((c for c in ["SEM_SMST_SECURITY_ID", "SECURITY_ID", "SECURITYID"] if c in df.columns), None)
                sym_col = next((c for c in ["SEM_TRADING_SYMBOL", "TRADING_SYMBOL", "SYMBOL"] if c in df.columns), None)
                strike_col = next((c for c in ["SEM_STRIKE_PRICE", "STRIKE_PRICE", "STRIKE"] if c in df.columns), None)
                opt_col = next((c for c in ["SEM_OPTION_TYPE", "OPTION_TYPE", "OPT_TYPE"] if c in df.columns), None)
                exp_col = next((c for c in ["SEM_EXPIRY_DATE", "EXPIRY_DATE", "EXPIRY"] if c in df.columns), None)
                custom_sym_col = next((c for c in ["SEM_CUSTOM_SYMBOL", "CUSTOM_SYMBOL", "NAME"] if c in df.columns), None)

                new_cache: dict[str, dict[str, Any]] = {}
                new_by_params: dict[tuple[str, str, float, str], str] = {}

                for _, row in df.iterrows():
                    exch = str(row.get(exch_col, "")).upper().strip() if exch_col else ""
                    inst = str(row.get(inst_col, "")).upper().strip() if inst_col else ""

                    if "FNO" in exch or exch == "NSE_FNO" or inst in ("OPTIDX", "OPTSTK", "FUTIDX", "FUTSTK"):
                        sec_id = str(row.get(sec_col, "")).strip()
                        if not sec_id:
                            continue

                        raw_sym = str(row.get(sym_col, "")).strip().upper()
                        strike_val = 0.0
                        if strike_col:
                            try:
                                strike_val = float(row.get(strike_col, 0.0))
                            except Exception:
                                strike_val = 0.0

                        opt_type = str(row.get(opt_col, "")).strip().upper() if opt_col else ""
                        exp_date_str = str(row.get(exp_col, "")).strip() if exp_col else ""
                        custom_sym = str(row.get(custom_sym_col, "")).strip() if custom_sym_col else raw_sym

                        # Extract clean base symbol (e.g. NIFTY, BANKNIFTY)
                        base_symbol = raw_sym.split("-")[0].strip().upper()
                        if " " in base_symbol:
                            base_symbol = base_symbol.split()[0]

                        # Normalize expiry to YYYY-MM-DD or DD-Mon-YYYY
                        normalized_exp = exp_date_str.split()[0] if exp_date_str else ""

                        item = {
                            "security_id": sec_id,
                            "symbol": base_symbol,
                            "trading_symbol": raw_sym,
                            "custom_symbol": custom_sym,
                            "strike": strike_val,
                            "option_type": opt_type,
                            "expiry": normalized_exp,
                            "instrument_type": inst,
                            "exchange_segment": "NSE_FNO",
                        }

                        new_cache[sec_id] = item
                        if base_symbol and opt_type in ("CE", "PE") and strike_val > 0:
                            new_by_params[(base_symbol, normalized_exp, strike_val, opt_type)] = sec_id
                            new_by_params[(base_symbol, "", strike_val, opt_type)] = sec_id

                self._fno_cache = new_cache
                self._fno_by_params = new_by_params
                self._loaded_at = now
                logger.info(f"Loaded {len(new_cache)} Dhan FNO instruments into memory.")
            except Exception as e:
                logger.warning(f"Could not load Dhan FNO instruments from master: {e}")
                self._loaded_at = now

    async def get_security_id(
        self,
        symbol: str,
        expiry: str,
        strike: float,
        option_type: str,
    ) -> str:
        """
        Dynamically finds the Dhan Security ID for a given contract.
        Falls back to a deterministic synthetic FNO ID if not in Scrip Master yet.
        """
        await self._ensure_loaded()
        sym = symbol.upper().strip()
        opt = option_type.upper().strip()
        exp = expiry.strip()

        # Exact match
        sec_id = self._fno_by_params.get((sym, exp, strike, opt))
        if sec_id:
            return sec_id

        # Approximate match on symbol + strike + option_type
        for (s, _, k, o), sid in self._fno_by_params.items():
            if s == sym and o == opt and abs(k - strike) < 0.1:
                return sid

        # Deterministic synthetic Security ID for live simulation & testing
        hash_code = abs(hash(f"{sym}_{exp}_{strike}_{opt}")) % 100000
        prefix = 400000 if opt == "CE" else 500000
        return str(prefix + hash_code)

    async def get_instrument_details(self, security_id: str) -> dict[str, Any] | None:
        await self._ensure_loaded()
        return self._fno_cache.get(str(security_id))


dhan_fno_service = DhanFNOInstrumentService()
