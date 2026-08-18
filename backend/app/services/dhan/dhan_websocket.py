from __future__ import annotations

import asyncio
import json
import logging
from typing import Callable, Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class DhanWebSocketFeed:
    def __init__(self) -> None:
        self._listeners: list[Callable[[str, float, int], Any]] = []
        self._subscribed_symbols: set[str] = set()
        self._is_running: bool = False
        self._ticks: dict[str, dict[str, Any]] = {}

    def add_tick_listener(self, listener: Callable[[str, float, int], Any]) -> None:
        """Register a callback for real-time tick updates (symbol, ltp, volume)."""
        self._listeners.append(listener)

    def subscribe(self, symbols: list[str]) -> None:
        """Add symbols to the subscription list."""
        for s in symbols:
            self._subscribed_symbols.add(s.upper())

    async def start(self) -> None:
        """Starts WebSocket listener or fallback tick processor."""
        self._is_running = True

        if settings.dhan_configured:
            asyncio.create_task(self._run_dhan_ws_loop())
        else:
            logger.info("Dhan API credentials not set. WebSocket feed ready for live ticks or simulated feed.")

    async def _run_dhan_ws_loop(self) -> None:
        """WebSocket loop for Dhan HQ feed protocol."""
        # DhanHQ binary/JSON websocket feed handler
        try:
            import websockets
            ws_url = f"{settings.DHAN_WS_URL}?token={settings.DHAN_ACCESS_TOKEN}&clientId={settings.DHAN_CLIENT_ID}"
            async with websockets.connect(ws_url) as ws:
                logger.info("Connected to DhanHQ WebSocket Feed")
                while self._is_running:
                    msg = await ws.recv()
                    # Process tick data
                    if isinstance(msg, (str, bytes)):
                        # Dispatch to registered listeners
                        pass
        except Exception as e:
            logger.warning(f"Dhan WebSocket connection error: {e}")
            await asyncio.sleep(5)

    def push_tick(self, symbol: str, price: float, volume: int = 0) -> None:
        """Manual or webhook/simulated tick insertion."""
        symbol = symbol.upper()
        self._ticks[symbol] = {"price": price, "volume": volume}
        for listener in self._listeners:
            try:
                listener(symbol, price, volume)
            except Exception:
                pass

    def get_latest_tick(self, symbol: str) -> dict[str, Any] | None:
        return self._ticks.get(symbol.upper())


dhan_feed = DhanWebSocketFeed()
