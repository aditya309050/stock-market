from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class GoldenCrossItem(BaseModel):
    symbol: str
    company_name: str = ""
    last_price: float
    dma50: float
    dma200: float
    prev_dma50: float = 0.0
    prev_dma200: float = 0.0
    gap_pct: float
    status: str = Field(description="'provisional' or 'confirmed'")
    cross_category: str = Field(default="BULLISH SETUP", description="CROSSED TODAY, RECENT CROSS, ESTABLISHED CROSS, NEAR CROSS")
    is_golden_cross: bool
    is_crossed_today: bool = False
    is_recent_cross: bool = False
    is_established_cross: bool = False
    is_near_cross: bool

    is_above_200: bool
    is_above_50: bool
    score: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)



class GoldenCrossRadarResponse(BaseModel):
    total_scanned: int
    golden_cross_count: int
    near_cross_count: int
    provisional_count: int
    results: list[GoldenCrossItem]


class DhanSyncResponse(BaseModel):
    status: str
    total_instruments: int
    nse_equity_count: int
    message: str
