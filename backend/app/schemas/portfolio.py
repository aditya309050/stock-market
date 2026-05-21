from pydantic import BaseModel

class PortfolioBase(BaseModel):
    name: str

class PortfolioCreate(PortfolioBase):
    pass

class PortfolioUpdate(PortfolioBase):
    total_balance: float
    available_cash: float

class Portfolio(PortfolioBase):
    id: int
    owner_id: int
    total_balance: float
    available_cash: float

    model_config = {"from_attributes": True}
