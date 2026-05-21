from typing import Any
from fastapi import APIRouter, Depends
from app.models.user import User
from app.api import deps
from app.schemas.subscription import Subscription

router = APIRouter()

@router.get("/me", response_model=Subscription)
async def get_my_subscription(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get current user's subscription tier"""
    # Mock return, normally fetch from DB
    return {"id": 1, "owner_id": current_user.id, "tier": "free", "expires_at": None}

@router.post("/upgrade")
async def upgrade_tier(
    tier: str,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Upgrade subscription tier via payment gateway (Stripe mock)"""
    return {"msg": f"Successfully upgraded to {tier} tier"}
