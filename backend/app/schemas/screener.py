from pydantic import BaseModel
from typing import List, Optional

class ScreenerCriteria(BaseModel):
    min_market_cap: Optional[float] = None
    max_pe_ratio: Optional[float] = None
    min_volume: Optional[int] = None
    sector: Optional[str] = None

class ScreenerResult(BaseModel):
    symbol: str
    market_cap: float
    pe_ratio: float
    volume: int
    sector: str
