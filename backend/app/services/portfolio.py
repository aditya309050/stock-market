from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.portfolio import portfolio_repo
from app.schemas.portfolio import PortfolioCreate
from app.models.portfolio import Portfolio
from typing import List

class PortfolioService:
    async def create_portfolio(self, db: AsyncSession, item: PortfolioCreate, owner_id: int) -> Portfolio:
        return await portfolio_repo.create_with_owner(db, obj_in=item, owner_id=owner_id)

    async def get_portfolios(self, db: AsyncSession, owner_id: int) -> List[Portfolio]:
        return await portfolio_repo.get_by_owner(db, owner_id=owner_id)

portfolio_service = PortfolioService()
