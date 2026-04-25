"""Endpoints REST de Leads."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.security import require_admin_token
from app.core.socketio import emit_global
from app.db.session import get_session
from app.models.lead import Lead
from app.schemas.lead import LeadRead

router = APIRouter(
    prefix="/api/leads",
    tags=["leads"],
    dependencies=[Depends(require_admin_token)],
)


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> LeadRead:
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=404, detail="lead not found")
    return LeadRead.model_validate(lead)


@router.post("/{lead_id}/resume-bot", response_model=LeadRead)
async def resume_bot(
    lead_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> LeadRead:
    """Libera o bot pra responder de novo. Idempotente — chamar com bot_paused=False
    é no-op (apenas devolve o lead). Emite `lead.updated` no Socket.IO.
    """
    lead = (await session.execute(select(Lead).where(Lead.id == lead_id))).scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=404, detail="lead not found")
    if lead.bot_paused:
        lead.bot_paused = False
        lead.updated_at = datetime.now(UTC)
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        await emit_global("lead.updated", LeadRead.model_validate(lead).model_dump(mode="json"))
    return LeadRead.model_validate(lead)
