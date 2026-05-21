from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.schemas.portfolio import Portfolio, PortfolioCreate
from app.models.user import User
from app.services.portfolio import portfolio_service

router = APIRouter()

@router.get("/", response_model=List[Portfolio])
async def read_portfolios(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return await portfolio_service.get_portfolios(db, owner_id=current_user.id)

@router.post("/", response_model=Portfolio)
async def create_portfolio(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_in: PortfolioCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    return await portfolio_service.create_portfolio(db=db, item=item_in, owner_id=current_user.id)
