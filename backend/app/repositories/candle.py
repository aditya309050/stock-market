from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.candle import Candle
from app.schemas.candle import CandleCreate, CandleUpdate
from app.repositories.base import BaseRepository

class CandleRepository(BaseRepository[Candle, CandleCreate, CandleUpdate]):
    async def get_by_symbol(
        self, db: AsyncSession, *, symbol: str, timeframe: str, limit: int = 100
    ) -> List[Candle]:
        query = (
            select(Candle)
            .where(Candle.symbol == symbol, Candle.timeframe == timeframe)
            .order_by(Candle.timestamp.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        return list(result.scalars().all())

candle_repo = CandleRepository(Candle)
