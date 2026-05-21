from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.portfolio import Portfolio
from app.schemas.portfolio import PortfolioCreate, PortfolioUpdate
from app.repositories.base import BaseRepository

class PortfolioRepository(BaseRepository[Portfolio, PortfolioCreate, PortfolioUpdate]):
    async def get_by_owner(
        self, db: AsyncSession, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> List[Portfolio]:
        query = select(Portfolio).where(Portfolio.owner_id == owner_id).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create_with_owner(
        self, db: AsyncSession, *, obj_in: PortfolioCreate, owner_id: int
    ) -> Portfolio:
        db_obj = Portfolio(**obj_in.model_dump(), owner_id=owner_id)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

portfolio_repo = PortfolioRepository(Portfolio)
