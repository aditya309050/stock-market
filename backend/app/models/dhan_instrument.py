from datetime import datetime, timezone
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DhanInstrument(Base):
    __tablename__ = "dhan_instruments"

    security_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    symbol: Mapped[str] = mapped_column(String(64), index=True)
    trading_symbol: Mapped[str] = mapped_column(String(64), index=True)
    isin: Mapped[str] = mapped_column(String(64), default="")
    company_name: Mapped[str] = mapped_column(String(255), default="")
    exchange_segment: Mapped[str] = mapped_column(String(32), default="NSE_EQ")
    instrument_type: Mapped[str] = mapped_column(String(32), default="EQUITY")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
