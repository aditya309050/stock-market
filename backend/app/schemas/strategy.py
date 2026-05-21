from pydantic import BaseModel
from typing import Optional, Dict, Any

class StrategyBase(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: Dict[str, Any] = {}
    is_active: bool = False

class StrategyCreate(StrategyBase):
    pass

class StrategyUpdate(StrategyBase):
    pass

class Strategy(StrategyBase):
    id: int
    owner_id: int

    model_config = {"from_attributes": True}
