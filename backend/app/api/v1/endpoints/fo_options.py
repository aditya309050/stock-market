"""F&O Options Engine — FastAPI endpoints."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional, Any

from fastapi import APIRouter, Query, HTTPException

logger = logging.getLogger(__name__)

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


# ─── 200-Level Full Market Depth Order Flow Endpoints ─────────────────────────

from fastapi import WebSocket, WebSocketDisconnect
from app.services.dhan.dhan_depth_client import dhan_depth_client
from app.services.dhan.dhan_fno_service import dhan_fno_service
from app.schemas.options import OrderFlowResponse


@router.get("/orderflow/{security_id}", response_model=OrderFlowResponse)
async def get_order_flow_snapshot(security_id: str) -> OrderFlowResponse:
    """
    Returns immediate 200-level market depth order flow analytics for a given contract Security ID.
    Includes zone breakdown (Immediate, Near, Medium, Deep, Extended), weighted score (0-100),
    Bid/Ask Walls, and full 200-level order book.
    """
    sec = security_id.strip()
    if not sec:
        raise HTTPException(status_code=400, detail="Security ID is required")

    snapshot = await dhan_depth_client.get_snapshot(sec)
    return OrderFlowResponse(**snapshot)


@router.get("/resolve-security-id")
async def resolve_security_id(
    symbol: str = Query("NIFTY"),
    expiry: str = Query(""),
    strike: float = Query(...),
    option_type: str = Query("CE", description="CE or PE"),
) -> dict[str, str]:
    """
    Dynamically resolves the Dhan Security ID for a given (symbol, expiry, strike, option_type).
    """
    sec_id = await dhan_fno_service.get_security_id(symbol, expiry, strike, option_type)
    return {"security_id": sec_id, "symbol": symbol, "expiry": expiry, "strike": str(strike), "option_type": option_type}


@router.websocket("/ws/orderflow/{security_id}")
async def websocket_order_flow(websocket: WebSocket, security_id: str):
    """
    Real-time WebSocket feed streaming 200-level order flow analytics and book updates
    to the frontend.
    """
    await websocket.accept()
    sec = security_id.strip()

    # Send initial snapshot immediately upon connect
    try:
        initial_snapshot = await dhan_depth_client.get_snapshot(sec)
        await websocket.send_json(initial_snapshot)
    except Exception as e:
        logger.warning(f"Error sending initial order flow snapshot for {sec}: {e}")

    queue: asyncio.Queue = asyncio.Queue(maxsize=20)
    loop = asyncio.get_running_loop()

    def on_tick(data: dict[str, Any]):
        try:
            loop.call_soon_threadsafe(
                lambda: queue.put_nowait(data) if not queue.full() else None
            )
        except Exception:
            pass

    dhan_depth_client.add_listener(sec, on_tick)

    try:
        while True:
            data = await queue.get()
            await websocket.send_json(data)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception as e:
        logger.debug(f"WebSocket order flow stream terminated for {sec}: {e}")
    finally:
        dhan_depth_client.remove_listener(sec, on_tick)

