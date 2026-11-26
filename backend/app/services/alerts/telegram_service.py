from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# In-memory history of recent alerts
_alert_history: list[dict[str, Any]] = []


class TelegramService:
    def __init__(self) -> None:
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.chat_id = settings.TELEGRAM_CHAT_ID

    def is_configured(self) -> bool:
        return bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)

    async def send_raw_message(self, text: str, parse_mode: str = "HTML") -> dict[str, Any]:
        """Sends a message to the configured Telegram channel/chat."""
        now_str = datetime.now(timezone.utc).isoformat()

        if not self.is_configured():
            # In simulation/local mode, record to history and log
            alert_entry = {
                "id": len(_alert_history) + 1,
                "timestamp": now_str,
                "text": text,
                "status": "SIMULATED",
                "note": "Telegram bot token not configured. Logged to system feed.",
            }
            _alert_history.insert(0, alert_entry)
            logger.info(f"[SIMULATED TELEGRAM ALERT]: {text}")
            return {"success": True, "status": "SIMULATED", "message": "Alert recorded to local history (Bot token unset)."}

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    alert_entry = {
                        "id": len(_alert_history) + 1,
                        "timestamp": now_str,
                        "text": text,
                        "status": "SENT",
                    }
                    _alert_history.insert(0, alert_entry)
                    return {"success": True, "status": "SENT", "message": "Dispatched to Telegram."}
                else:
                    return {"success": False, "status": "ERROR", "message": f"Telegram API error: {res.text}"}
        except Exception as e:
            logger.error(f"Failed to dispatch Telegram message: {e}")
            return {"success": False, "status": "ERROR", "message": str(e)}

    async def send_golden_cross_alert(
        self,
        symbol: str,
        price: float,
        dma50: float,
        dma200: float,
        gap_pct: float,
        score: float,
        rsi: float,
    ) -> dict[str, Any]:
        """Dispatches an institutional Golden Cross breakout alert."""
        text = (
            f"🚨 <b>GOLDEN CROSS CONFIRMED — {symbol}</b>\n\n"
            f"📈 <b>Price:</b> ₹{price:,.2f}\n"
            f"⚡ <b>50 DMA:</b> ₹{dma50:,.2f}  |  <b>200 DMA:</b> ₹{dma200:,.2f}\n"
            f"🎯 <b>DMA Gap:</b> {gap_pct:.2f}% (Compression Breakout)\n"
            f"📊 <b>Score:</b> {score:.0f}/100  |  <b>RSI:</b> {rsi:.1f}\n\n"
            f"👉 <i>Signal: 50 DMA crossed above 200 DMA with volume surge.</i>\n"
            f"🕒 <i>{datetime.now().strftime('%d %b %Y, %I:%M %p')}</i>"
        )
        return await self.send_raw_message(text)

    async def send_intraday_breakout_alert(
        self,
        symbol: str,
        price: float,
        vwap: float,
        category: str,
        entry: float,
        stop_loss: float,
        target_1: float,
        risk_reward: str,
    ) -> dict[str, Any]:
        """Dispatches an Intraday VWAP / Momentum breakout alert."""
        text = (
            f"⚡ <b>INTRADAY SETUP TRIGGERED — {symbol}</b>\n\n"
            f"🔥 <b>Setup:</b> {category.replace('_', ' ')}\n"
            f"💵 <b>Current Price:</b> ₹{price:,.2f} (VWAP: ₹{vwap:,.2f})\n\n"
            f"🟢 <b>Suggested Entry:</b> ₹{entry:,.2f}\n"
            f"🛑 <b>Stop Loss:</b> ₹{stop_loss:,.2f}\n"
            f"🎯 <b>Target 1:</b> ₹{target_1:,.2f}\n"
            f"⚖️ <b>Risk : Reward:</b> {risk_reward}\n\n"
            f"🕒 <i>{datetime.now().strftime('%d %b %Y, %I:%M %p')}</i>"
        )
        return await self.send_raw_message(text)

    async def send_options_wall_alert(
        self,
        symbol: str,
        strike: float,
        option_type: str,
        wall_qty: int,
        spot: float,
        imbalance_pct: float,
    ) -> dict[str, Any]:
        """Dispatches an institutional 200-level option wall alert."""
        text = (
            f"🌊 <b>INSTITUTIONAL WALL DETECTED — {symbol}</b>\n\n"
            f"🎯 <b>Strike:</b> {strike:,.0f} {option_type}\n"
            f"📊 <b>Resting Wall Size:</b> {wall_qty:,} contracts\n"
            f"📈 <b>Index Spot:</b> ₹{spot:,.2f}\n"
            f"⚖️ <b>Order Imbalance:</b> {imbalance_pct:+.1f}%\n\n"
            f"👉 <i>Large resting institutional limit block active.</i>\n"
            f"🕒 <i>{datetime.now().strftime('%d %b %Y, %I:%M %p')}</i>"
        )
        return await self.send_raw_message(text)

    async def send_test_alert(self) -> dict[str, Any]:
        """Dispatches a diagnostic connection test alert."""
        text = (
            f"✅ <b>NSE Screener Pro — Bot Connection Verified!</b>\n\n"
            f"📡 <b>Alert Engine:</b> Online\n"
            f"⚡ <b>Modules:</b> Golden Cross, Intraday VWAP, 200-Depth Walls\n"
            f"🕒 <i>{datetime.now().strftime('%d %b %Y, %I:%M %p')}</i>"
        )
        return await self.send_raw_message(text)

    def get_history(self, limit: int = 50) -> list[dict[str, Any]]:
        return _alert_history[:limit]


telegram_service = TelegramService()
