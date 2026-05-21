from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.strategy import Strategy
from app.schemas.strategy import StrategyCreate, StrategyUpdate
from app.repositories.base import BaseRepository

class StrategyRepository(BaseRepository[Strategy, StrategyCreate, StrategyUpdate]):
    async def get_by_owner(
        self, db: AsyncSession, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> List[Strategy]:
        query = select(Strategy).where(Strategy.owner_id == owner_id).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create_with_owner(
        self, db: AsyncSession, *, obj_in: StrategyCreate, owner_id: int
    ) -> Strategy:
        db_obj = Strategy(**obj_in.model_dump(), owner_id=owner_id)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

strategy_repo = StrategyRepository(Strategy)
