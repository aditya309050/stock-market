from typing import Any, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.backtest import backtest_service
from app.models.user import User
from app.api import deps

router = APIRouter()

class BacktestRequest(BaseModel):
    price_data: list[float]
    fast_window: int = 10
    slow_window: int = 50

@router.post("/run")
async def run_backtest(
    request: BacktestRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Run a vectorized backtest on provided data."""
    results = backtest_service.run_backtest(
        price_data=request.price_data,
        fast_window=request.fast_window,
        slow_window=request.slow_window
    )
    return results
