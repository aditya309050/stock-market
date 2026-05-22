import json
import re

from app.schemas.ai import AIRecommendationRequest, AIRecommendationResponse
from app.services.llm import chat_completion
from app.services.nse.client import nse_client


class AIService:
    async def get_recommendation(
        self, request: AIRecommendationRequest
    ) -> AIRecommendationResponse:
        df = await nse_client.fetch_ohlc(request.symbol, "1d", limit=5)
        price = float(df["close"].iloc[-1]) if not df.empty else None
        price_hint = f"Latest NSE price: ₹{price:.2f}" if price else "Price unavailable"

        system = (
            "You are an NSE stock analyst. Respond ONLY with valid JSON: "
            '{"action":"BUY"|"SELL"|"HOLD","confidence_score":0.0-1.0,"reasoning":"..."}'
        )
        user = (
            f"Symbol: {request.symbol}. {price_hint}. "
            f"Risk: {request.risk_level}. Style: {request.trading_style}."
        )

        raw = await chat_completion(system, user)
        return self._parse_response(request.symbol, raw)

    def _parse_response(self, symbol: str, raw: str) -> AIRecommendationResponse:
        try:
            match = re.search(r"\{[^{}]*\}", raw, re.DOTALL)
            if match:
                data = json.loads(match.group())
                return AIRecommendationResponse(
                    symbol=symbol,
                    action=str(data.get("action", "HOLD")).upper(),
                    confidence_score=float(data.get("confidence_score", 0.7)),
                    reasoning=str(data.get("reasoning", raw))[:500],
                )
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

        action = "HOLD"
        upper = raw.upper()
        if "BUY" in upper:
            action = "BUY"
        elif "SELL" in upper:
            action = "SELL"

        return AIRecommendationResponse(
            symbol=symbol,
            action=action,
            confidence_score=0.75,
            reasoning=raw[:500],
        )


ai_service = AIService()
