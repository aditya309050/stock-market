"""Strike scoring engine — quantitative 0-100 score for each option strike."""
from __future__ import annotations

from typing import Any


# ─── Scoring weights ──────────────────────────────────────────────────────────
WEIGHT_DELTA = 25       # Ideal delta for directional buyers: 0.35–0.55
WEIGHT_OI = 20          # High OI = good liquidity / positioning
WEIGHT_OI_CHANGE = 20   # Fresh OI buildup is preferred
WEIGHT_IV = 20          # Lower IV relative to avg = cheaper premium
WEIGHT_LIQUIDITY = 15   # Tradeable (OI > 1000, non-zero LTP)


def _score_delta(delta: float, option_type: str) -> float:
    """Score 0–25 based on how close delta is to ideal range (0.35–0.55)."""
    d = abs(delta)
    if 0.40 <= d <= 0.55:
        return 25.0
    elif 0.35 <= d < 0.40 or 0.55 < d <= 0.60:
        return 20.0
    elif 0.30 <= d < 0.35 or 0.60 < d <= 0.65:
        return 14.0
    elif 0.20 <= d < 0.30 or 0.65 < d <= 0.75:
        return 8.0
    else:
        return 2.0


def _score_oi(oi: int, max_oi: int) -> float:
    """Score 0–20 based on relative OI."""
    if max_oi <= 0:
        return 10.0
    ratio = oi / max_oi
    return round(min(20.0, ratio * 20), 2)


def _score_oi_change(doi: int, oi: int) -> float:
    """Score 0–20 based on OI change direction and magnitude."""
    if oi <= 0:
        return 5.0
    pct = doi / oi if oi > 0 else 0
    if doi > 0 and pct > 0.10:
        return 20.0
    elif doi > 0 and pct > 0.05:
        return 16.0
    elif doi > 0:
        return 12.0
    elif doi == 0:
        return 8.0
    else:  # OI unwinding
        return 3.0


def _score_iv(iv: float, avg_iv: float) -> float:
    """Score 0–20: lower IV relative to avg IV is better for buyers."""
    if avg_iv <= 0:
        return 10.0
    ratio = iv / avg_iv
    if ratio < 0.85:
        return 20.0
    elif ratio < 1.0:
        return 16.0
    elif ratio < 1.10:
        return 12.0
    elif ratio < 1.25:
        return 8.0
    else:
        return 4.0


def _score_liquidity(oi: int, ltp: float) -> float:
    """Score 0–15 based on whether the strike is tradeable."""
    if ltp <= 0 or oi <= 0:
        return 0.0
    if oi >= 50_000 and ltp > 5:
        return 15.0
    elif oi >= 10_000:
        return 12.0
    elif oi >= 5_000:
        return 9.0
    elif oi >= 1_000:
        return 5.0
    else:
        return 1.0


def score_strikes(
    chain_data: dict[str, Any],
    bias: str = "BULLISH",
    num_candidates: int = 3,
) -> list[dict[str, Any]]:
    """
    Score every strike in the chain and return top `num_candidates` candidates.

    Args:
        chain_data: Output from option_chain_client.fetch_chain()
        bias: "BULLISH" (focus CE), "BEARISH" (focus PE), "NEUTRAL" (both)
        num_candidates: Number of top candidates to return

    Returns:
        List of candidate dicts sorted by score descending.
    """
    rows: list[dict] = chain_data.get("rows", [])
    spot = chain_data.get("spot", 0)
    atm = chain_data.get("atm_strike", spot)
    avg_iv = chain_data.get("iv_avg", 20.0)

    if not rows or spot <= 0:
        return []

    # Restrict to ATM ± 15 strikes for meaningful candidates
    atm_window = sorted(rows, key=lambda r: abs(r["strike"] - atm))[:31]

    # Max OI for normalization
    if bias in ("BULLISH", "NEUTRAL"):
        max_ce_oi = max((r["ce_oi"] for r in atm_window), default=1) or 1
    if bias in ("BEARISH", "NEUTRAL"):
        max_pe_oi = max((r["pe_oi"] for r in atm_window), default=1) or 1

    candidates: list[dict] = []

    for row in atm_window:
        strike = row["strike"]
        dist_from_atm = abs(strike - atm)

        if bias in ("BULLISH", "NEUTRAL"):
            # Score CE side
            if row["ce_ltp"] > 0 and row["ce_oi"] > 0:
                s_delta = _score_delta(row["ce_delta"], "CE")
                s_oi = _score_oi(row["ce_oi"], max_ce_oi)
                s_doi = _score_oi_change(row["ce_doi"], row["ce_oi"])
                s_iv = _score_iv(row["ce_iv"], avg_iv)
                s_liq = _score_liquidity(row["ce_oi"], row["ce_ltp"])
                total = s_delta + s_oi + s_doi + s_iv + s_liq

                # Slight bonus for near-ATM
                if dist_from_atm <= 100:
                    total = min(100, total + 3)

                candidates.append({
                    "strike": strike,
                    "option_type": "CE",
                    "ltp": row["ce_ltp"],
                    "delta": row["ce_delta"],
                    "gamma": row["ce_gamma"],
                    "theta": row["ce_theta"],
                    "vega": row["ce_vega"],
                    "iv": row["ce_iv"],
                    "oi": row["ce_oi"],
                    "oi_change": row["ce_doi"],
                    "volume": row["ce_volume"],
                    "score": round(total, 1),
                    "score_breakdown": {
                        "delta": round(s_delta, 1),
                        "oi": round(s_oi, 1),
                        "oi_change": round(s_doi, 1),
                        "iv": round(s_iv, 1),
                        "liquidity": round(s_liq, 1),
                    },
                })

        if bias in ("BEARISH", "NEUTRAL"):
            # Score PE side
            if row["pe_ltp"] > 0 and row["pe_oi"] > 0:
                s_delta = _score_delta(row["pe_delta"], "PE")
                s_oi = _score_oi(row["pe_oi"], max_pe_oi)
                s_doi = _score_oi_change(row["pe_doi"], row["pe_oi"])
                s_iv = _score_iv(row["pe_iv"], avg_iv)
                s_liq = _score_liquidity(row["pe_oi"], row["pe_ltp"])
                total = s_delta + s_oi + s_doi + s_iv + s_liq

                if dist_from_atm <= 100:
                    total = min(100, total + 3)

                candidates.append({
                    "strike": strike,
                    "option_type": "PE",
                    "ltp": row["pe_ltp"],
                    "delta": row["pe_delta"],
                    "gamma": row["pe_gamma"],
                    "theta": row["pe_theta"],
                    "vega": row["pe_vega"],
                    "iv": row["pe_iv"],
                    "oi": row["pe_oi"],
                    "oi_change": row["pe_doi"],
                    "volume": row["pe_volume"],
                    "score": round(total, 1),
                    "score_breakdown": {
                        "delta": round(s_delta, 1),
                        "oi": round(s_oi, 1),
                        "oi_change": round(s_doi, 1),
                        "iv": round(s_iv, 1),
                        "liquidity": round(s_liq, 1),
                    },
                })

    # Sort by score descending, deduplicate same strike+type
    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates[:num_candidates]
