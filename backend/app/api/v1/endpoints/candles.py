from typing import Any
from fastapi import APIRouter, Depends
from app.workers.tasks import ingest_historical_candles
from app.models.user import User
from app.api import deps

router = APIRouter()

@router.post("/ingest")
async def trigger_ingestion(
    symbol: str,
    timeframe: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Trigger background job to ingest historical data."""
    task = ingest_historical_candles.delay(symbol, timeframe)
    return {"msg": f"Ingestion task started for {symbol}", "task_id": task.id}
