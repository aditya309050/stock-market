from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.models.user import User
from app.api import deps
from app.services.social import social_service

router = APIRouter()

class CopyTradeRequest(BaseModel):
    published_strategy_id: int
    allocation_pct: float = 10.0

@router.post("/follow")
async def follow_strategy(
    request: CopyTradeRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Subscribe to a published strategy for copy trading."""
    return await social_service.follow_strategy(
        follower_id=current_user.id,
        published_strategy_id=request.published_strategy_id,
        allocation_pct=request.allocation_pct,
    )

@router.post("/unfollow/{published_strategy_id}")
async def unfollow_strategy(
    published_strategy_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Unsubscribe from a strategy."""
    return await social_service.unfollow_strategy(
        follower_id=current_user.id,
        published_strategy_id=published_strategy_id,
    )
