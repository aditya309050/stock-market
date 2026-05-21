"""
Copy Trade model — tracks which users follow which published strategies.
"""
from sqlalchemy import Integer, ForeignKey, Float, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.models.base import Base


class CopyTrade(Base):
    __tablename__ = "copy_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    follower_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    published_strategy_id: Mapped[int] = mapped_column(Integer, ForeignKey("published_strategies.id"), nullable=False)
    
    allocation_pct: Mapped[float] = mapped_column(Float, default=10.0)  # % of portfolio to allocate
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    follower = relationship("User")
    published_strategy = relationship("PublishedStrategy")
