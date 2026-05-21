from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.strategy import strategy_repo
from app.schemas.strategy import StrategyCreate
from app.models.strategy import Strategy
from typing import List
from app.core.exceptions import NotFoundException

class StrategyService:
    async def create_strategy(self, db: AsyncSession, item: StrategyCreate, owner_id: int) -> Strategy:
        return await strategy_repo.create_with_owner(db, obj_in=item, owner_id=owner_id)

    async def get_strategies(self, db: AsyncSession, owner_id: int) -> List[Strategy]:
        return await strategy_repo.get_by_owner(db, owner_id=owner_id)

    async def remove_strategy(self, db: AsyncSession, strategy_id: int, owner_id: int):
        item = await strategy_repo.get(db, id=strategy_id)
        if not item or item.owner_id != owner_id:
            raise NotFoundException("Strategy not found")
        return await strategy_repo.remove(db, id=strategy_id)

    async def toggle_activation(self, db: AsyncSession, strategy_id: int, owner_id: int, activate: bool) -> Strategy:
        item = await strategy_repo.get(db, id=strategy_id)
        if not item or item.owner_id != owner_id:
            raise NotFoundException("Strategy not found")
        
        return await strategy_repo.update(db, db_obj=item, obj_in={"is_active": activate})

strategy_service = StrategyService()
