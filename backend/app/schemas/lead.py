"""Schemas Pydantic de leitura para Lead.

Mantemos leitura separada dos modelos SQLModel para não vazar campos internos
e poder evoluir contratos de API sem alterar tabela.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import LeadStatus, ServiceInterest


class LeadSummary(BaseModel):
    """Subset usado quando o lead aparece embutido em outro recurso (ex: conversa).

    Inclui `service_interest` porque a sidebar de conversas mostra esse hint
    sem precisar de outro round-trip pro endpoint de detalhe.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    whatsapp_jid: str
    name: str | None
    phone: str | None
    service_interest: ServiceInterest
    status: LeadStatus


class LeadRead(BaseModel):
    """Detalhe completo do lead exposto pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    whatsapp_jid: str
    name: str | None
    company: str | None
    phone: str | None
    service_interest: ServiceInterest
    lead_goal: str | None
    estimated_volume: str | None
    status: LeadStatus
    created_at: datetime
    updated_at: datetime
