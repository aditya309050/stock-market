"""200-Level Full Market Depth Order Flow Engine."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import math
from typing import Any, List, Optional


ZONE_CONFIG = [
    {"name": "Immediate", "start": 1, "end": 5, "weight": 0.35, "icon": "⚡"},
    {"name": "Near", "start": 6, "end": 20, "weight": 0.30, "icon": "🎯"},
    {"name": "Medium", "start": 21, "end": 50, "weight": 0.20, "icon": "📊"},
    {"name": "Deep", "start": 51, "end": 100, "weight": 0.10, "icon": "🌊"},
    {"name": "Extended", "start": 101, "end": 200, "weight": 0.05, "icon": "🌐"},
]


@dataclass
class OrderBookEntry:
    level: int
    price: float
    quantity: int
    orders: int


@dataclass
class WallInfo:
    level: int
    price: float
    quantity: int
    orders: int
    label: str  # "Large Bid Wall" or "Large Ask Wall"


@dataclass
class ZoneMetrics:
    name: str
    levels_range: str
    weight: float
    bid_qty: int
    ask_qty: int
    imbalance: float          # (BidQty - AskQty) / (BidQty + AskQty) between -1.0 and +1.0
    bid_pressure_pct: float   # BidQty / (BidQty + AskQty) * 100
    ask_pressure_pct: float   # AskQty / (BidQty + AskQty) * 100
    status: str               # "Strong", "Positive", "Neutral", "Weak", "Bearish"
    status_color: str         # "emerald", "green", "yellow", "amber", "rose"


class OrderFlowEngine:
    """
    Stateful Order Flow Engine for 200-level market depth snapshots.
    Tracks previous liquidity state to compute churn and liquidity delta.
    """

    def __init__(self, security_id: str) -> None:
        self.security_id = security_id
        self.prev_total_bid_qty: int | None = None
        self.prev_total_ask_qty: int | None = None
        self.prev_best_bid: float | None = None
        self.prev_best_ask: float | None = None
        self.last_updated: datetime = datetime.now(timezone.utc)

    def calculate(
        self,
        bids: list[dict[str, Any]],
        asks: list[dict[str, Any]],
        instrument_info: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Takes raw bids & asks (up to 200 levels each) and calculates complete order flow analytics.
        Each bid/ask entry: {'price': float, 'quantity': int, 'orders': int}
        """
        # Sort bids descending by price, asks ascending by price
        sorted_bids = sorted(bids, key=lambda x: x.get("price", 0.0), reverse=True)[:200]
        sorted_asks = sorted(asks, key=lambda x: x.get("price", 0.0))[:200]

        # Normalise to 200 OrderBookEntry objects each
        bid_entries: list[OrderBookEntry] = []
        for i, b in enumerate(sorted_bids):
            bid_entries.append(
                OrderBookEntry(
                    level=i + 1,
                    price=float(b.get("price", 0.0)),
                    quantity=int(b.get("quantity", 0)),
                    orders=int(b.get("orders", 1)),
                )
            )

        ask_entries: list[OrderBookEntry] = []
        for i, a in enumerate(sorted_asks):
            ask_entries.append(
                OrderBookEntry(
                    level=i + 1,
                    price=float(a.get("price", 0.0)),
                    quantity=int(a.get("quantity", 0)),
                    orders=int(a.get("orders", 1)),
                )
            )

        # Basic Best Bid / Ask / Spread
        best_bid = bid_entries[0].price if bid_entries else 0.0
        best_ask = ask_entries[0].price if ask_entries else 0.0
        spread = round(max(0.0, best_ask - best_bid), 2) if best_ask > 0 and best_bid > 0 else 0.0
        spread_pct = round((spread / best_ask) * 100, 3) if best_ask > 0 else 0.0

        # Totals across all 200 levels
        total_bid_qty = sum(e.quantity for e in bid_entries)
        total_ask_qty = sum(e.quantity for e in ask_entries)
        total_depth_qty = total_bid_qty + total_ask_qty

        # Overall Imbalance: (BidQty - AskQty) / (BidQty + AskQty)
        overall_imbalance = (
            (total_bid_qty - total_ask_qty) / total_depth_qty
            if total_depth_qty > 0
            else 0.0
        )
        overall_bid_pressure = (total_bid_qty / total_depth_qty * 100) if total_depth_qty > 0 else 50.0
        overall_ask_pressure = (total_ask_qty / total_depth_qty * 100) if total_depth_qty > 0 else 50.0

        # Calculate Zone metrics
        zones: list[dict[str, Any]] = []
        weighted_score_accum = 0.0

        for z in ZONE_CONFIG:
            start_idx = z["start"] - 1
            end_idx = z["end"]

            z_bids = bid_entries[start_idx:end_idx]
            z_asks = ask_entries[start_idx:end_idx]

            z_bid_qty = sum(e.quantity for e in z_bids)
            z_ask_qty = sum(e.quantity for e in z_asks)
            z_total = z_bid_qty + z_ask_qty

            if z_total > 0:
                z_imbalance = (z_bid_qty - z_ask_qty) / z_total
                z_bid_pressure = (z_bid_qty / z_total) * 100
                z_ask_pressure = (z_ask_qty / z_total) * 100
            else:
                z_imbalance = 0.0
                z_bid_pressure = 50.0
                z_ask_pressure = 50.0

            # Zone qualitative assessment
            if z_imbalance >= 0.25:
                status = "Strong"
                status_color = "emerald"
            elif z_imbalance >= 0.08:
                status = "Positive"
                status_color = "green"
            elif z_imbalance >= -0.08:
                status = "Neutral"
                status_color = "yellow"
            elif z_imbalance >= -0.25:
                status = "Weak"
                status_color = "amber"
            else:
                status = "Bearish"
                status_color = "rose"

            # Weighted contribution: map imbalance (-1 to +1) to (0 to 100)
            zone_score = 50.0 + (z_imbalance * 50.0)
            weighted_score_accum += zone_score * z["weight"]

            zones.append(
                {
                    "name": z["name"],
                    "levels_range": f"{z['start']}–{z['end']}",
                    "weight_pct": int(z["weight"] * 100),
                    "icon": z["icon"],
                    "bid_qty": z_bid_qty,
                    "ask_qty": z_ask_qty,
                    "imbalance": round(z_imbalance, 3),
                    "bid_pressure_pct": round(z_bid_pressure, 1),
                    "ask_pressure_pct": round(z_ask_pressure, 1),
                    "status": status,
                    "status_color": status_color,
                }
            )

        # Transparent Final Score 0–100 (Clamped)
        order_flow_score = max(0, min(100, int(round(weighted_score_accum))))

        # Detect Largest Bid Wall & Largest Ask Wall (Single Level Outlier)
        bid_wall = None
        if bid_entries:
            max_bid_entry = max(bid_entries, key=lambda e: e.quantity)
            bid_wall = {
                "level": max_bid_entry.level,
                "price": max_bid_entry.price,
                "quantity": max_bid_entry.quantity,
                "orders": max_bid_entry.orders,
                "label": "Large Bid Wall",
                "pct_of_total": round((max_bid_entry.quantity / total_bid_qty * 100), 1) if total_bid_qty > 0 else 0.0,
            }

        ask_wall = None
        if ask_entries:
            max_ask_entry = max(ask_entries, key=lambda e: e.quantity)
            ask_wall = {
                "level": max_ask_entry.level,
                "price": max_ask_entry.price,
                "quantity": max_ask_entry.quantity,
                "orders": max_ask_entry.orders,
                "label": "Large Ask Wall",
                "pct_of_total": round((max_ask_entry.quantity / total_ask_qty * 100), 1) if total_ask_qty > 0 else 0.0,
            }

        # Liquidity Concentration (Top 5 & Top 20 levels vs Total 200)
        top5_bid_qty = sum(e.quantity for e in bid_entries[:5])
        top5_ask_qty = sum(e.quantity for e in ask_entries[:5])
        top5_concentration = round(((top5_bid_qty + top5_ask_qty) / total_depth_qty * 100), 1) if total_depth_qty > 0 else 0.0

        top20_bid_qty = sum(e.quantity for e in bid_entries[:20])
        top20_ask_qty = sum(e.quantity for e in ask_entries[:20])
        top20_concentration = round(((top20_bid_qty + top20_ask_qty) / total_depth_qty * 100), 1) if total_depth_qty > 0 else 0.0

        # Liquidity Change vs Previous Snapshot
        if self.prev_total_bid_qty is not None and self.prev_total_bid_qty > 0:
            bid_liquidity_change_pct = round(((total_bid_qty - self.prev_total_bid_qty) / self.prev_total_bid_qty) * 100, 2)
        else:
            bid_liquidity_change_pct = 0.0

        if self.prev_total_ask_qty is not None and self.prev_total_ask_qty > 0:
            ask_liquidity_change_pct = round(((total_ask_qty - self.prev_total_ask_qty) / self.prev_total_ask_qty) * 100, 2)
        else:
            ask_liquidity_change_pct = 0.0

        total_prev = (self.prev_total_bid_qty or 0) + (self.prev_total_ask_qty or 0)
        if total_prev > 0:
            overall_liquidity_change_pct = round(((total_depth_qty - total_prev) / total_prev) * 100, 2)
        else:
            overall_liquidity_change_pct = 0.0

        # Liquidity Churn Analysis
        churn_metric = abs(bid_liquidity_change_pct) + abs(ask_liquidity_change_pct)
        if churn_metric > 25.0:
            churn_rating = "High"
        elif churn_metric > 8.0:
            churn_rating = "Moderate"
        else:
            churn_rating = "Low"

        # Update historical state
        self.prev_total_bid_qty = total_bid_qty
        self.prev_total_ask_qty = total_ask_qty
        self.prev_best_bid = best_bid
        self.prev_best_ask = best_ask
        self.last_updated = datetime.now(timezone.utc)

        # Form compact formatted table rows (1-200)
        max_rows = max(len(bid_entries), len(ask_entries), 200)
        book_levels: list[dict[str, Any]] = []

        # Find maximum quantity across all 200 levels for bar visualization
        max_level_qty = max(
            max((e.quantity for e in bid_entries), default=1),
            max((e.quantity for e in ask_entries), default=1),
            1,
        )

        for i in range(max_rows):
            b = bid_entries[i] if i < len(bid_entries) else None
            a = ask_entries[i] if i < len(ask_entries) else None

            book_levels.append(
                {
                    "level": i + 1,
                    "bid_orders": b.orders if b else 0,
                    "bid_qty": b.quantity if b else 0,
                    "bid_price": b.price if b else 0.0,
                    "bid_depth_pct": round((b.quantity / max_level_qty * 100), 1) if b else 0.0,
                    "ask_price": a.price if a else 0.0,
                    "ask_qty": a.quantity if a else 0,
                    "ask_orders": a.orders if a else 0,
                    "ask_depth_pct": round((a.quantity / max_level_qty * 100), 1) if a else 0.0,
                }
            )

        return {
            "security_id": self.security_id,
            "instrument": instrument_info or {},
            "order_flow_score": order_flow_score,
            "overall_imbalance": round(overall_imbalance, 3),
            "overall_imbalance_pct": round(overall_imbalance * 100, 1),
            "overall_bid_pressure": round(overall_bid_pressure, 1),
            "overall_ask_pressure": round(overall_ask_pressure, 1),
            "total_bid_qty": total_bid_qty,
            "total_ask_qty": total_ask_qty,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": spread,
            "spread_pct": spread_pct,
            "zones": zones,
            "bid_wall": bid_wall,
            "ask_wall": ask_wall,
            "liquidity_concentration": {
                "top5_pct": top5_concentration,
                "top20_pct": top20_concentration,
            },
            "liquidity_change": {
                "overall_pct": overall_liquidity_change_pct,
                "bid_pct": bid_liquidity_change_pct,
                "ask_pct": ask_liquidity_change_pct,
            },
            "liquidity_churn": churn_rating,
            "book_levels": book_levels,
            "timestamp": self.last_updated.isoformat(),
        }
