from sqlalchemy import String, Integer, ForeignKey, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(String, index=True, nullable=False)
    
    # E.g. PRICE_ABOVE, PRICE_BELOW, SMA_CROSSOVER
    condition_type: Mapped[str] = mapped_column(String, nullable=False)
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    
    is_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    
    owner = relationship("User")
