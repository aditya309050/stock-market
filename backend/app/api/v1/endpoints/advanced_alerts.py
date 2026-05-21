from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.user import User
from app.services.alert_engine import alert_engine

router = APIRouter()

@router.post("/process")
async def manual_process_alerts(
    symbol: str,
    current_price: float,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Manually trigger alert processing for a symbol."""
    await alert_engine.process_alerts(db, symbol, current_price)
    return {"msg": f"Processed alerts for {symbol}"}
