from __future__ import annotations

from pydantic import BaseModel, Field


class SwingTradeItem(BaseModel):
    symbol: str
    timeframe: str = "15m"
    last_price: float
    volume: int = 0
    volume_ratio: float = 1.0
    trend: str = "RANGE"
    structure: str = "SIDEWAYS"
    swing_score: float
    setup_category: str = Field(description="'BREAKOUT', 'PULLBACK', 'NEAR RESISTANCE', 'NEUTRAL'")
    rsi: float
    ema20: float
    ema50: float
    ema200: float
    nearest_resistance: float
    nearest_support: float
    dist_resistance_pct: float
    dist_support_pct: float
    is_breakout: bool
    is_hh_hl: bool
    tags: list[str] = []


class SwingTradeScanResponse(BaseModel):
    scanned: int
    matched: int
    breakout_candidates: list[SwingTradeItem]
    pullback_setups: list[SwingTradeItem]
    near_resistance: list[SwingTradeItem]
    results: list[SwingTradeItem]
