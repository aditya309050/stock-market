from typing import Any, List
from fastapi import APIRouter, Depends
from app.schemas.screener import ScreenerCriteria, ScreenerResult
from app.services.screener import screener_service
from app.models.user import User
from app.api import deps

router = APIRouter()

@router.post("/run", response_model=List[ScreenerResult])
async def run_screener(
    criteria: ScreenerCriteria,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Run stock screener based on provided criteria"""
    results = await screener_service.run_screener(criteria)
    return results
