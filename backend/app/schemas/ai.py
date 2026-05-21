from pydantic import BaseModel

class AIRecommendationRequest(BaseModel):
    symbol: str
    risk_level: str  # e.g., 'low', 'medium', 'high'
    trading_style: str  # e.g., 'day_trading', 'swing', 'long_term'

class AIRecommendationResponse(BaseModel):
    symbol: str
    action: str  # e.g., 'BUY', 'SELL', 'HOLD'
    confidence_score: float
    reasoning: str
