"""Endpoints REST de leitura de conversas e mensagens.

Usados pelo frontend para hidratar estado no mount/reload, complementando o
fluxo Socket.IO (que entrega deltas em tempo real). Toda a UI admin é
protegida pelo header `X-Admin-Token`.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.security import require_admin_token
from app.db.session import get_session
from app.models.conversation import Conversation
from app.models.enums import LeadStatus
from app.models.lead import Lead
from app.models.message import Message
from app.schemas.conversation import (
    ConversationList,
    ConversationListItem,
    ConversationRead,
    MessagePage,
    MessageRead,
)
from app.schemas.lead import LeadSummary

DEFAULT_LIMIT = 50
MAX_LIMIT = 200

router = APIRouter(
    prefix="/api/conversations",
    tags=["conversations"],
    dependencies=[Depends(require_admin_token)],
)


def _escape_like(s: str) -> str:
    """Escapa wildcards de LIKE para que `q` seja sempre substring literal.

    Sem isso, `q=%` retorna tudo e `q=foo_bar` casa com `fooXbar` — comportamento
    surpreendente para um campo declarado como busca, mesmo em endpoint admin.
    """
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _build_conversation_payload(conversation: Conversation, lead: Lead) -> dict:
    """Campos compartilhados entre `ConversationListItem` e `ConversationRead`."""
    return {
        "id": conversation.id,
        "lead": LeadSummary.model_validate(lead),
        "last_intent": conversation.last_intent,
        "last_message_at": conversation.last_message_at,
        "created_at": conversation.created_at,
    }


def _conversation_item(conversation: Conversation, lead: Lead) -> ConversationListItem:
    return ConversationListItem(**_build_conversation_payload(conversation, lead))


def _conversation_read(conversation: Conversation, lead: Lead) -> ConversationRead:
    return ConversationRead(**_build_conversation_payload(conversation, lead))


@router.get("", response_model=ConversationList)
async def list_conversations(
    session: AsyncSession = Depends(get_session),
    status: LeadStatus | None = Query(default=None, description="Filtra por status do lead."),
    q: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
        description="Busca por nome, telefone ou whatsapp_jid (case-insensitive).",
    ),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
) -> ConversationList:
    """Lista conversas ordenadas pela mais recente atividade.

    Pagina via `limit`/`offset`. Para tempo real, o frontend assina Socket.IO
    e mescla deltas no cache local; este endpoint serve apenas para
    hidratação/refresh.
    """
    base_filters = []
    if status is not None:
        base_filters.append(Lead.status == status.value)
    if q:
        like = f"%{_escape_like(q)}%"
        base_filters.append(
            or_(
                Lead.name.ilike(like, escape="\\"),
                Lead.phone.ilike(like, escape="\\"),
                Lead.whatsapp_jid.ilike(like, escape="\\"),
            )
        )

    # Count: só faz JOIN com Lead se houver filtro que exija. No caso default
    # (sem status/q) basta contar Conversation direto e poupar o scan.
    if base_filters:
        count_stmt = (
            select(func.count())
            .select_from(Conversation)
            .join(Lead, Lead.id == Conversation.lead_id)
        )
        for f in base_filters:
            count_stmt = count_stmt.where(f)
    else:
        count_stmt = select(func.count(Conversation.id))

    items_stmt = (
        select(Conversation, Lead)
        .join(Lead, Lead.id == Conversation.lead_id)
        .order_by(Conversation.last_message_at.desc())
        .limit(limit)
        .offset(offset)
    )
    for f in base_filters:
        items_stmt = items_stmt.where(f)

    total = (await session.execute(count_stmt)).scalar_one()
    rows = (await session.execute(items_stmt)).all()
    items = [_conversation_item(conv, lead) for conv, lead in rows]

    return ConversationList(items=items, total=total, limit=limit, offset=offset)


@router.get("/{conversation_id}", response_model=ConversationRead)
async def get_conversation(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> ConversationRead:
    """Detalhe da conversa (sem mensagens). Use o endpoint /messages para o thread."""
    stmt = (
        select(Conversation, Lead)
        .join(Lead, Lead.id == Conversation.lead_id)
        .where(Conversation.id == conversation_id)
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    conversation, lead = row
    return _conversation_read(conversation, lead)


@router.get("/{conversation_id}/messages", response_model=MessagePage)
async def list_messages(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_session),
    before: datetime | None = Query(
        default=None,
        description="Cursor primário: retorna mensagens com created_at < before.",
    ),
    before_id: UUID | None = Query(
        default=None,
        description=(
            "Tie-breaker do cursor. Combinado com `before`, usa comparação de "
            "tupla (created_at, id) < (before, before_id) para evitar pular "
            "mensagens com timestamp idêntico."
        ),
    ),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> MessagePage:
    """Página de mensagens em ordem cronológica ascendente.

    Internamente pega `limit` mensagens mais recentes em ordem descendente e
    devolve invertidas para o cliente renderizar do mais antigo ao mais novo.
    Para "carregar mais" (scroll-up), o cliente passa o par
    `before=next_before` + `before_id=next_before_id` retornado.
    """
    exists = (
        await session.execute(select(Conversation.id).where(Conversation.id == conversation_id))
    ).first()
    if exists is None:
        raise HTTPException(status_code=404, detail="conversation not found")

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(limit)
    )
    if before is not None and before_id is not None:
        # Tupla evita pular mensagens com created_at idêntico (race IN/OUT).
        stmt = stmt.where(tuple_(Message.created_at, Message.id) < tuple_(before, before_id))
    elif before is not None:
        # Compatibilidade: cliente que só passou `before` ainda funciona.
        stmt = stmt.where(Message.created_at < before)

    rows = (await session.execute(stmt)).scalars().all()
    messages = list(reversed(rows))
    has_next = len(rows) == limit and bool(messages)
    next_before = messages[0].created_at if has_next else None
    next_before_id = messages[0].id if has_next else None

    return MessagePage(
        items=[MessageRead.model_validate(m) for m in messages],
        next_before=next_before,
        next_before_id=next_before_id,
        limit=limit,
    )
