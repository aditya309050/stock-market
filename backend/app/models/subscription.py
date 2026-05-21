from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from .base import Base

class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    tier: Mapped[str] = mapped_column(String, default="free") # free, pro, enterprise
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    owner = relationship("User")
