from __future__ import annotations

from typing import Any
from fastapi import APIRouter

from app.schemas.backtest import BacktestRequest, BacktestResponse
from app.services.indicators.backtest_engine import backtest_engine

router = APIRouter()


@router.post("/run", response_model=BacktestResponse)
async def run_backtest(req: BacktestRequest) -> BacktestResponse:
    """
    Executes a multi-year quantitative backtest across Indian equity markets.
    Returns win-rate, profit-factor, max drawdown, equity curve, and individual trade journal.
    """
    return await backtest_engine.run_backtest(req)


@router.get("/presets")
def get_strategy_presets() -> list[dict[str, Any]]:
    """Returns curated quantitative strategy presets."""
    return [
        {
            "id": "GOLDEN_CROSS",
            "name": "50/200 DMA Golden Cross Momentum",
            "description": "Enters when 50 DMA crosses above 200 DMA with RSI < 65 confirmation. 12% profit target with 5% trailing risk stop.",
            "strategy": "GOLDEN_CROSS",
            "universe": "NIFTY 50",
            "lookback_years": 2,
            "target_pct": 12.0,
            "stop_loss_pct": 5.0,
            "rsi_filter_max": 65.0,
        },
        {
            "id": "SWING_PULLBACK",
            "name": "Trend EMA Pullback & Bounce",
            "description": "Enters on strong trending stocks pulling back into 50-day average support with RSI between 40-55.",
            "strategy": "SWING_PULLBACK",
            "universe": "NIFTY 100",
            "lookback_years": 2,
            "target_pct": 8.0,
            "stop_loss_pct": 3.5,
            "rsi_filter_max": 55.0,
        },
    ]
