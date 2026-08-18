import unittest
import pandas as pd
from app.services.indicators.dma_engine import calculate_dma_metrics


class TestDMAEngine(unittest.TestCase):
    def test_calculate_dma_metrics_golden_cross(self):
        # Create 250 rows where prices start low, then surge to force 50 DMA > 200 DMA
        prices = [100.0] * 180 + [100.0 + i * 2.0 for i in range(70)]
        df = pd.DataFrame({
            "open": prices,
            "high": [p + 1 for p in prices],
            "low": [p - 1 for p in prices],
            "close": prices,
            "volume": [10000] * len(prices)
        })

        metrics = calculate_dma_metrics(df, symbol="MIDHANI")
        self.assertIsNotNone(metrics)
        self.assertEqual(metrics.symbol, "MIDHANI")
        self.assertTrue(metrics.dma50 > 0)
        self.assertTrue(metrics.dma200 > 0)
        self.assertIn(metrics.status, ["provisional", "confirmed"])

    def test_calculate_dma_near_cross(self):
        # 50 DMA below 200 DMA with small gap <= 3%
        prices = [200.0] * 200 + [195.0] * 50
        df = pd.DataFrame({
            "open": prices,
            "high": prices,
            "low": prices,
            "close": prices,
            "volume": [5000] * len(prices)
        })

        metrics = calculate_dma_metrics(df, symbol="RELIANCE")
        self.assertIsNotNone(metrics)
        self.assertLessEqual(metrics.gap_pct, 10.0)


if __name__ == "__main__":
    unittest.main()
