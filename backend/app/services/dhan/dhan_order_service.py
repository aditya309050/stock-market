from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import uuid
from typing import Any, Optional

import httpx

from app.core.config import settings
from app.schemas.dhan_order import (
    OrderPlacementRequest,
    OrderPlacementResponse,
    OrderBookItem,
    PositionItem,
)
from app.services.dhan.dhan_client import dhan_client

logger = logging.getLogger(__name__)

# In-memory store for paper and placed order tracking
_order_store: list[dict[str, Any]] = []


class DhanOrderService:
    def __init__(self) -> None:
        self.base_url = settings.DHAN_BASE_URL.rstrip("/")
        self.client_id = settings.DHAN_CLIENT_ID
        self.access_token = settings.DHAN_ACCESS_TOKEN

    def _get_headers(self) -> dict[str, str]:
        return {
            "access-token": self.access_token,
            "client-id": self.client_id,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _resolve_security_id(self, symbol: str) -> str:
        """Resolves Dhan security_id from Scrip Master for a given symbol."""
        clean = symbol.upper().strip().split("-")[0].replace(".NS", "")
        try:
            instruments = await dhan_client.fetch_scrip_master()
            for inst in instruments:
                if inst.get("symbol", "").upper() == clean or inst.get("trading_symbol", "").upper() == clean:
                    return str(inst.get("security_id", ""))
        except Exception as e:
            logger.warning(f"Error resolving security ID for {symbol}: {e}")
        return ""

    async def place_order(self, req: OrderPlacementRequest) -> OrderPlacementResponse:
        """
        Places an order via Dhan API v2 or simulates via Paper Trading.
        """
        now_str = datetime.now(timezone.utc).isoformat()
        correlation_id = f"ORD-{uuid.uuid4().hex[:8].upper()}"

        # Resolve security ID if not supplied
        security_id = req.security_id.strip()
        if not security_id:
            security_id = await self._resolve_security_id(req.symbol)
            if not security_id:
                security_id = "0"  # fallback

        # If paper trading requested or Dhan credentials missing, simulate instantly
        is_paper = req.is_paper_trading or not settings.dhan_configured
        if is_paper:
            order_id = f"PAPER-{uuid.uuid4().hex[:8].upper()}"
            exec_price = req.price if req.price > 0 else 100.0  # simulated fill

            sim_order = {
                "order_id": order_id,
                "trading_symbol": req.symbol.upper(),
                "transaction_type": req.transaction_type.upper(),
                "exchange_segment": req.exchange_segment.upper(),
                "product_type": req.product_type.upper(),
                "order_type": req.order_type.upper(),
                "quantity": req.quantity,
                "filled_qty": req.quantity,
                "price": exec_price,
                "order_status": "TRADED",
                "create_time": now_str,
                "update_time": now_str,
                "is_paper": True,
            }
            _order_store.insert(0, sim_order)

            return OrderPlacementResponse(
                order_id=order_id,
                correlation_id=correlation_id,
                symbol=req.symbol.upper(),
                transaction_type=req.transaction_type.upper(),
                quantity=req.quantity,
                price=exec_price,
                order_type=req.order_type.upper(),
                product_type=req.product_type.upper(),
                order_status="TRADED (SIMULATED)",
                message=f"Paper order for {req.quantity} {req.symbol} executed successfully at ₹{exec_price:.2f}.",
                executed_at=now_str,
                is_paper=True,
            )

        # Real Dhan API v2 Call
        payload = {
            "dhanClientId": self.client_id,
            "correlationId": correlation_id,
            "transactionType": req.transaction_type.upper(),
            "exchangeSegment": req.exchange_segment.upper(),
            "productType": req.product_type.upper(),
            "orderType": req.order_type.upper(),
            "validity": "DAY",
            "tradingSymbol": req.symbol.upper(),
            "securityId": security_id,
            "quantity": req.quantity,
            "disclosedQuantity": 0,
            "price": req.price if req.order_type.upper() == "LIMIT" else 0.0,
            "triggerPrice": req.trigger_price,
            "afterMarketOrder": False,
            "amoTime": "OPEN",
        }

        if req.stop_loss and req.stop_loss > 0:
            payload["boStopLossValue"] = abs(req.price - req.stop_loss)
        if req.target and req.target > 0:
            payload["boProfitValue"] = abs(req.target - req.price)

        url = f"{self.base_url}/orders"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload, headers=self._get_headers())
                data = res.json()

                if res.status_code in (200, 201, 202):
                    order_id = str(data.get("orderId", correlation_id))
                    order_status = str(data.get("orderStatus", "PENDING")).upper()
                    
                    real_order = {
                        "order_id": order_id,
                        "trading_symbol": req.symbol.upper(),
                        "transaction_type": req.transaction_type.upper(),
                        "exchange_segment": req.exchange_segment.upper(),
                        "product_type": req.product_type.upper(),
                        "order_type": req.order_type.upper(),
                        "quantity": req.quantity,
                        "filled_qty": 0,
                        "price": req.price,
                        "order_status": order_status,
                        "create_time": now_str,
                        "is_paper": False,
                    }
                    _order_store.insert(0, real_order)

                    return OrderPlacementResponse(
                        order_id=order_id,
                        correlation_id=correlation_id,
                        symbol=req.symbol.upper(),
                        transaction_type=req.transaction_type.upper(),
                        quantity=req.quantity,
                        price=req.price,
                        order_type=req.order_type.upper(),
                        product_type=req.product_type.upper(),
                        order_status=order_status,
                        message=f"Dhan Order {order_id} placed successfully.",
                        executed_at=now_str,
                        is_paper=False,
                    )
                else:
                    error_msg = data.get("remarks") or data.get("message") or f"HTTP {res.status_code}: {res.text}"
                    return OrderPlacementResponse(
                        order_id="",
                        correlation_id=correlation_id,
                        symbol=req.symbol.upper(),
                        transaction_type=req.transaction_type.upper(),
                        quantity=req.quantity,
                        price=req.price,
                        order_type=req.order_type.upper(),
                        product_type=req.product_type.upper(),
                        order_status="REJECTED",
                        message=f"Dhan rejected order: {error_msg}",
                        executed_at=now_str,
                        is_paper=False,
                    )
        except Exception as e:
            logger.error(f"Failed to place order to Dhan API: {e}")
            return OrderPlacementResponse(
                order_id="",
                correlation_id=correlation_id,
                symbol=req.symbol.upper(),
                transaction_type=req.transaction_type.upper(),
                quantity=req.quantity,
                price=req.price,
                order_type=req.order_type.upper(),
                product_type=req.product_type.upper(),
                order_status="ERROR",
                message=f"Connection error to Dhan broker: {e}",
                executed_at=now_str,
                is_paper=False,
            )

    async def get_orders(self) -> list[OrderBookItem]:
        """Fetches the combined order book (Dhan live orders + local session orders)."""
        orders: list[OrderBookItem] = []

        if settings.dhan_configured:
            url = f"{self.base_url}/orders"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(url, headers=self._get_headers())
                    if res.status_code == 200:
                        raw_list = res.json()
                        if isinstance(raw_list, list):
                            for o in raw_list:
                                orders.append(
                                    OrderBookItem(
                                        order_id=str(o.get("orderId", "")),
                                        trading_symbol=str(o.get("tradingSymbol", "")),
                                        transaction_type=str(o.get("transactionType", "BUY")),
                                        exchange_segment=str(o.get("exchangeSegment", "NSE_EQ")),
                                        product_type=str(o.get("productType", "INTRADAY")),
                                        order_type=str(o.get("orderType", "MARKET")),
                                        quantity=int(o.get("quantity", 0)),
                                        filled_qty=int(o.get("filledQty", 0)),
                                        price=float(o.get("price", 0.0)),
                                        order_status=str(o.get("orderStatus", "PENDING")),
                                        create_time=str(o.get("createTime", "")),
                                        update_time=str(o.get("updateTime", "")),
                                        rejection_reason=o.get("remarks"),
                                    )
                                )
            except Exception as e:
                logger.warning(f"Could not fetch Dhan live orders: {e}")

        # Add stored session/paper orders
        for so in _order_store:
            if not any(o.order_id == so["order_id"] for o in orders):
                orders.append(
                    OrderBookItem(
                        order_id=so["order_id"],
                        trading_symbol=so["trading_symbol"],
                        transaction_type=so["transaction_type"],
                        exchange_segment=so["exchange_segment"],
                        product_type=so["product_type"],
                        order_type=so["order_type"],
                        quantity=so["quantity"],
                        filled_qty=so.get("filled_qty", so["quantity"]),
                        price=so["price"],
                        order_status=so["order_status"],
                        create_time=so["create_time"],
                        update_time=so.get("update_time"),
                    )
                )

        return orders

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancels an open order."""
        if order_id.startswith("PAPER-"):
            for so in _order_store:
                if so["order_id"] == order_id:
                    so["order_status"] = "CANCELLED"
                    return {"success": True, "message": f"Paper order {order_id} cancelled."}
            return {"success": False, "message": "Paper order not found."}

        url = f"{self.base_url}/orders/{order_id}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.delete(url, headers=self._get_headers())
                if res.status_code in (200, 202):
                    return {"success": True, "message": f"Dhan order {order_id} cancelled."}
                data = res.json()
                return {"success": False, "message": data.get("remarks", "Cancellation failed.")}
        except Exception as e:
            return {"success": False, "message": str(e)}

    async def get_positions(self) -> list[PositionItem]:
        """Fetches active positions from Dhan or paper portfolio."""
        positions: list[PositionItem] = []
        if settings.dhan_configured:
            url = f"{self.base_url}/positions"
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.get(url, headers=self._get_headers())
                    if res.status_code == 200:
                        raw = res.json()
                        if isinstance(raw, list):
                            for p in raw:
                                positions.append(
                                    PositionItem(
                                        security_id=str(p.get("securityId", "")),
                                        trading_symbol=str(p.get("tradingSymbol", "")),
                                        exchange_segment=str(p.get("exchangeSegment", "NSE_EQ")),
                                        product_type=str(p.get("productType", "INTRADAY")),
                                        buy_qty=int(p.get("buyQty", 0)),
                                        sell_qty=int(p.get("sellQty", 0)),
                                        net_qty=int(p.get("netQty", 0)),
                                        buy_avg=float(p.get("buyAvg", 0.0)),
                                        sell_avg=float(p.get("sellAvg", 0.0)),
                                        last_price=float(p.get("lastPrice", 0.0)),
                                        realized_profit=float(p.get("realizedProfit", 0.0)),
                                        unrealized_profit=float(p.get("unrealizedProfit", 0.0)),
                                        total_pnl=float(p.get("realizedProfit", 0.0)) + float(p.get("unrealizedProfit", 0.0)),
                                    )
                                )
            except Exception as e:
                logger.warning(f"Could not fetch Dhan positions: {e}")
        return positions


dhan_order_service = DhanOrderService()
