"""Dhan 200-Level Full Market Depth WebSocket Client and Binary Parser."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
import math
import random
import struct
from typing import Any, Callable, Dict, List, Optional, Set

from app.core.config import settings
from app.services.options.order_flow_engine import OrderFlowEngine
from app.services.dhan.dhan_fno_service import dhan_fno_service

logger = logging.getLogger(__name__)

DHAN_DEPTH_WS_URL = "wss://full-depth-api.dhan.co/twohundreddepth"


class DhanDepthClient:
    """
    Manages connection to Dhan 200-Level Full Market Depth API.
    Handles binary packet unpacking, state caching, and subscriber broadcasting.
    """

    def __init__(self) -> None:
        self._engines: dict[str, OrderFlowEngine] = {}
        self._active_subscriptions: set[str] = set()
        self._listeners: dict[str, set[Callable[[dict[str, Any]], Any]]] = {}
        self._ws_tasks: dict[str, asyncio.Task] = {}
        self._latest_snapshots: dict[str, dict[str, Any]] = {}
        self._is_running = True

    def _get_engine(self, security_id: str) -> OrderFlowEngine:
        if security_id not in self._engines:
            self._engines[security_id] = OrderFlowEngine(security_id)
        return self._engines[security_id]

    def add_listener(self, security_id: str, callback: Callable[[dict[str, Any]], Any]) -> None:
        sec = str(security_id)
        if sec not in self._listeners:
            self._listeners[sec] = set()
        self._listeners[sec].add(callback)
        self.subscribe(sec)

    def remove_listener(self, security_id: str, callback: Callable[[dict[str, Any]], Any]) -> None:
        sec = str(security_id)
        if sec in self._listeners and callback in self._listeners[sec]:
            self._listeners[sec].remove(callback)
            if not self._listeners[sec]:
                del self._listeners[sec]

    def subscribe(self, security_id: str) -> None:
        sec = str(security_id)
        if sec in self._active_subscriptions:
            return
        self._active_subscriptions.add(sec)

        # Launch background task for this security_id (Dhan depth is 1 instrument per connection)
        task = asyncio.create_task(self._run_feed_loop(sec))
        self._ws_tasks[sec] = task

    async def get_snapshot(self, security_id: str) -> dict[str, Any]:
        """Returns the latest order flow snapshot or generates a current calculation."""
        sec = str(security_id)
        if sec in self._latest_snapshots:
            return self._latest_snapshots[sec]

        # Generate initial calculation
        engine = self._get_engine(sec)
        inst_info = await dhan_fno_service.get_instrument_details(sec) or {"security_id": sec}
        bids, asks = self._generate_realistic_200_depth(sec, inst_info)
        snapshot = engine.calculate(bids, asks, inst_info)
        self._latest_snapshots[sec] = snapshot
        return snapshot

    async def _run_feed_loop(self, security_id: str) -> None:
        """
        Connects to Dhan 200-depth WebSocket if credentials are set,
        otherwise runs high-frequency realistic order flow simulation.
        """
        sec = str(security_id)
        inst_info = await dhan_fno_service.get_instrument_details(sec) or {"security_id": sec}

        if settings.dhan_configured:
            ws_url = (
                f"{DHAN_DEPTH_WS_URL}?"
                f"token={settings.DHAN_ACCESS_TOKEN}&"
                f"clientId={settings.DHAN_CLIENT_ID}&authType=2"
            )
            while self._is_running and sec in self._active_subscriptions:
                try:
                    import websockets
                    async with websockets.connect(ws_url, ping_interval=20, ping_timeout=10) as ws:
                        logger.info(f"Connected to Dhan 200-Level WebSocket for Security ID: {sec}")
                        # Send 200-level subscription message
                        sub_msg = {
                            "RequestCode": 23,
                            "ExchangeSegment": "NSE_FNO",
                            "SecurityId": str(sec),
                        }
                        await ws.send(json.dumps(sub_msg))

                        bids: list[dict[str, Any]] = []
                        asks: list[dict[str, Any]] = []

                        async for msg in ws:
                            if isinstance(msg, bytes):
                                parsed_bids, parsed_asks = self._parse_binary_packet(msg)
                                if parsed_bids:
                                    bids = parsed_bids
                                if parsed_asks:
                                    asks = parsed_asks
                            elif isinstance(msg, str):
                                try:
                                    j = json.loads(msg)
                                    if "bids" in j and "asks" in j:
                                        bids = j["bids"]
                                        asks = j["asks"]
                                except Exception:
                                    pass

                            if bids or asks:
                                engine = self._get_engine(sec)
                                snapshot = engine.calculate(bids, asks, inst_info)
                                self._latest_snapshots[sec] = snapshot
                                self._broadcast(sec, snapshot)

                except Exception as e:
                    logger.warning(f"Dhan 200-depth WS disconnected for {sec}: {e}. Retrying in 3s...")
                    await asyncio.sleep(3.0)
        else:
            # Live realistic Order Flow simulation loop (ticks every 1.5s)
            logger.info(f"Dhan credentials not set. Starting live 200-level order flow simulation for {sec}.")
            base_bids, base_asks = self._generate_realistic_200_depth(sec, inst_info)
            engine = self._get_engine(sec)

            while self._is_running and sec in self._active_subscriptions:
                # Add micro-jitter to simulate active order book churn, order cancellations & walls
                perturbed_bids, perturbed_asks = self._perturb_order_book(base_bids, base_asks)
                snapshot = engine.calculate(perturbed_bids, perturbed_asks, inst_info)
                self._latest_snapshots[sec] = snapshot
                self._broadcast(sec, snapshot)
                await asyncio.sleep(1.5)

    def _broadcast(self, security_id: str, snapshot: dict[str, Any]) -> None:
        sec = str(security_id)
        if sec in self._listeners:
            for cb in list(self._listeners[sec]):
                try:
                    cb(snapshot)
                except Exception as e:
                    logger.debug(f"Error in order flow listener callback: {e}")

    def _parse_binary_packet(self, data: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """
        Parses Dhan's binary WebSocket depth response.
        Header:
          - Feed Code: uint8 (1 byte, e.g. 41 for bids, 51 for asks, 23 for combined depth)
          - Message Length: uint16 (2 bytes)
          - Exchange Segment: uint8 (1 byte)
          - Security ID: uint32 (4 bytes)
        Each Depth Level Packet: 16 bytes:
          - Price: float32 (4 bytes, 'f') or int32 / 100.0
          - Quantity: uint32 (4 bytes, 'I')
          - Number of Orders: uint16 (2 bytes, 'H')
          - Reserved/Padding: 6 bytes
        """
        bids: list[dict[str, Any]] = []
        asks: list[dict[str, Any]] = []

        if len(data) < 8:
            return bids, asks

        try:
            feed_code = data[0]
            header_offset = 8  # 1 + 2 + 1 + 4 bytes header

            payload = data[header_offset:]
            packet_size = 16  # standard 16-byte depth level packet
            num_levels = len(payload) // packet_size

            for i in range(num_levels):
                chunk = payload[i * packet_size : (i + 1) * packet_size]
                if len(chunk) < 10:
                    continue

                price, quantity, orders = struct.unpack("!fIH", chunk[:10])

                # Sanity check values
                if math.isnan(price) or price <= 0 or quantity <= 0:
                    # Try little-endian unpack if big-endian yields invalid values
                    price, quantity, orders = struct.unpack("<fIH", chunk[:10])

                if price > 0 and quantity > 0:
                    item = {
                        "price": round(float(price), 2),
                        "quantity": int(quantity),
                        "orders": int(max(1, orders)),
                    }
                    if feed_code in (41, 1):  # Bid packet
                        bids.append(item)
                    elif feed_code in (51, 2):  # Ask packet
                        asks.append(item)
                    else:  # Alternate or mixed
                        if i % 2 == 0:
                            bids.append(item)
                        else:
                            asks.append(item)

        except Exception as e:
            logger.debug(f"Binary parsing packet debug: {e}")

        return bids, asks

    def _generate_realistic_200_depth(
        self,
        security_id: str,
        inst_info: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Generates realistic 200 bid and 200 ask levels around the contract price."""
        strike = float(inst_info.get("strike", 25000.0))
        opt_type = inst_info.get("option_type", "CE")
        base_price = 185.0 if opt_type == "CE" else 145.0

        tick_size = 0.05
        best_bid = round(base_price - tick_size, 2)
        best_ask = round(base_price + tick_size, 2)

        bids = []
        asks = []

        # Generate 200 levels
        for level in range(1, 201):
            bid_p = round(max(0.05, best_bid - (level - 1) * tick_size), 2)
            ask_p = round(best_ask + (level - 1) * tick_size, 2)

            # Realistic liquidity decay with occasional large walls
            base_bid_qty = int(2500 / math.sqrt(level) + random.randint(50, 400))
            base_ask_qty = int(2200 / math.sqrt(level) + random.randint(50, 400))

            # Introduce realistic Large Bid Wall at level 14 and Large Ask Wall at level 28
            if level == 14:
                base_bid_qty = 145000
                bid_orders = 112
            else:
                bid_orders = max(1, int(base_bid_qty / random.randint(300, 900)))

            if level == 28:
                base_ask_qty = 98000
                ask_orders = 84
            else:
                ask_orders = max(1, int(base_ask_qty / random.randint(300, 900)))

            bids.append({"price": bid_p, "quantity": base_bid_qty, "orders": bid_orders})
            asks.append({"price": ask_p, "quantity": base_ask_qty, "orders": ask_orders})

        return bids, asks

    def _perturb_order_book(
        self,
        bids: list[dict[str, Any]],
        asks: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Introduces dynamic market ticks and small volume shifts to simulate active depth."""
        new_bids = []
        for b in bids:
            jitter = random.uniform(-0.06, 0.06)
            qty = max(25, int(b["quantity"] * (1.0 + jitter)))
            new_bids.append({"price": b["price"], "quantity": qty, "orders": b["orders"]})

        new_asks = []
        for a in asks:
            jitter = random.uniform(-0.06, 0.06)
            qty = max(25, int(a["quantity"] * (1.0 + jitter)))
            new_asks.append({"price": a["price"], "quantity": qty, "orders": a["orders"]})

        return new_bids, new_asks


dhan_depth_client = DhanDepthClient()
