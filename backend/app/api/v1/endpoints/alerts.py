from __future__ import annotations

from typing import Any
from pydantic import BaseModel
from fastapi import APIRouter, Query

from app.core.config import settings
from app.services.alerts.telegram_service import telegram_service
from app.services.alerts.alert_manager import alert_manager

router = APIRouter()


class CustomAlertRequest(BaseModel):
    message: str


@router.get("/status")
def get_alert_status() -> dict[str, Any]:
    """Returns Telegram alert configuration status and statistics."""
    return {
        "is_configured": telegram_service.is_configured(),
        "alerts_enabled": settings.ALERTS_ENABLED,
        "chat_id_set": bool(settings.TELEGRAM_CHAT_ID),
        "bot_token_set": bool(settings.TELEGRAM_BOT_TOKEN),
        "total_alerts_recorded": len(telegram_service.get_history()),
    }


@router.post("/test")
async def send_test_alert() -> dict[str, Any]:
    """Sends a verification test alert to Telegram."""
    return await telegram_service.send_test_alert()


@router.get("/history")
def get_alert_history(limit: int = Query(30, ge=1, le=100)) -> list[dict[str, Any]]:
    """Returns recently dispatched trading alerts."""
    return telegram_service.get_history(limit=limit)


@router.post("/scan-and-dispatch")
async def scan_and_dispatch(index: str = Query("NIFTY 50")) -> dict[str, Any]:
    """
    Scans the market for active Golden Cross and Intraday setups and dispatches new alerts to Telegram.
    """
    dispatched = await alert_manager.scan_and_dispatch_golden_cross(index=index)
    return {
        "index": index,
        "dispatched_count": len(dispatched),
        "items": dispatched,
    }


@router.post("/send")
async def send_custom_alert(req: CustomAlertRequest) -> dict[str, Any]:
    """Sends a custom notification message to Telegram."""
    return await telegram_service.send_raw_message(req.message)
