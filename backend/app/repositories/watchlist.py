from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.watchlist import Watchlist
from app.schemas.watchlist import WatchlistCreate, WatchlistUpdate
from app.repositories.base import BaseRepository

class WatchlistRepository(BaseRepository[Watchlist, WatchlistCreate, WatchlistUpdate]):
    async def get_by_owner(
        self, db: AsyncSession, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> List[Watchlist]:
        query = select(Watchlist).where(Watchlist.owner_id == owner_id).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create_with_owner(
        self, db: AsyncSession, *, obj_in: WatchlistCreate, owner_id: int
    ) -> Watchlist:
        db_obj = Watchlist(symbol=obj_in.symbol, owner_id=owner_id)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

watchlist_repo = WatchlistRepository(Watchlist)
