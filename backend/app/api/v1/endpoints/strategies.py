from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.schemas.strategy import Strategy, StrategyCreate
from app.models.user import User
from app.services.strategy import strategy_service

router = APIRouter()

@router.get("/", response_model=List[Strategy])
async def read_strategies(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return await strategy_service.get_strategies(db, owner_id=current_user.id)

@router.post("/", response_model=Strategy)
async def create_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_in: StrategyCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return await strategy_service.create_strategy(db=db, item=item_in, owner_id=current_user.id)

@router.delete("/{strategy_id}")
async def delete_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    strategy_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    await strategy_service.remove_strategy(db=db, strategy_id=strategy_id, owner_id=current_user.id)
    return {"msg": "Strategy deleted"}

@router.patch("/{strategy_id}/toggle", response_model=Strategy)
async def toggle_strategy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    strategy_id: int,
    activate: bool,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return await strategy_service.toggle_activation(db, strategy_id, current_user.id, activate)
