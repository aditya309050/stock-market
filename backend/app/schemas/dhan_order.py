from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field


class OrderPlacementRequest(BaseModel):
    symbol: str = Field(..., description="Trading symbol, e.g. RELIANCE, NIFTY 25000 CE")
    security_id: str = Field("", description="Dhan security ID if known, otherwise resolved automatically")
    exchange_segment: str = Field("NSE_EQ", description="NSE_EQ, NSE_FNO, BSE_EQ, MCX_COMM")
    transaction_type: str = Field("BUY", description="BUY or SELL")
    product_type: str = Field("INTRADAY", description="INTRADAY, CNC (Delivery), MARGIN, CO, BO")
    order_type: str = Field("MARKET", description="MARKET, LIMIT, STOP_LOSS, STOP_LOSS_MARKET")
    quantity: int = Field(1, ge=1, description="Number of shares or option contracts")
    price: float = Field(0.0, ge=0.0, description="Limit price (required if order_type is LIMIT)")
    trigger_price: float = Field(0.0, ge=0.0, description="Trigger price for stop loss orders")
    stop_loss: Optional[float] = Field(None, description="Optional target Stop-Loss price for bracket/protection")
    target: Optional[float] = Field(None, description="Optional target Take-Profit price")
    is_paper_trading: bool = Field(False, description="Set True for paper trading simulation without real capital")


class OrderPlacementResponse(BaseModel):
    order_id: str
    correlation_id: str
    symbol: str
    transaction_type: str
    quantity: int
    price: float
    order_type: str
    product_type: str
    order_status: str  # "TRADED", "PENDING", "REJECTED", "SIMULATED"
    message: str
    executed_at: str
    is_paper: bool = False


class OrderBookItem(BaseModel):
    order_id: str
    trading_symbol: str
    transaction_type: str
    exchange_segment: str
    product_type: str
    order_type: str
    quantity: int
    filled_qty: int
    price: float
    order_status: str
    create_time: str
    update_time: Optional[str] = None
    rejection_reason: Optional[str] = None


class PositionItem(BaseModel):
    security_id: str
    trading_symbol: str
    exchange_segment: str
    product_type: str
    buy_qty: int
    sell_qty: int
    net_qty: int
    buy_avg: float
    sell_avg: float
    last_price: float
    realized_profit: float
    unrealized_profit: float
    total_pnl: float
