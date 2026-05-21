import random
import datetime
from typing import List, Dict, Any
from app.brokers.base import BaseBroker

class MockBroker(BaseBroker):
    async def get_historical_candles(self, symbol: str, timeframe: str, limit: int) -> List[Dict[str, Any]]:
        candles = []
        now = datetime.datetime.now()
        for i in range(limit):
            candles.append({
                "timestamp": now - datetime.timedelta(days=limit-i),
                "open": random.uniform(100, 200),
                "high": random.uniform(200, 220),
                "low": random.uniform(80, 100),
                "close": random.uniform(100, 200),
                "volume": random.randint(1000, 100000)
            })
        return candles

    async def submit_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> Dict[str, Any]:
        return {
            "order_id": f"mock_{random.randint(1000,9999)}",
            "symbol": symbol,
            "qty": qty,
            "side": side,
            "status": "filled",
            "filled_price": random.uniform(100, 200)
        }

    async def get_positions(self) -> List[Dict[str, Any]]:
        return [
            {"symbol": "AAPL", "qty": 10, "current_price": 150.0},
            {"symbol": "TSLA", "qty": 5, "current_price": 200.0}
        ]

    async def get_account_balance(self) -> float:
        return 100000.0
