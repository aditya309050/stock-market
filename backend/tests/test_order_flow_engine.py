"""Unit tests for the 200-Level Full Market Depth Order Flow Engine."""
import unittest
from app.services.options.order_flow_engine import OrderFlowEngine


class TestOrderFlowEngine(unittest.TestCase):

    def test_order_flow_balanced_book(self):
        engine = OrderFlowEngine("TEST_SEC_1")

        # 200 balanced bids and asks
        bids = [{"price": 100.0 - i * 0.05, "quantity": 1000, "orders": 10} for i in range(200)]
        asks = [{"price": 100.05 + i * 0.05, "quantity": 1000, "orders": 10} for i in range(200)]

        res = engine.calculate(bids, asks)

        self.assertEqual(res["security_id"], "TEST_SEC_1")
        self.assertEqual(res["total_bid_qty"], 200 * 1000)
        self.assertEqual(res["total_ask_qty"], 200 * 1000)
        self.assertAlmostEqual(res["overall_imbalance"], 0.0, places=2)
        self.assertEqual(res["order_flow_score"], 50)  # Neutral 50
        self.assertEqual(len(res["zones"]), 5)
        self.assertEqual(len(res["book_levels"]), 200)
        self.assertAlmostEqual(res["spread"], 0.05, places=2)

    def test_order_flow_bullish_pressure(self):
        engine = OrderFlowEngine("TEST_SEC_2")

        # Strong bid pressure in immediate & near zones
        bids = [{"price": 200.0 - i * 0.05, "quantity": 5000 if i < 20 else 1000, "orders": 25} for i in range(200)]
        asks = [{"price": 200.05 + i * 0.05, "quantity": 1000, "orders": 5} for i in range(200)]

        res = engine.calculate(bids, asks)

        self.assertGreater(res["order_flow_score"], 50)
        self.assertGreater(res["overall_imbalance"], 0.0)

        immediate_zone = res["zones"][0]
        self.assertEqual(immediate_zone["name"], "Immediate")
        self.assertEqual(immediate_zone["weight_pct"], 35)
        self.assertGreater(immediate_zone["imbalance"], 0.5)
        self.assertEqual(immediate_zone["status"], "Strong")

    def test_order_flow_wall_detection(self):
        engine = OrderFlowEngine("TEST_SEC_3")

        bids = [{"price": 50.0 - i * 0.05, "quantity": 100, "orders": 2} for i in range(200)]
        asks = [{"price": 50.05 + i * 0.05, "quantity": 100, "orders": 2} for i in range(200)]

        # Insert a Large Bid Wall at index 12 (Level 13)
        bids[12] = {"price": 49.40, "quantity": 75000, "orders": 85}
        # Insert a Large Ask Wall at index 24 (Level 25)
        asks[24] = {"price": 51.25, "quantity": 42000, "orders": 45}

        res = engine.calculate(bids, asks)

        self.assertIsNotNone(res["bid_wall"])
        self.assertEqual(res["bid_wall"]["level"], 13)
        self.assertEqual(res["bid_wall"]["quantity"], 75000)
        self.assertEqual(res["bid_wall"]["orders"], 85)
        self.assertEqual(res["bid_wall"]["label"], "Large Bid Wall")

        self.assertIsNotNone(res["ask_wall"])
        self.assertEqual(res["ask_wall"]["level"], 25)
        self.assertEqual(res["ask_wall"]["quantity"], 42000)
        self.assertEqual(res["ask_wall"]["orders"], 45)
        self.assertEqual(res["ask_wall"]["label"], "Large Ask Wall")


if __name__ == "__main__":
    unittest.main()
