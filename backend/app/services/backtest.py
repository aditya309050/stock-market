import pandas as pd
import vectorbt as vbt
from typing import Dict, Any

class BacktestService:
    def run_backtest(self, price_data: list[float], fast_window: int = 10, slow_window: int = 50) -> Dict[str, Any]:
        """
        Runs a moving average crossover backtest using vectorbt.
        This is a parameterized sample logic to avoid raw code execution.
        """
        if len(price_data) < slow_window:
            return {"error": "Not enough data for the specified slow window"}

        # Create pandas series
        price_series = pd.Series(price_data)

        # Calculate moving averages
        fast_ma = vbt.MA.run(price_series, window=fast_window)
        slow_ma = vbt.MA.run(price_series, window=slow_window)

        # Generate entry and exit signals
        entries = fast_ma.ma_crossed_above(slow_ma)
        exits = fast_ma.ma_crossed_below(slow_ma)

        # Build the portfolio and simulate
        portfolio = vbt.Portfolio.from_signals(price_series, entries, exits, init_cash=10000)

        # Get performance stats
        stats = portfolio.stats()
        
        return {
            "total_return_pct": float(stats.get('Total Return [%]', 0.0)),
            "win_rate_pct": float(stats.get('Win Rate [%]', 0.0)),
            "max_drawdown_pct": float(stats.get('Max Drawdown [%]', 0.0)),
            "total_trades": int(stats.get('Total Trades', 0))
        }

backtest_service = BacktestService()
