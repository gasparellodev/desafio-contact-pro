"""Schemas Pydantic de leitura para Conversation e Message."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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


class MessageCreate(BaseModel):
    """Input para envio manual por humano (POST /api/conversations/{id}/messages).

    `content` é obrigatório, max 4096 chars (limite WhatsApp). Tipo é sempre TEXT
    nesse endpoint — humano não envia áudio/imagem por aqui (faria pelo próprio
    WhatsApp dele se quisesse).
    """

    content: str = Field(..., min_length=1, max_length=4096)


class MessagePage(BaseModel):
    """Página de mensagens em ordem cronológica (mais antigas primeiro).

    Para a próxima página (scroll-up de mensagens mais antigas), o cliente
    passa o par `before=next_before` + `before_id=next_before_id` retornado.
    O `id` desempata mensagens com `created_at` idêntico (race IN/OUT no
    orchestrator pode produzir timestamps em microssegundos iguais).
    Ambos `null` quando não há mais mensagens.
    """

    items: list[MessageRead]
    next_before: datetime | None
    next_before_id: UUID | None
    limit: int
