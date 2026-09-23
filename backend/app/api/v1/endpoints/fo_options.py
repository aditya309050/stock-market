"""F&O Options Engine — FastAPI endpoints."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app.services.options.chain import option_chain_client
from app.services.options.scorer import score_strikes
from app.services.options.ai_validator import validate_candidate
from app.schemas.options import OptionChainResponse, OptionCandidatesResponse, OptionCandidate, OptionChainRow

router = APIRouter()

SUPPORTED_SYMBOLS = ["NIFTY", "BANKNIFTY", "MIDCPNIFTY", "FINNIFTY"]


@router.get("/chain", response_model=OptionChainResponse)
async def get_option_chain(
    symbol: str = Query("NIFTY", description="Index symbol: NIFTY, BANKNIFTY, MIDCPNIFTY, FINNIFTY"),
    expiry: Optional[str] = Query(None, description="Expiry date in DD-Mon-YYYY format (e.g. 24-Sep-2026). Defaults to nearest."),
) -> OptionChainResponse:
    """
    Fetch the full option chain for an index, including OI, IV, LTP, and computed Greeks.
    Used to render the option chain table and OI heatmap on the frontend.
    """
    sym = symbol.upper().strip()
    try:
        chain = await option_chain_client.fetch_chain(sym, expiry)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"NSE option chain unavailable: {e}")

    if not chain.get("rows"):
        raise HTTPException(status_code=404, detail=f"No option chain data found for {sym}")

    rows = [OptionChainRow(**r) for r in chain["rows"]]

    return OptionChainResponse(
        symbol=chain["symbol"],
        spot=chain["spot"],
        expiry=chain["expiry"],
        expiry_dates=chain["expiry_dates"],
        atm_strike=chain["atm_strike"],
        pcr=chain["pcr"],
        iv_avg=chain["iv_avg"],
        market_bias=chain["market_bias"],
        total_ce_oi=chain["total_ce_oi"],
        total_pe_oi=chain["total_pe_oi"],
        max_pain=chain.get("max_pain", 0.0),
        call_wall=chain.get("call_wall", 0.0),
        put_wall=chain.get("put_wall", 0.0),
        expected_move=chain.get("expected_move", 0.0),
        expected_move_range=chain.get("expected_move_range", []),
        market_regime=chain.get("market_regime", "NEUTRAL"),
        positioning=chain.get("positioning", "Neutral"),
        positioning_details=chain.get("positioning_details", {}),
        volatility_regime=chain.get("volatility_regime", "Moderate"),
        rows=rows,
        timestamp=chain["timestamp"],
        is_synthetic=chain.get("is_synthetic", False),
    )


@router.get("/candidates", response_model=OptionCandidatesResponse)
async def get_option_candidates(
    symbol: str = Query("NIFTY"),
    expiry: Optional[str] = Query(None),
    bias: str = Query("BULLISH", description="BULLISH, BEARISH, or NEUTRAL"),
    num: int = Query(3, ge=1, le=5, description="Number of candidates to return"),
) -> OptionCandidatesResponse:
    """
    Score all strikes for the given symbol + expiry + bias and return the top candidates
    with full evidence breakdown and optional AI explanation.
    """
    sym = symbol.upper().strip()
    bias_up = bias.upper().strip()
    if bias_up not in ("BULLISH", "BEARISH", "NEUTRAL"):
        bias_up = "BULLISH"

    try:
        chain = await option_chain_client.fetch_chain(sym, expiry)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"NSE option chain unavailable: {e}")

    if not chain.get("rows"):
        raise HTTPException(status_code=404, detail=f"No chain data for {sym}")

    # Score strikes
    raw_candidates = score_strikes(chain, bias=bias_up, num_candidates=num)

    if not raw_candidates:
        raise HTTPException(status_code=404, detail="No scoreable candidates found. Try a different expiry or bias.")

    # Validate each candidate (with AI if configured) — run concurrently
    async def enrich(c: dict) -> OptionCandidate:
        validated = await validate_candidate(c, chain, bias_up)
        return OptionCandidate(**validated)

    enriched = await asyncio.gather(*[enrich(c) for c in raw_candidates])

    return OptionCandidatesResponse(
        symbol=chain["symbol"],
        spot=chain["spot"],
        expiry=chain["expiry"],
        atm_strike=chain["atm_strike"],
        pcr=chain["pcr"],
        iv_avg=chain["iv_avg"],
        market_bias=chain["market_bias"],
        bias_requested=bias_up,
        candidates=list(enriched),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
