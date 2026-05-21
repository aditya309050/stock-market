from typing import Any
from fastapi import APIRouter, Depends
from app.schemas.ai import AIRecommendationRequest, AIRecommendationResponse
from app.services.ai import ai_service
from app.models.user import User
from app.api import deps

router = APIRouter()

@router.post("/suggest", response_model=AIRecommendationResponse)
async def get_ai_suggestion(
    request: AIRecommendationRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get AI recommendation for a specific stock"""
    recommendation = await ai_service.get_recommendation(request)
    return recommendation
