from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Query

from app.schemas.dhan_order import (
    OrderPlacementRequest,
    OrderPlacementResponse,
    OrderBookItem,
    PositionItem,
)
from app.services.dhan.dhan_order_service import dhan_order_service

router = APIRouter()


@router.post("/place", response_model=OrderPlacementResponse)
async def place_order(req: OrderPlacementRequest) -> OrderPlacementResponse:
    """
    Places an equity or options order via Dhan API v2.
    Supports Market, Limit, Stop-Loss, and simulated Paper Trading.
    """
    return await dhan_order_service.place_order(req)


@router.get("/orders", response_model=list[OrderBookItem])
async def get_orders() -> list[OrderBookItem]:
    """
    Returns the real-time order book (executed, pending, rejected, and paper orders).
    """
    return await dhan_order_service.get_orders()


@router.delete("/orders/{order_id}")
async def cancel_order(order_id: str) -> dict[str, Any]:
    """
    Cancels an open pending order by order_id.
    """
    res = await dhan_order_service.cancel_order(order_id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message", "Cancellation failed."))
    return res


@router.get("/positions", response_model=list[PositionItem])
async def get_positions() -> list[PositionItem]:
    """
    Returns active open and closed trading positions with PnL.
    """
    return await dhan_order_service.get_positions()
