from datetime import UTC, datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlmodel import Field, SQLModel

from app.models.enums import LeadStatus, ServiceInterest


def _now() -> datetime:
    return datetime.now(UTC)


class Lead(SQLModel, table=True):
    __tablename__ = "leads"

    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(PG_UUID(as_uuid=True), primary_key=True),
    )
    whatsapp_jid: str = Field(sa_column=Column(String(64), unique=True, index=True, nullable=False))
    name: str | None = Field(default=None, max_length=160)
    company: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=32)
    service_interest: ServiceInterest = Field(
        default=ServiceInterest.UNKNOWN,
        sa_column=Column(String(32), nullable=False, default=ServiceInterest.UNKNOWN.value),
    )
    lead_goal: str | None = Field(default=None, max_length=500)
    estimated_volume: str | None = Field(default=None, max_length=160)
    status: LeadStatus = Field(
        default=LeadStatus.NEW,
        sa_column=Column(String(32), nullable=False, default=LeadStatus.NEW.value, index=True),
    )
    bot_paused: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=sa.false(), default=False),
    )
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_now),
    )
    updated_at: datetime = Field(
        default_factory=_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now),
    )
