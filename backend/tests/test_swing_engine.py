import unittest
import pandas as pd
from app.services.indicators.swing_engine import (
    find_swing_pivots,
    calculate_swing_metrics,
)


class TestSwingEngine(unittest.TestCase):
    def test_find_swing_pivots(self):
        highs = [10, 12, 15, 13, 11, 14, 18, 16, 12]
        lows = [8, 9, 11, 10, 8, 10, 13, 12, 9]
        closes = [9, 11, 14, 12, 9, 13, 17, 14, 10]
        df = pd.DataFrame({
            "open": closes,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": [1000] * len(highs)
        })

        pivots = find_swing_pivots(df, left=2, right=2)
        self.assertTrue(len(pivots) > 0)
        types = [p.pivot_type for p in pivots]
        self.assertIn("high", types)

    def test_calculate_swing_metrics(self):
        prices = [100.0 + i * 1.5 for i in range(50)]
        volumes = [10000] * 49 + [30000]  # Volume spike on last bar
        highs = [p + 2.0 for p in prices]
        lows = [p - 0.5 for p in prices]
        closes = [p + 1.8 for p in prices]  # Strong close near high

        df = pd.DataFrame({
            "open": prices,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": volumes
        })

        metrics = calculate_swing_metrics(df, symbol="MIDHANI", timeframe="15m")
        self.assertIsNotNone(metrics)
        self.assertEqual(metrics.symbol, "MIDHANI")
        self.assertTrue(metrics.swing_score >= 50.0)
        self.assertIn(metrics.setup_category, ["BREAKOUT", "PULLBACK", "NEAR RESISTANCE", "NEUTRAL"])


if __name__ == "__main__":
    unittest.main()
