from sqlalchemy import String, Integer, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class Strategy(Base):
    __tablename__ = "strategies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    
    # E.g. {"indicator": "SMA", "fast_window": 10, "slow_window": 50}
    parameters: Mapped[dict] = mapped_column(JSON, nullable=False, default={})
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    
    owner = relationship("User")
