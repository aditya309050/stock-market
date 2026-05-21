from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.watchlist import watchlist_repo
from app.schemas.watchlist import WatchlistCreate
from app.models.watchlist import Watchlist
from typing import List
from app.core.exceptions import NotFoundException

class WatchlistService:
    async def add_item(self, db: AsyncSession, item: WatchlistCreate, owner_id: int) -> Watchlist:
        return await watchlist_repo.create_with_owner(db, obj_in=item, owner_id=owner_id)

    async def get_items(self, db: AsyncSession, owner_id: int) -> List[Watchlist]:
        return await watchlist_repo.get_by_owner(db, owner_id=owner_id)

    async def remove_item(self, db: AsyncSession, item_id: int, owner_id: int):
        item = await watchlist_repo.get(db, id=item_id)
        if not item or item.owner_id != owner_id:
            raise NotFoundException("Watchlist item not found")
        return await watchlist_repo.remove(db, id=item_id)

watchlist_service = WatchlistService()
