"""
Paper Trading Broker — simulates live execution with virtual balances,
realistic slippage modeling, and commission tracking.
"""
import random
import datetime
from typing import List, Dict, Any
from app.brokers.base import BaseBroker


class PaperBroker(BaseBroker):
    """
    Fully in-memory simulation broker.
    Tracks virtual cash, open positions, and trade history.
    """

    def __init__(self, initial_balance: float = 100_000.0):
        self._balance = initial_balance
        self._positions: Dict[str, Dict[str, Any]] = {}
        self._trade_history: List[Dict[str, Any]] = []

    async def get_historical_candles(self, symbol: str, timeframe: str, limit: int) -> List[Dict[str, Any]]:
        """Generate synthetic candles for paper testing."""
        candles = []
        now = datetime.datetime.now()
        base_price = random.uniform(50, 500)
        for i in range(limit):
            o = base_price + random.uniform(-2, 2)
            h = o + random.uniform(0, 5)
            l = o - random.uniform(0, 5)
            c = random.uniform(l, h)
            candles.append({
                "timestamp": now - datetime.timedelta(days=limit - i),
                "open": round(o, 2),
                "high": round(h, 2),
                "low": round(l, 2),
                "close": round(c, 2),
                "volume": random.randint(1_000, 500_000),
            })
            base_price = c  # walk forward
        return candles

    async def submit_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> Dict[str, Any]:
        """Simulate order execution with slippage."""
        base_price = random.uniform(100, 300)
        slippage = base_price * random.uniform(0.0005, 0.002)  # 0.05 – 0.2 %
        filled_price = round(base_price + slippage if side == "buy" else base_price - slippage, 2)
        commission = round(filled_price * qty * 0.001, 2)  # 10 bps

        cost = filled_price * qty + commission
        if side == "buy":
            if cost > self._balance:
                return {"order_id": "paper_rejected", "status": "rejected", "reason": "Insufficient funds"}
            self._balance -= cost
            pos = self._positions.get(symbol, {"qty": 0, "avg_price": 0})
            total_qty = pos["qty"] + qty
            pos["avg_price"] = ((pos["avg_price"] * pos["qty"]) + (filled_price * qty)) / total_qty if total_qty else 0
            pos["qty"] = total_qty
            self._positions[symbol] = pos
        else:
            self._balance += (filled_price * qty) - commission
            pos = self._positions.get(symbol, {"qty": 0, "avg_price": 0})
            pos["qty"] = max(pos["qty"] - qty, 0)
            if pos["qty"] == 0:
                self._positions.pop(symbol, None)
            else:
                self._positions[symbol] = pos

        order = {
            "order_id": f"paper_{random.randint(10000, 99999)}",
            "symbol": symbol,
            "qty": qty,
            "side": side,
            "filled_price": filled_price,
            "commission": commission,
            "status": "filled",
        }
        self._trade_history.append(order)
        return order

    async def get_positions(self) -> List[Dict[str, Any]]:
        return [{"symbol": s, **p} for s, p in self._positions.items()]

    async def get_account_balance(self) -> float:
        return round(self._balance, 2)
