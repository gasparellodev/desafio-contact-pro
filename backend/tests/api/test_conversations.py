"""Testes dos endpoints GET /api/conversations e GET /api/conversations/{id}."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.enums import Intent, LeadStatus
from app.models.lead import Lead


def _now() -> datetime:
    return datetime.now(UTC)


async def _seed_pair(
    session: AsyncSession,
    *,
    name: str = "Cliente A",
    phone: str = "+5511999990001",
    jid_suffix: str = "0001",
    status: LeadStatus = LeadStatus.NEW,
    last_message_at: datetime | None = None,
    last_intent: Intent | None = None,
) -> tuple[Lead, Conversation]:
    lead = Lead(
        whatsapp_jid=f"55119999900{jid_suffix}@s.whatsapp.net",
        name=name,
        phone=phone,
        status=status,
    )
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    conv = Conversation(
        lead_id=lead.id,
        last_intent=last_intent,
        last_message_at=last_message_at or _now(),
    )
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return lead, conv


async def test_list_conversations_returns_pagination_envelope(
    client: AsyncClient, session: AsyncSession
):
    response = await client.get("/api/conversations")
    assert response.status_code == 200
    body = response.json()
    assert body == {"items": [], "total": 0, "limit": 50, "offset": 0}


async def test_list_conversations_orders_by_last_message_at_desc(
    client: AsyncClient, session: AsyncSession
):
    older = _now() - timedelta(hours=2)
    newer = _now()
    await _seed_pair(session, jid_suffix="0001", name="Antiga", last_message_at=older)
    await _seed_pair(session, jid_suffix="0002", name="Recente", last_message_at=newer)

    response = await client.get("/api/conversations")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["lead"]["name"] for i in items] == ["Recente", "Antiga"]


async def test_list_conversations_filters_by_lead_status(
    client: AsyncClient, session: AsyncSession
):
    await _seed_pair(session, jid_suffix="0001", name="Lead Novo", status=LeadStatus.NEW)
    await _seed_pair(
        session, jid_suffix="0002", name="Lead Qualificado", status=LeadStatus.QUALIFIED
    )

    response = await client.get("/api/conversations", params={"status": "qualified"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["lead"]["name"] == "Lead Qualificado"


async def test_list_conversations_searches_by_name_phone_or_jid(
    client: AsyncClient, session: AsyncSession
):
    await _seed_pair(session, jid_suffix="0001", name="Maria Souza", phone="+5511911111111")
    await _seed_pair(session, jid_suffix="0002", name="João Silva", phone="+5511922222222")

    by_name = await client.get("/api/conversations", params={"q": "maria"})
    assert by_name.status_code == 200
    assert [i["lead"]["name"] for i in by_name.json()["items"]] == ["Maria Souza"]

    by_phone = await client.get("/api/conversations", params={"q": "92222222"})
    assert by_phone.status_code == 200
    assert [i["lead"]["name"] for i in by_phone.json()["items"]] == ["João Silva"]


async def test_list_conversations_paginates_via_limit_and_offset(
    client: AsyncClient, session: AsyncSession
):
    base = _now()
    for i in range(5):
        await _seed_pair(
            session,
            jid_suffix=f"{i:04d}",
            name=f"Conv {i}",
            last_message_at=base - timedelta(minutes=i),
        )

    page1 = await client.get("/api/conversations", params={"limit": 2, "offset": 0})
    page2 = await client.get("/api/conversations", params={"limit": 2, "offset": 2})

    assert page1.status_code == 200 and page2.status_code == 200
    assert page1.json()["total"] == 5
    assert [i["lead"]["name"] for i in page1.json()["items"]] == ["Conv 0", "Conv 1"]
    assert [i["lead"]["name"] for i in page2.json()["items"]] == ["Conv 2", "Conv 3"]


async def test_get_conversation_detail_returns_lead_summary(
    client: AsyncClient, session: AsyncSession
):
    _, conv = await _seed_pair(session, name="Detalhe", last_intent=Intent.PRICING)

    response = await client.get(f"/api/conversations/{conv.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(conv.id)
    assert body["lead"]["name"] == "Detalhe"
    assert body["last_intent"] == "pricing"


async def test_get_conversation_returns_404_when_missing(client: AsyncClient):
    response = await client.get(f"/api/conversations/{uuid4()}")
    assert response.status_code == 404


async def test_list_conversations_requires_admin_token(client: AsyncClient):
    response = await client.get("/api/conversations", headers={"X-Admin-Token": ""})
    assert response.status_code == 401


async def test_list_conversations_rejects_invalid_admin_token(client: AsyncClient):
    """Confirma que `compare_digest` realmente compara — não basta header presente."""
    response = await client.get(
        "/api/conversations", headers={"X-Admin-Token": "this-is-not-the-token"}
    )
    assert response.status_code == 401


async def test_list_conversations_combines_status_and_q_filters(
    client: AsyncClient, session: AsyncSession
):
    await _seed_pair(session, jid_suffix="0001", name="Maria Souza", status=LeadStatus.NEW)
    await _seed_pair(session, jid_suffix="0002", name="Maria Lima", status=LeadStatus.QUALIFIED)
    await _seed_pair(session, jid_suffix="0003", name="João Souza", status=LeadStatus.QUALIFIED)

    response = await client.get("/api/conversations", params={"status": "qualified", "q": "souza"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["lead"]["name"] == "João Souza"


async def test_list_conversations_offset_beyond_total_returns_empty(
    client: AsyncClient, session: AsyncSession
):
    await _seed_pair(session, jid_suffix="0001", name="Único")

    response = await client.get("/api/conversations", params={"offset": 100})

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 1


async def test_list_conversations_q_does_not_treat_percent_as_wildcard(
    client: AsyncClient, session: AsyncSession
):
    """`q="%"` deve buscar literal e não casar com tudo (escape de wildcard)."""
    await _seed_pair(session, jid_suffix="0001", name="Sem porcento")
    await _seed_pair(session, jid_suffix="0002", name="100% Garantia")

    response = await client.get("/api/conversations", params={"q": "%"})

    assert response.status_code == 200
    items = response.json()["items"]
    assert {i["lead"]["name"] for i in items} == {"100% Garantia"}


# ----- POST /api/conversations/{id}/messages (envio manual humano) -----


class _StubEvoOK:
    """Mock do EvolutionClient pra cenário "send_text deu certo"."""

    def __init__(self):
        self.calls: list[dict] = []

    async def send_text(self, *, number: str, text: str, **_):
        self.calls.append({"number": number, "text": text})
        return {"key": {"id": "WA-FAKE-12345"}, "status": "ok"}


class _StubEvoFail:
    """Mock pra cenário "Evolution rejeitou (502 down)"."""

    async def send_text(self, *_, **__):
        from app.services.whatsapp.evolution_client import EvolutionAPIError

        raise EvolutionAPIError("evolution down")


async def test_send_manual_message_persists_out_and_calls_evolution(
    client: AsyncClient, session: AsyncSession, monkeypatch
):
    _, conv = await _seed_pair(session, name="Cliente Manual")
    stub = _StubEvoOK()
    # Substitui o client global usado pelo endpoint.
    from app.api.routes import conversations as conv_module

    monkeypatch.setattr(conv_module, "get_evolution_client", lambda: stub)

    response = await client.post(
        f"/api/conversations/{conv.id}/messages", json={"content": "Oi, Vinicius aqui."}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["direction"] == "out"
    assert body["type"] == "text"
    assert body["content"] == "Oi, Vinicius aqui."
    assert body["status"] == "sent"
    assert body["whatsapp_message_id"] == "WA-FAKE-12345"
    assert len(stub.calls) == 1
    assert stub.calls[0]["text"] == "Oi, Vinicius aqui."


async def test_send_manual_message_502_when_evolution_fails(
    client: AsyncClient, session: AsyncSession, monkeypatch
):
    _, conv = await _seed_pair(session)
    from app.api.routes import conversations as conv_module

    monkeypatch.setattr(conv_module, "get_evolution_client", lambda: _StubEvoFail())

    response = await client.post(
        f"/api/conversations/{conv.id}/messages", json={"content": "tentativa"}
    )

    assert response.status_code == 502


async def test_send_manual_message_404_for_missing_conversation(client: AsyncClient, monkeypatch):
    from app.api.routes import conversations as conv_module

    monkeypatch.setattr(conv_module, "get_evolution_client", lambda: _StubEvoOK())
    response = await client.post(f"/api/conversations/{uuid4()}/messages", json={"content": "hi"})
    assert response.status_code == 404


async def test_send_manual_message_validates_content(
    client: AsyncClient, session: AsyncSession, monkeypatch
):
    _, conv = await _seed_pair(session)
    from app.api.routes import conversations as conv_module

    monkeypatch.setattr(conv_module, "get_evolution_client", lambda: _StubEvoOK())

    # vazio
    empty = await client.post(f"/api/conversations/{conv.id}/messages", json={"content": ""})
    assert empty.status_code == 422
    # > 4096 chars
    too_long = await client.post(
        f"/api/conversations/{conv.id}/messages", json={"content": "x" * 5000}
    )
    assert too_long.status_code == 422


async def test_send_manual_message_requires_admin_token(client: AsyncClient, session: AsyncSession):
    _, conv = await _seed_pair(session)
    response = await client.post(
        f"/api/conversations/{conv.id}/messages",
        json={"content": "hi"},
        headers={"X-Admin-Token": ""},
    )
    assert response.status_code == 401
