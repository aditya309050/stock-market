from sqlalchemy import String, Integer, ForeignKey, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base

class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    
    # Simple tracking of overall balance
    total_balance: Mapped[float] = mapped_column(Float, default=0.0)
    available_cash: Mapped[float] = mapped_column(Float, default=0.0)

    owner = relationship("User")
