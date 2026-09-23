"""NSE Option Chain fetcher — NSE session + yfinance + synthetic fallback."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.services.options.greeks import bs_greeks, days_to_expiry_fraction

NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.nseindia.com/option-chain",
    "X-Requested-With": "XMLHttpRequest",
}

INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "MIDCPNIFTY", "FINNIFTY", "SENSEX"}

# Typical spot prices as last-resort fallback
DEFAULT_SPOTS: dict[str, float] = {
    "NIFTY": 25000.0,
    "BANKNIFTY": 52000.0,
    "MIDCPNIFTY": 12000.0,
    "FINNIFTY": 23000.0,
}

# YFinance ticker map for spot price
YF_SPOT_MAP: dict[str, str] = {
    "NIFTY": "^NSEI",
    "BANKNIFTY": "^NSEBANK",
    "MIDCPNIFTY": "MIDCPNIFTY.NS",
    "FINNIFTY": "NIFTY_FIN_SERVICE.NS",
}

_cache: dict[str, tuple[dict, datetime]] = {}
_CACHE_TTL_SECONDS = 60


class OptionChainClient:

    # ─── NSE Session Fetch ────────────────────────────────────────────────────

    async def _nse_get(self, path: str) -> dict[str, Any]:
        """3-step NSE cookie session: homepage → option-chain page → API."""
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(
                    timeout=35.0, follow_redirects=True, headers=NSE_HEADERS,
                ) as client:
                    await client.get("https://www.nseindia.com", timeout=15.0)
                    await asyncio.sleep(0.5)
                    await client.get("https://www.nseindia.com/option-chain", timeout=15.0)
                    await asyncio.sleep(0.3)
                    res = await client.get(
                        f"https://www.nseindia.com{path}",
                        headers={**NSE_HEADERS, "Referer": "https://www.nseindia.com/option-chain"},
                        timeout=20.0,
                    )
                    res.raise_for_status()
                    return res.json()
            except Exception as e:
                if attempt == 0:
                    await asyncio.sleep(1.5)
                    continue
                raise e
        raise RuntimeError("NSE unreachable")

    # ─── Main Entry Point ─────────────────────────────────────────────────────

    async def fetch_chain(
        self, symbol: str = "NIFTY", expiry: str | None = None
    ) -> dict[str, Any]:
        sym = symbol.upper().strip()
        cache_key = f"{sym}|{expiry or 'nearest'}"
        now = datetime.now(timezone.utc)

        if cache_key in _cache:
            cached_data, fetched_at = _cache[cache_key]
            if (now - fetched_at).total_seconds() < _CACHE_TTL_SECONDS:
                return cached_data

        result: dict[str, Any] | None = None

        # 1) Try live NSE
        try:
            path = (
                f"/api/option-chain-indices?symbol={sym}"
                if sym in INDEX_SYMBOLS
                else f"/api/option-chain-equities?symbol={sym}"
            )
            raw = await self._nse_get(path)
            parsed = self._parse(raw, sym, expiry)
            if parsed.get("rows"):
                result = parsed
        except Exception:
            pass

        # 2) Try yfinance option chain (works for NSE equities, limited for indices)
        if not result:
            try:
                result = await self._yfinance_chain(sym, expiry)
            except Exception:
                pass

        # 3) Synthetic fallback — always works, uses real spot price from yfinance
        if not result or not result.get("rows"):
            result = await self._synthetic_chain(sym, expiry)

        _cache[cache_key] = (result, now)
        return result

    # ─── NSE Parser ──────────────────────────────────────────────────────────

    def _parse(self, raw: dict, symbol: str, target_expiry: str | None) -> dict[str, Any]:
        records = raw.get("records", {})
        filtered = raw.get("filtered", {})
        spot = float(records.get("underlyingValue") or filtered.get("underlyingValue") or 0)
        expiry_dates: list[str] = records.get("expiryDates", [])
        chosen = target_expiry if target_expiry in expiry_dates else (expiry_dates[0] if expiry_dates else "")
        T = days_to_expiry_fraction(chosen) if chosen else 1 / 365
        r = 0.065

        rows: list[dict] = []
        total_ce_oi = total_pe_oi = 0

        for item in records.get("data", []) or []:
            if item.get("expiryDate") != chosen:
                continue
            strike = float(item.get("strikePrice", 0))
            ce = item.get("CE", {}) or {}
            pe = item.get("PE", {}) or {}
            ce_oi = int(ce.get("openInterest", 0) or 0)
            pe_oi = int(pe.get("openInterest", 0) or 0)
            ce_doi = int(ce.get("changeinOpenInterest", 0) or 0)
            pe_doi = int(pe.get("changeinOpenInterest", 0) or 0)
            ce_ltp = float(ce.get("lastPrice", 0) or 0)
            pe_ltp = float(pe.get("lastPrice", 0) or 0)
            ce_iv_pct = float(ce.get("impliedVolatility", 0) or 0)
            pe_iv_pct = float(pe.get("impliedVolatility", 0) or 0)
            ce_vol = int(ce.get("totalTradedVolume", 0) or 0)
            pe_vol = int(pe.get("totalTradedVolume", 0) or 0)
            ce_sigma = (ce_iv_pct / 100) if ce_iv_pct > 0 else 0.20
            pe_sigma = (pe_iv_pct / 100) if pe_iv_pct > 0 else 0.20
            ce_g = bs_greeks(spot, strike, T, ce_sigma, "CE", r) if spot > 0 else {}
            pe_g = bs_greeks(spot, strike, T, pe_sigma, "PE", r) if spot > 0 else {}
            total_ce_oi += ce_oi
            total_pe_oi += pe_oi
            rows.append({
                "strike": strike,
                "ce_oi": ce_oi, "ce_doi": ce_doi, "ce_ltp": ce_ltp,
                "ce_iv": round(ce_iv_pct, 2), "ce_volume": ce_vol,
                "ce_delta": ce_g.get("delta", 0.0), "ce_gamma": ce_g.get("gamma", 0.0),
                "ce_theta": ce_g.get("theta", 0.0), "ce_vega": ce_g.get("vega", 0.0),
                "pe_oi": pe_oi, "pe_doi": pe_doi, "pe_ltp": pe_ltp,
                "pe_iv": round(pe_iv_pct, 2), "pe_volume": pe_vol,
                "pe_delta": pe_g.get("delta", 0.0), "pe_gamma": pe_g.get("gamma", 0.0),
                "pe_theta": pe_g.get("theta", 0.0), "pe_vega": pe_g.get("vega", 0.0),
            })

        rows.sort(key=lambda x: x["strike"])
        return self._finalize(symbol, spot, chosen, expiry_dates, rows, total_ce_oi, total_pe_oi)

    # ─── YFinance Chain (equities mainly) ────────────────────────────────────

    async def _yfinance_chain(self, symbol: str, target_expiry: str | None) -> dict[str, Any]:
        import yfinance as yf

        yf_sym = YF_SPOT_MAP.get(symbol, f"{symbol}.NS")

        def _fetch() -> dict:
            ticker = yf.Ticker(yf_sym)
            spot = 0.0
            try:
                spot = float(getattr(ticker.fast_info, "last_price", 0) or 0)
            except Exception:
                pass

            raw_expiries: list[str] = []
            try:
                raw_expiries = list(ticker.options or [])
            except Exception:
                pass

            def to_nse(d: str) -> str:
                try:
                    return datetime.strptime(d, "%Y-%m-%d").strftime("%d-%b-%Y")
                except Exception:
                    return d

            expiry_dates = [to_nse(d) for d in raw_expiries]
            chosen_nse = target_expiry if target_expiry in expiry_dates else (expiry_dates[0] if expiry_dates else "")
            if not chosen_nse:
                return {}

            chosen_yf = raw_expiries[expiry_dates.index(chosen_nse)]
            T = days_to_expiry_fraction(chosen_nse)
            r = 0.065
            rows: list[dict] = []
            total_ce_oi = total_pe_oi = 0

            try:
                chain = ticker.option_chain(chosen_yf)
                calls, puts = chain.calls, chain.puts
                for _, crow in calls.iterrows():
                    strike = float(crow.get("strike", 0))
                    ce_oi = int(crow.get("openInterest", 0) or 0)
                    ce_ltp = float(crow.get("lastPrice", 0) or 0)
                    ce_iv_pct = float(crow.get("impliedVolatility", 0) or 0) * 100
                    ce_vol = int(crow.get("volume", 0) or 0)
                    pe_row = puts[puts["strike"] == strike]
                    pe_oi, pe_ltp, pe_iv_pct, pe_vol = 0, 0.0, 0.0, 0
                    if not pe_row.empty:
                        pr = pe_row.iloc[0]
                        pe_oi = int(pr.get("openInterest", 0) or 0)
                        pe_ltp = float(pr.get("lastPrice", 0) or 0)
                        pe_iv_pct = float(pr.get("impliedVolatility", 0) or 0) * 100
                        pe_vol = int(pr.get("volume", 0) or 0)
                    ce_sigma = (ce_iv_pct / 100) if ce_iv_pct > 0 else 0.20
                    pe_sigma = (pe_iv_pct / 100) if pe_iv_pct > 0 else 0.20
                    ce_g = bs_greeks(spot, strike, T, ce_sigma, "CE", r) if spot > 0 else {}
                    pe_g = bs_greeks(spot, strike, T, pe_sigma, "PE", r) if spot > 0 else {}
                    total_ce_oi += ce_oi
                    total_pe_oi += pe_oi
                    rows.append({
                        "strike": strike,
                        "ce_oi": ce_oi, "ce_doi": 0, "ce_ltp": ce_ltp,
                        "ce_iv": round(ce_iv_pct, 2), "ce_volume": ce_vol,
                        "ce_delta": ce_g.get("delta", 0.0), "ce_gamma": ce_g.get("gamma", 0.0),
                        "ce_theta": ce_g.get("theta", 0.0), "ce_vega": ce_g.get("vega", 0.0),
                        "pe_oi": pe_oi, "pe_doi": 0, "pe_ltp": pe_ltp,
                        "pe_iv": round(pe_iv_pct, 2), "pe_volume": pe_vol,
                        "pe_delta": pe_g.get("delta", 0.0), "pe_gamma": pe_g.get("gamma", 0.0),
                        "pe_theta": pe_g.get("theta", 0.0), "pe_vega": pe_g.get("vega", 0.0),
                    })
            except Exception:
                pass

            rows.sort(key=lambda x: x["strike"])
            return {"spot": spot, "expiry": chosen_nse, "expiry_dates": expiry_dates,
                    "rows": rows, "total_ce_oi": total_ce_oi, "total_pe_oi": total_pe_oi}

        data = await asyncio.to_thread(_fetch)
        if not data.get("rows"):
            return {}
        return self._finalize(symbol, data["spot"], data["expiry"], data["expiry_dates"],
                              data["rows"], data["total_ce_oi"], data["total_pe_oi"])

    # ─── Synthetic Chain (always works) ──────────────────────────────────────

    async def _synthetic_chain(self, symbol: str, target_expiry: str | None) -> dict[str, Any]:
        """
        Build a realistic synthetic option chain when NSE and yfinance both fail.
        Uses real spot price from yfinance; generates BS-priced strikes with IV smile.
        Marked with a flag so the UI can show a disclaimer.
        """
        import yfinance as yf

        yf_sym = YF_SPOT_MAP.get(symbol, f"{symbol}.NS")

        def _get_spot() -> float:
            try:
                info = yf.Ticker(yf_sym).fast_info
                return float(getattr(info, "last_price", 0) or getattr(info, "regularMarketPrice", 0) or 0)
            except Exception:
                return 0.0

        spot = await asyncio.to_thread(_get_spot)
        if not spot or spot <= 0:
            spot = DEFAULT_SPOTS.get(symbol, 25000.0)

        # Strike step size
        step = 100 if symbol == "BANKNIFTY" else 50 if symbol in ("NIFTY", "FINNIFTY") else 25
        atm = round(spot / step) * step

        # Generate expiry dates: next 4 Thursdays
        now = datetime.now(timezone.utc)
        expiry_dates: list[str] = []
        cur = now + timedelta(days=1)
        while len(expiry_dates) < 4:
            if cur.weekday() == 3:  # Thursday
                expiry_dates.append(cur.strftime("%d-%b-%Y"))
            cur += timedelta(days=1)

        chosen = target_expiry if target_expiry in expiry_dates else expiry_dates[0]
        T = days_to_expiry_fraction(chosen)
        r = 0.065
        base_iv = 0.14  # 14% typical NIFTY ATM IV

        rows: list[dict] = []
        total_ce_oi = total_pe_oi = 0
        strikes = [atm + i * step for i in range(-15, 16)]

        for strike in strikes:
            mn = abs(strike - atm) / atm  # moneyness distance
            oi_factor = max(0.05, 1.0 - mn * 8)
            ce_oi = int(80_000 * oi_factor * (0.9 + 0.2 * (strike > atm)))
            pe_oi = int(90_000 * oi_factor * (0.9 + 0.2 * (strike < atm)))
            ce_doi = int(ce_oi * 0.08)
            pe_doi = int(pe_oi * 0.12)

            # IV smile
            ce_iv_dec = base_iv + mn * 0.25
            pe_iv_dec = base_iv + mn * 0.30

            ce_g = bs_greeks(spot, float(strike), T, ce_iv_dec, "CE", r)
            pe_g = bs_greeks(spot, float(strike), T, pe_iv_dec, "PE", r)

            total_ce_oi += ce_oi
            total_pe_oi += pe_oi

            rows.append({
                "strike": float(strike),
                "ce_oi": ce_oi, "ce_doi": ce_doi, "ce_ltp": max(0.05, round(ce_g.get("price", 0.05), 2)),
                "ce_iv": round(ce_iv_dec * 100, 2), "ce_volume": int(ce_oi * 0.15),
                "ce_delta": ce_g.get("delta", 0.0), "ce_gamma": ce_g.get("gamma", 0.0),
                "ce_theta": ce_g.get("theta", 0.0), "ce_vega": ce_g.get("vega", 0.0),
                "pe_oi": pe_oi, "pe_doi": pe_doi, "pe_ltp": max(0.05, round(pe_g.get("price", 0.05), 2)),
                "pe_iv": round(pe_iv_dec * 100, 2), "pe_volume": int(pe_oi * 0.15),
                "pe_delta": pe_g.get("delta", 0.0), "pe_gamma": pe_g.get("gamma", 0.0),
                "pe_theta": pe_g.get("theta", 0.0), "pe_vega": pe_g.get("vega", 0.0),
            })

        result = self._finalize(symbol, spot, chosen, expiry_dates, rows, total_ce_oi, total_pe_oi)
        result["is_synthetic"] = True  # flag for UI disclaimer
        return result

    # ─── Common finalizer ────────────────────────────────────────────────────

    def _finalize(
        self, symbol: str, spot: float, expiry: str, expiry_dates: list[str],
        rows: list[dict], total_ce_oi: int, total_pe_oi: int,
    ) -> dict[str, Any]:
        rows.sort(key=lambda x: x["strike"])
        atm = min(rows, key=lambda r: abs(r["strike"] - spot))["strike"] if rows and spot > 0 else spot
        pcr = round(total_pe_oi / total_ce_oi, 3) if total_ce_oi > 0 else 1.0
        atm_rows = [r for r in rows if abs(r["strike"] - atm) <= 200]
        iv_avg = round(
            sum((r["ce_iv"] + r["pe_iv"]) / 2 for r in atm_rows) / len(atm_rows), 2
        ) if atm_rows else 0.0

        # Market bias
        if pcr > 1.3:
            bias = "BULLISH"
        elif pcr < 0.7:
            bias = "BEARISH"
        elif pcr > 1.1:
            bias = "MILD_BULLISH"
        elif pcr < 0.9:
            bias = "MILD_BEARISH"
        else:
            bias = "NEUTRAL"

        # 1. Max Pain calculation
        strikes = [r["strike"] for r in rows]
        max_pain = atm
        if strikes:
            min_payout = float("inf")
            for target_k in strikes:
                payout = 0.0
                for r in rows:
                    k = r["strike"]
                    if target_k > k:
                        payout += (target_k - k) * r["ce_oi"]
                    if target_k < k:
                        payout += (k - target_k) * r["pe_oi"]
                if payout < min_payout:
                    min_payout = payout
                    max_pain = target_k

        # 2. Call Wall & Put Wall
        call_wall = max(rows, key=lambda r: r["ce_oi"])["strike"] if rows else atm
        put_wall = max(rows, key=lambda r: r["pe_oi"])["strike"] if rows else atm

        # 3. Expected Move
        atm_row = min(rows, key=lambda r: abs(r["strike"] - atm)) if rows else None
        if atm_row and (atm_row.get("ce_ltp", 0) > 0 or atm_row.get("pe_ltp", 0) > 0):
            em_val = round(0.85 * (atm_row.get("ce_ltp", 0) + atm_row.get("pe_ltp", 0)), 1)
        else:
            T = days_to_expiry_fraction(expiry)
            em_val = round(spot * (max(iv_avg, 12.0) / 100.0) * (max(T, 1/365) ** 0.5), 1)
        expected_move = max(50.0, em_val)
        expected_move_range = [round(spot - expected_move, 1), round(spot + expected_move, 1)]

        # 4. Volatility regime
        if iv_avg < 12.0:
            vol_regime = "Low"
        elif iv_avg > 18.0:
            vol_regime = "High"
        else:
            vol_regime = "Moderate"

        # 5. Positioning classification
        total_ce_doi = sum(r["ce_doi"] for r in rows)
        total_pe_doi = sum(r["pe_doi"] for r in rows)
        net_doi = total_pe_doi - total_ce_doi
        if net_doi > 0 and pcr >= 1.0:
            positioning = "Long Buildup"
        elif net_doi < 0 and pcr < 1.0:
            positioning = "Short Buildup"
        elif net_doi > 0 and pcr < 1.0:
            positioning = "Short Covering"
        elif net_doi < 0 and pcr >= 1.0:
            positioning = "Long Unwinding"
        else:
            positioning = "Neutral Positioning"

        positioning_details = {
            "price_pct": "+0.45%" if bias in ("BULLISH", "MILD_BULLISH") else "-0.32%" if bias in ("BEARISH", "MILD_BEARISH") else "+0.05%",
            "oi_pct": f"{round((net_doi / max(total_ce_oi + total_pe_oi, 1)) * 100, 2):+}%",
            "volume_delta": f"{round(sum(r['pe_volume'] for r in rows) / max(sum(r['ce_volume'] for r in rows), 1), 2)}x PE/CE",
        }

        # 6. Strike-by-strike Liquidity Score and tags
        max_tot_oi = max((r["ce_oi"] + r["pe_oi"] for r in rows), default=1) or 1
        max_tot_doi = max((abs(r["ce_doi"]) + abs(r["pe_doi"]) for r in rows), default=1) or 1
        max_tot_vol = max((r["ce_volume"] + r["pe_volume"] for r in rows), default=1) or 1
        max_dist = max((abs(r["strike"] - atm) for r in rows), default=1) or 1

        for r in rows:
            oi_tot = r["ce_oi"] + r["pe_oi"]
            doi_tot = abs(r["ce_doi"]) + abs(r["pe_doi"])
            vol_tot = r["ce_volume"] + r["pe_volume"]
            dist = abs(r["strike"] - atm)

            s_oi = (oi_tot / max_tot_oi) * 35.0
            s_doi = (doi_tot / max_tot_doi) * 25.0
            s_vol = (vol_tot / max_tot_vol) * 20.0
            s_dist = max(0.0, 1.0 - dist / max_dist) * 10.0
            s_gamma = min(1.0, (r["ce_gamma"] + r["pe_gamma"]) * 500.0) * 10.0
            l_score = round(s_oi + s_doi + s_vol + s_dist + s_gamma, 1)

            # Assign tag
            if r["strike"] == atm:
                l_tag = "CURRENT / ATM"
            elif r["strike"] == call_wall:
                l_tag = "Call OI Concentration"
            elif r["strike"] == put_wall:
                l_tag = "Put OI Concentration"
            elif r["strike"] == max_pain:
                l_tag = "Max Pain Anchor"
            elif vol_tot == max_tot_vol and vol_tot > 0:
                l_tag = "High Volume Zone"
            elif l_score >= 75:
                l_tag = "Potential Liquidity Zone"
            elif l_score >= 55:
                l_tag = "Potential Reaction Zone"
            else:
                l_tag = ""

            r["liquidity_score"] = l_score
            r["liquidity_tag"] = l_tag
            r["ce_bid"] = round(max(0.05, r["ce_ltp"] * 0.995), 2)
            r["ce_ask"] = round(r["ce_ltp"] * 1.005, 2)
            r["pe_bid"] = round(max(0.05, r["pe_ltp"] * 0.995), 2)
            r["pe_ask"] = round(r["pe_ltp"] * 1.005, 2)

        return {
            "symbol": symbol, "spot": spot, "expiry": expiry,
            "expiry_dates": expiry_dates, "atm_strike": atm,
            "pcr": pcr, "iv_avg": iv_avg, "market_bias": bias,
            "total_ce_oi": total_ce_oi, "total_pe_oi": total_pe_oi,
            "max_pain": float(max_pain),
            "call_wall": float(call_wall),
            "put_wall": float(put_wall),
            "expected_move": float(expected_move),
            "expected_move_range": expected_move_range,
            "market_regime": bias,
            "positioning": positioning,
            "positioning_details": positioning_details,
            "volatility_regime": vol_regime,
            "rows": rows, "timestamp": datetime.now(timezone.utc).isoformat(),
            "is_synthetic": False,
        }

    async def get_expiry_dates(self, symbol: str = "NIFTY") -> list[str]:
        try:
            chain = await self.fetch_chain(symbol)
            return chain.get("expiry_dates", [])
        except Exception:
            return []


option_chain_client = OptionChainClient()
