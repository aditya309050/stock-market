from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.analytics import AnalyticsDashboardResponse
from app.services.analytics import analytics_service
from app.models.user import User
from app.api import deps

router = APIRouter()

@router.get("/dashboard", response_model=AnalyticsDashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return await analytics_service.get_dashboard_data(db, current_user.id)
