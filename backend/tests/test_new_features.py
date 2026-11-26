import unittest
import asyncio
import httpx
from app.main import app


class TestNewFeatures(unittest.TestCase):
    def test_new_routes(self):
        async def run_probes():
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Dhan Orders Endpoint
                res_orders = await client.get("/api/v1/dhan/orders")
                self.assertEqual(res_orders.status_code, 200)

                # Test Dhan Paper Order Placement
                res_place = await client.post(
                    "/api/v1/dhan/place",
                    json={
                        "symbol": "TCS",
                        "transaction_type": "BUY",
                        "product_type": "INTRADAY",
                        "order_type": "MARKET",
                        "quantity": 10,
                        "is_paper_trading": True,
                    },
                )
                self.assertEqual(res_place.status_code, 200)
                data = res_place.json()
                self.assertIn("TRADED", data["order_status"])
                self.assertTrue(data["is_paper"])

                # 2. Alerts Endpoints
                res_status = await client.get("/api/v1/alerts/status")
                self.assertEqual(res_status.status_code, 200)

                res_test_alert = await client.post("/api/v1/alerts/test")
                self.assertEqual(res_test_alert.status_code, 200)

                res_history = await client.get("/api/v1/alerts/history")
                self.assertEqual(res_history.status_code, 200)
                self.assertTrue(len(res_history.json()) > 0)

                # 3. Backtest Presets
                res_presets = await client.get("/api/v1/backtest/presets")
                self.assertEqual(res_presets.status_code, 200)
                presets = res_presets.json()
                self.assertTrue(len(presets) >= 2)

        asyncio.run(run_probes())


if __name__ == "__main__":
    unittest.main()
