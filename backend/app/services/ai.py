import random
from app.schemas.ai import AIRecommendationRequest, AIRecommendationResponse

class AIService:
    async def get_recommendation(self, request: AIRecommendationRequest) -> AIRecommendationResponse:
        # Placeholder for real AI logic (e.g. OpenAI/Gemini integration)
        actions = ["BUY", "SELL", "HOLD"]
        action = random.choice(actions)
        confidence = round(random.uniform(0.6, 0.99), 2)
        
        reasoning = f"Based on the '{request.risk_level}' risk profile and '{request.trading_style}' style, the AI suggests to {action} {request.symbol}. Technical indicators and sentiment align with this decision."
        
        return AIRecommendationResponse(
            symbol=request.symbol,
            action=action,
            confidence_score=confidence,
            reasoning=reasoning
        )

ai_service = AIService()
