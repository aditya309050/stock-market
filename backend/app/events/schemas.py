"""
Typed event schemas for the Kafka-based event pipeline.
Every event flowing through the system is one of these Pydantic models.
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class MarketTick(BaseModel):
    """Raw price tick from a market data feed."""
    symbol: str
    price: float
    volume: int
    timestamp: datetime


class TradeSignal(BaseModel):
    """Signal produced by an AI agent or strategy engine."""
    signal_id: str
    symbol: str
    action: str          # BUY | SELL | HOLD
    confidence: float    # 0.0 – 1.0
    source: str          # agent name or strategy id
    reasoning: str
    timestamp: datetime


class ExecutionReport(BaseModel):
    """Result of a trade execution (live or paper)."""
    order_id: str
    symbol: str
    side: str
    qty: float
    filled_price: float
    status: str          # filled | rejected | partial
    broker: str          # mock | paper | alpaca
    timestamp: datetime


class SentimentEvent(BaseModel):
    """Output of the sentiment analysis pipeline."""
    symbol: str
    headline: str
    sentiment_score: float  # -1.0 (bearish) to +1.0 (bullish)
    source: str
    timestamp: datetime
