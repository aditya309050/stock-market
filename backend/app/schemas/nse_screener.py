from pydantic import BaseModel, Field
from typing import Optional


class NSEScanFilters(BaseModel):
    """When auto=True (default), all indicators run — no manual filters needed."""
    auto: bool = True
    timeframes: list[str] = Field(default=["1d", "1h", "2h"])
    index: str = "NIFTY 500"

    # RSI
    rsi_min: Optional[float] = None
    rsi_max: Optional[float] = None

    # MACD / EMA
    macd_bullish_cross: bool = False
    above_ema20: bool = False
    above_ema50: bool = False
    above_ema200: bool = False

    # Volume / breakouts
    high_volume: bool = False
    swing_high_breakout: bool = False
    swing_low_breakout: bool = False
    volume_breakout: bool = False
    consolidation_breakout: bool = False
    resistance_breakout: bool = False

    # Patterns
    gap_up: bool = False
    gap_down: bool = False
    bullish_engulfing: bool = False
    bearish_engulfing: bool = False

    # Supertrend / ADX
    supertrend_bull: bool = False
    adx_min: Optional[float] = None


class NSEScanRequest(BaseModel):
    filters: NSEScanFilters = Field(default_factory=NSEScanFilters)
    symbols: Optional[list[str]] = None


class NSETimeframeSignal(BaseModel):
    timeframe: str
    signals: dict
    matched: bool


class NSEScanResult(BaseModel):
    symbol: str
    matched_timeframes: list[str]
    signals_by_tf: dict[str, dict]
    ai_score: Optional[float] = None
    swing_signal: Optional[str] = None
    swing_tags: list[str] = Field(default_factory=list)
    ai_note: Optional[str] = None


class NSEScanResponse(BaseModel):
    scanned: int
    matched: int
    results: list[NSEScanResult]
    scan_id: Optional[int] = None
    summary: Optional[str] = None


class NSESymbolInfo(BaseModel):
    symbol: str
    last_price: Optional[float] = None
    change_pct: Optional[float] = None


class NSEMarketOverview(BaseModel):
    gainers: list[NSESymbolInfo]
    losers: list[NSESymbolInfo]
