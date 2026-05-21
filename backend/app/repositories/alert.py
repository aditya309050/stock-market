from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertUpdate
from app.repositories.base import BaseRepository

class AlertRepository(BaseRepository[Alert, AlertCreate, AlertUpdate]):
    async def get_by_owner(
        self, db: AsyncSession, *, owner_id: int, skip: int = 0, limit: int = 100
    ) -> List[Alert]:
        query = select(Alert).where(Alert.owner_id == owner_id).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def create_with_owner(
        self, db: AsyncSession, *, obj_in: AlertCreate, owner_id: int
    ) -> Alert:
        db_obj = Alert(**obj_in.model_dump(), owner_id=owner_id)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

alert_repo = AlertRepository(Alert)
