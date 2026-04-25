from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlmodel import Field, SQLModel

from app.models.enums import Direction, Intent, MessageStatus, MessageType


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(PG_UUID(as_uuid=True), primary_key=True),
    )
    conversation_id: UUID = Field(
        sa_column=Column(
            PG_UUID(as_uuid=True),
            ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
    )
    whatsapp_message_id: str | None = Field(
        default=None,
        sa_column=Column(String(128), unique=True, index=True, nullable=True),
    )
    direction: Direction = Field(sa_column=Column(String(8), nullable=False, index=True))
    type: MessageType = Field(sa_column=Column(String(16), nullable=False))
    content: str = Field(sa_column=Column(Text, nullable=False, default=""))
    transcription: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    media_url: str | None = Field(default=None, sa_column=Column(String(512), nullable=True))
    media_mime: str | None = Field(default=None, sa_column=Column(String(64), nullable=True))
    intent: Intent | None = Field(default=None, sa_column=Column(String(32), nullable=True))
    status: MessageStatus = Field(
        default=MessageStatus.PENDING,
        sa_column=Column(String(16), nullable=False, default=MessageStatus.PENDING.value),
    )
    quoted_message_id: UUID | None = Field(
        default=None,
        sa_column=Column(PG_UUID(as_uuid=True), nullable=True),
    )
    error_reason: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(
        default_factory=_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, default=_now, index=True),
    )
