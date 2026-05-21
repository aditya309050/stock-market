from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.models.user import User
from app.api import deps
from app.brokers.paper_broker import PaperBroker

router = APIRouter()
# Simple mock instance
paper_broker_instance = PaperBroker(initial_balance=100000.0)

class PaperOrderRequest(BaseModel):
    symbol: str
    qty: float
    side: str
    order_type: str = "market"

@router.get("/balance")
async def get_paper_balance(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get paper trading balance."""
    return {"balance": await paper_broker_instance.get_account_balance()}

@router.post("/order")
async def submit_paper_order(
    request: PaperOrderRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Submit a paper trade with simulated slippage and commission."""
    return await paper_broker_instance.submit_order(
        symbol=request.symbol,
        qty=request.qty,
        side=request.side,
        order_type=request.order_type,
    )
