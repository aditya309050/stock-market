from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any

from app.services.alerts.telegram_service import telegram_service
from app.services.indicators.golden_cross_service import golden_cross_service

logger = logging.getLogger(__name__)

# Key: (alert_type, symbol) -> last_sent_time
_cooldown_tracker: dict[tuple[str, str], datetime] = {}
COOLDOWN_MINUTES = 60


class AlertManager:
    async def scan_and_dispatch_golden_cross(self, index: str = "NIFTY 50") -> list[dict[str, Any]]:
        """Scans for active golden cross opportunities and dispatches alerts."""
        radar = await golden_cross_service.scan_universe(index=index)
        dispatched: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        for stock in radar.radar_items:
            # Alert on confirmed crosses or high-scoring near crosses
            if stock.is_crossed or stock.score >= 80:
                key = ("GOLDEN_CROSS", stock.symbol)
                last_sent = _cooldown_tracker.get(key)

                if not last_sent or (now - last_sent) > timedelta(minutes=COOLDOWN_MINUTES):
                    _cooldown_tracker[key] = now
                    res = await telegram_service.send_golden_cross_alert(
                        symbol=stock.symbol,
                        price=stock.price,
                        dma50=stock.dma50,
                        dma200=stock.dma200,
                        gap_pct=stock.gap_pct,
                        score=stock.score,
                        rsi=stock.rsi,
                    )
                    dispatched.append({
                        "symbol": stock.symbol,
                        "type": "GOLDEN_CROSS",
                        "price": stock.price,
                        "score": stock.score,
                        "dispatch_status": res.get("status"),
                    })

        return dispatched


alert_manager = AlertManager()
