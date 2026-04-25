"""Schemas Pydantic de leitura para Conversation e Message."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import Direction, Intent, MessageStatus, MessageType
from app.schemas.lead import LeadSummary


class MessageRead(BaseModel):
    """Mensagem exposta pela API (omite campos internos como error_reason cru)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    whatsapp_message_id: str | None
    direction: Direction
    type: MessageType
    content: str
    transcription: str | None
    media_url: str | None
    media_mime: str | None
    intent: Intent | None
    status: MessageStatus
    quoted_message_id: UUID | None
    created_at: datetime


class ConversationListItem(BaseModel):
    """Item da lista de conversas. Inclui lead resumido para a UI da sidebar."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lead: LeadSummary
    last_intent: Intent | None
    last_message_at: datetime
    created_at: datetime


class ConversationRead(BaseModel):
    """Detalhe da conversa (sem mensagens — use endpoint dedicado)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lead: LeadSummary
    last_intent: Intent | None
    last_message_at: datetime
    created_at: datetime


class ConversationList(BaseModel):
    """Resposta paginada da listagem de conversas."""

    items: list[ConversationListItem]
    total: int
    limit: int
    offset: int


class MessagePage(BaseModel):
    """Página de mensagens em ordem cronológica (mais antigas primeiro).

    `next_before`: timestamp ISO a passar como `before` para carregar a próxima
    página de mensagens *mais antigas* (scroll-up). `null` se não há mais.
    """

    items: list[MessageRead]
    next_before: datetime | None
    limit: int
