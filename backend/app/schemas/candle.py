from pydantic import BaseModel
from datetime import datetime

class CandleBase(BaseModel):
    symbol: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    timeframe: str

class CandleCreate(CandleBase):
    pass

class CandleUpdate(CandleBase):
    pass

class Candle(CandleBase):
    id: int

    model_config = {"from_attributes": True}
