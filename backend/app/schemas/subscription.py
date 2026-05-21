from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SubscriptionBase(BaseModel):
    tier: str
    expires_at: Optional[datetime] = None

class Subscription(SubscriptionBase):
    id: int
    owner_id: int

    model_config = {"from_attributes": True}
