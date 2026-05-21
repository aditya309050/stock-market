"""
Advanced quant analytics service.
Provides statistical modeling utilities for the analytics dashboard.
"""
import math
import random
from typing import List, Dict, Any


class QuantService:
    def sharpe_ratio(self, returns: List[float], risk_free_rate: float = 0.02) -> float:
        """Calculate annualized Sharpe ratio from a list of daily returns."""
        if len(returns) < 2:
            return 0.0
        mean_return = sum(returns) / len(returns)
        std_dev = math.sqrt(sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1))
        if std_dev == 0:
            return 0.0
        daily_sharpe = (mean_return - risk_free_rate / 252) / std_dev
        return round(daily_sharpe * math.sqrt(252), 4)

    def sortino_ratio(self, returns: List[float], risk_free_rate: float = 0.02) -> float:
        """Sortino ratio — penalises only downside volatility."""
        if len(returns) < 2:
            return 0.0
        mean_return = sum(returns) / len(returns)
        downside = [r for r in returns if r < 0]
        if not downside:
            return float("inf")
        downside_dev = math.sqrt(sum(r ** 2 for r in downside) / len(downside))
        if downside_dev == 0:
            return 0.0
        daily_sortino = (mean_return - risk_free_rate / 252) / downside_dev
        return round(daily_sortino * math.sqrt(252), 4)

    def max_drawdown(self, equity_curve: List[float]) -> float:
        """Calculate maximum drawdown from an equity curve."""
        if not equity_curve:
            return 0.0
        peak = equity_curve[0]
        max_dd = 0.0
        for val in equity_curve:
            if val > peak:
                peak = val
            dd = (peak - val) / peak if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
        return round(max_dd * 100, 2)

    def portfolio_summary(self) -> Dict[str, Any]:
        """Generate a mock quant summary for the dashboard."""
        returns = [random.uniform(-0.03, 0.04) for _ in range(252)]
        equity = [100_000]
        for r in returns:
            equity.append(equity[-1] * (1 + r))

        return {
            "sharpe_ratio": self.sharpe_ratio(returns),
            "sortino_ratio": self.sortino_ratio(returns),
            "max_drawdown_pct": self.max_drawdown(equity),
            "total_return_pct": round((equity[-1] / equity[0] - 1) * 100, 2),
            "win_rate_pct": round(len([r for r in returns if r > 0]) / len(returns) * 100, 1),
        }


quant_service = QuantService()
