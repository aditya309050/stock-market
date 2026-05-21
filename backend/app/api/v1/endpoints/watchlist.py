from typing import Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.schemas.watchlist import Watchlist, WatchlistCreate
from app.models.user import User
from app.services.watchlist import watchlist_service

router = APIRouter()

@router.get("/", response_model=List[Watchlist])
async def read_watchlist(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve user's watchlist."""
    items = await watchlist_service.get_items(db, owner_id=current_user.id)
    return items

@router.post("/", response_model=Watchlist)
async def create_watchlist_item(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_in: WatchlistCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create new watchlist item."""
    item = await watchlist_service.add_item(db=db, item=item_in, owner_id=current_user.id)
    return item

@router.delete("/{item_id}")
async def delete_watchlist_item(
    *,
    db: AsyncSession = Depends(deps.get_db),
    item_id: int,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Delete a watchlist item."""
    await watchlist_service.remove_item(db=db, item_id=item_id, owner_id=current_user.id)
    return {"msg": "Item deleted"}
