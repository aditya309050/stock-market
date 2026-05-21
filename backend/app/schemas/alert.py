from pydantic import BaseModel

class AlertBase(BaseModel):
    symbol: str
    condition_type: str
    target_value: float
    is_triggered: bool = False

class AlertCreate(AlertBase):
    pass

class AlertUpdate(AlertBase):
    pass

class Alert(AlertBase):
    id: int
    owner_id: int

    model_config = {"from_attributes": True}
