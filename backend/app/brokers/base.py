from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseBroker(ABC):
    @abstractmethod
    async def get_historical_candles(self, symbol: str, timeframe: str, limit: int) -> List[Dict[str, Any]]:
        """Fetch historical price data"""
        pass

    @abstractmethod
    async def submit_order(self, symbol: str, qty: float, side: str, order_type: str = "market") -> Dict[str, Any]:
        """Submit a buy or sell order"""
        pass

    @abstractmethod
    async def get_positions(self) -> List[Dict[str, Any]]:
        """Get current open positions"""
        pass

    @abstractmethod
    async def get_account_balance(self) -> float:
        """Get total account balance"""
        pass
