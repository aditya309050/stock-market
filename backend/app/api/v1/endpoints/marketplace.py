from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.models.user import User
from app.api import deps
from app.services.marketplace import marketplace_service

router = APIRouter()

class PublishRequest(BaseModel):
    strategy_id: int
    title: str
    description: str

@router.get("/")
async def list_strategies(skip: int = 0, limit: int = 20) -> Any:
    """List publicly available strategies on the marketplace."""
    return await marketplace_service.list_published(skip, limit)

@router.post("/publish")
async def publish_strategy(
    request: PublishRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Publish a personal strategy to the marketplace."""
    return await marketplace_service.publish_strategy(
        author_id=current_user.id,
        strategy_id=request.strategy_id,
        title=request.title,
        description=request.description,
    )
