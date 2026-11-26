from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class BacktestRequest(BaseModel):
    strategy: str = Field("GOLDEN_CROSS", description="GOLDEN_CROSS, SWING_PULLBACK, ORB_BREAKOUT")
    universe: str = Field("NIFTY 50", description="NIFTY 50, NIFTY 100, NIFTY 500")
    lookback_years: int = Field(2, ge=1, le=5, description="Historical data lookback period in years")
    target_pct: float = Field(12.0, ge=1.0, le=50.0, description="Take-profit target percentage")
    stop_loss_pct: float = Field(5.0, ge=1.0, le=30.0, description="Stop-loss percentage")
    rsi_filter_max: float = Field(65.0, ge=30.0, le=90.0, description="Maximum entry RSI threshold")
    initial_capital: float = Field(100000.0, ge=10000.0, description="Starting test portfolio capital in INR")
    custom_symbol: Optional[str] = Field(None, description="Optional single stock to test (e.g. RELIANCE, TCS)")


class EquityPoint(BaseModel):
    date: str
    equity: float
    benchmark: float
    drawdown_pct: float


class BacktestTradeItem(BaseModel):
    id: int
    symbol: str
    entry_date: str
    entry_price: float
    exit_date: str
    exit_price: float
    pnl_pct: float
    pnl_amount: float
    holding_days: int
    exit_reason: str  # "TARGET", "STOP_LOSS", "REVERSE_CROSS", "OPEN"
    is_win: bool


class BacktestSummary(BaseModel):
    strategy: str
    universe: str
    lookback_years: int
    initial_capital: float
    final_capital: float
    net_profit: float
    total_return_pct: float
    benchmark_return_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate_pct: float
    profit_factor: float
    max_drawdown_pct: float
    avg_trade_pnl_pct: float
    avg_holding_days: float


class BacktestResponse(BaseModel):
    summary: BacktestSummary
    equity_curve: List[EquityPoint]
    trades: List[BacktestTradeItem]
