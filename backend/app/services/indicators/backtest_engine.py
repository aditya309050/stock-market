from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import math
from typing import Any, List, Optional
import numpy as np
import pandas as pd

from app.schemas.backtest import (
    BacktestRequest,
    BacktestResponse,
    BacktestSummary,
    BacktestTradeItem,
    EquityPoint,
)
from app.services.indicators.golden_cross_engine import calculate_rsi
from app.services.nse.client import nse_client


class BacktestEngine:
    async def run_backtest(self, req: BacktestRequest) -> BacktestResponse:
        """
        Executes an algorithmic backtest across historical candles for the specified strategy.
        """
        # Determine candidate symbols
        symbols: list[str] = []
        if req.custom_symbol and req.custom_symbol.strip():
            symbols = [req.custom_symbol.strip().upper()]
        else:
            try:
                symbols = await nse_client.get_index_symbols(req.universe)
            except Exception:
                symbols = []
            if not symbols:
                symbols = [
                    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN",
                    "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK", "MARUTI", "TITAN",
                    "SUNPHARMA", "BAJFINANCE", "TATAMOTORS", "TATASTEEL", "NTPC",
                ]

        # Limit to top 20 symbols for fast responsive execution
        symbols = symbols[:20]
        candles_limit = min(800, req.lookback_years * 260)

        # Concurrently fetch OHLC for universe
        sem = asyncio.Semaphore(10)
        all_trades: list[BacktestTradeItem] = []

        async def process_symbol(sym: str):
            clean = sym.strip().upper().replace(".NS", "")
            async with sem:
                try:
                    df = await nse_client.fetch_ohlc(clean, timeframe="1d", limit=candles_limit)
                    if df is None or len(df) < 220:
                        return
                    trades = self._simulate_strategy_on_symbol(clean, df, req)
                    all_trades.extend(trades)
                except Exception:
                    pass

        await asyncio.gather(*(process_symbol(s) for s in symbols))

        # Sort trades chronologically
        all_trades.sort(key=lambda t: t.entry_date)
        for i, t in enumerate(all_trades):
            t.id = i + 1

        # Calculate Portfolio Metrics & Equity Curve
        return self._generate_portfolio_results(req, all_trades)

    def _simulate_strategy_on_symbol(
        self,
        symbol: str,
        df: pd.DataFrame,
        req: BacktestRequest,
    ) -> list[BacktestTradeItem]:
        """Runs the rule-based entry/exit simulation on historical daily candles."""
        trades: list[BacktestTradeItem] = []
        close = df["close"].astype(float)
        high = df["high"].astype(float)
        low = df["low"].astype(float)
        dates = df.index

        sma50 = close.rolling(50).mean()
        sma200 = close.rolling(200).mean()
        rsi = calculate_rsi(close, 14)

        in_trade = False
        entry_idx = 0
        entry_price = 0.0
        entry_date = ""

        for i in range(201, len(df)):
            curr_date = str(dates[i])[:10]
            curr_close = float(close.iloc[i])
            curr_high = float(high.iloc[i])
            curr_low = float(low.iloc[i])

            if not in_trade:
                # ENTRY CONDITIONS
                if req.strategy == "GOLDEN_CROSS":
                    # 50 DMA crosses above 200 DMA
                    prev_50 = float(sma50.iloc[i - 1])
                    prev_200 = float(sma200.iloc[i - 1])
                    c_50 = float(sma50.iloc[i])
                    c_200 = float(sma200.iloc[i])
                    c_rsi = float(rsi.iloc[i]) if pd.notna(rsi.iloc[i]) else 50.0

                    if prev_50 <= prev_200 and c_50 > c_200 and c_rsi <= req.rsi_filter_max:
                        in_trade = True
                        entry_idx = i
                        entry_price = curr_close
                        entry_date = curr_date

                elif req.strategy == "SWING_PULLBACK":
                    # Trend filter + pullback to 50 SMA with oversold bounce
                    c_50 = float(sma50.iloc[i])
                    c_rsi = float(rsi.iloc[i]) if pd.notna(rsi.iloc[i]) else 50.0
                    if curr_close > c_50 and 40.0 <= c_rsi <= 55.0 and (curr_close - c_50) / c_50 < 0.03:
                        in_trade = True
                        entry_idx = i
                        entry_price = curr_close
                        entry_date = curr_date
                else:
                    # Default: Simple moving average crossover
                    if float(sma50.iloc[i]) > float(sma200.iloc[i]) and float(sma50.iloc[i - 1]) <= float(sma200.iloc[i - 1]):
                        in_trade = True
                        entry_idx = i
                        entry_price = curr_close
                        entry_date = curr_date

            else:
                # EXIT CONDITIONS
                gain_pct = (curr_high - entry_price) / entry_price * 100
                loss_pct = (curr_low - entry_price) / entry_price * 100

                target_hit = gain_pct >= req.target_pct
                sl_hit = loss_pct <= -req.stop_loss_pct
                crossover_exit = float(sma50.iloc[i]) < float(sma200.iloc[i]) if pd.notna(sma50.iloc[i]) else False

                if target_hit or sl_hit or crossover_exit or i == (len(df) - 1):
                    exit_reason = "TARGET" if target_hit else ("STOP_LOSS" if sl_hit else "REVERSE_CROSS")
                    exit_price = (
                        entry_price * (1 + req.target_pct / 100)
                        if target_hit
                        else (entry_price * (1 - req.stop_loss_pct / 100) if sl_hit else curr_close)
                    )
                    pnl_pct = (exit_price - entry_price) / entry_price * 100
                    pnl_amount = (pnl_pct / 100) * (req.initial_capital * 0.1)  # 10% capital per trade
                    holding_days = i - entry_idx

                    trades.append(
                        BacktestTradeItem(
                            id=0,
                            symbol=symbol,
                            entry_date=entry_date,
                            entry_price=round(entry_price, 2),
                            exit_date=curr_date,
                            exit_price=round(exit_price, 2),
                            pnl_pct=round(pnl_pct, 2),
                            pnl_amount=round(pnl_amount, 2),
                            holding_days=max(1, holding_days),
                            exit_reason=exit_reason,
                            is_win=pnl_pct > 0,
                        )
                    )
                    in_trade = False

        return trades

    def _generate_portfolio_results(
        self,
        req: BacktestRequest,
        trades: list[BacktestTradeItem],
    ) -> BacktestResponse:
        """Computes summary statistics and step-wise equity curve."""
        capital = req.initial_capital
        benchmark_capital = req.initial_capital
        peak = capital

        equity_curve: list[EquityPoint] = []
        # Initial point
        start_date = (datetime.now() - timedelta(days=req.lookback_years * 365)).strftime("%Y-%m-%d")
        equity_curve.append(
            EquityPoint(date=start_date, equity=capital, benchmark=benchmark_capital, drawdown_pct=0.0)
        )

        winning_trades = sum(1 for t in trades if t.is_win)
        losing_trades = len(trades) - winning_trades
        win_rate = (winning_trades / len(trades) * 100) if trades else 0.0

        gross_profit = sum(t.pnl_amount for t in trades if t.pnl_amount > 0)
        gross_loss = abs(sum(t.pnl_amount for t in trades if t.pnl_amount < 0))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 1.0)

        max_dd = 0.0

        for t in trades:
            capital += t.pnl_amount
            benchmark_capital *= 1.002  # standard benchmark gradual growth
            if capital > peak:
                peak = capital
            dd = (capital - peak) / peak * 100 if peak > 0 else 0.0
            if dd < max_dd:
                max_dd = dd

            equity_curve.append(
                EquityPoint(
                    date=t.exit_date,
                    equity=round(capital, 2),
                    benchmark=round(benchmark_capital, 2),
                    drawdown_pct=round(dd, 2),
                )
            )

        net_profit = capital - req.initial_capital
        total_return_pct = (net_profit / req.initial_capital) * 100
        benchmark_return_pct = ((benchmark_capital - req.initial_capital) / req.initial_capital) * 100
        avg_holding = (sum(t.holding_days for t in trades) / len(trades)) if trades else 0.0
        avg_pnl = (sum(t.pnl_pct for t in trades) / len(trades)) if trades else 0.0

        summary = BacktestSummary(
            strategy=req.strategy,
            universe=req.universe if not req.custom_symbol else req.custom_symbol,
            lookback_years=req.lookback_years,
            initial_capital=req.initial_capital,
            final_capital=round(capital, 2),
            net_profit=round(net_profit, 2),
            total_return_pct=round(total_return_pct, 2),
            benchmark_return_pct=round(benchmark_return_pct, 2),
            total_trades=len(trades),
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate_pct=round(win_rate, 1),
            profit_factor=round(profit_factor, 2),
            max_drawdown_pct=round(abs(max_dd), 2),
            avg_trade_pnl_pct=round(avg_pnl, 2),
            avg_holding_days=round(avg_holding, 1),
        )

        return BacktestResponse(
            summary=summary,
            equity_curve=equity_curve,
            trades=trades,
        )


backtest_engine = BacktestEngine()
