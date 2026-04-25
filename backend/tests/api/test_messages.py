"""Testes do endpoint GET /api/conversations/{id}/messages."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.models.enums import Direction, MessageType
from app.models.lead import Lead
from app.models.message import Message


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _seed_conversation(session: AsyncSession) -> UUID:
    lead = Lead(whatsapp_jid="5511988880001@s.whatsapp.net", name="Cliente Msgs")
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    conv = Conversation(lead_id=lead.id)
    session.add(conv)
    await session.commit()
    await session.refresh(conv)
    return conv.id


async def _seed_messages(
    session: AsyncSession, conversation_id: UUID, count: int, *, base: datetime | None = None
) -> list[Message]:
    base = base or _now()
    messages = []
    for i in range(count):
        msg = Message(
            conversation_id=conversation_id,
            direction=Direction.IN if i % 2 == 0 else Direction.OUT,
            type=MessageType.TEXT,
            content=f"msg {i}",
            created_at=base - timedelta(minutes=count - i),
        )
        session.add(msg)
        messages.append(msg)
    await session.commit()
    return messages


async def test_list_messages_returns_chronological_order(
    client: AsyncClient, session: AsyncSession
):
    conv_id = await _seed_conversation(session)
    await _seed_messages(session, conv_id, count=3)

    response = await client.get(f"/api/conversations/{conv_id}/messages")

    assert response.status_code == 200
    items = response.json()["items"]
    assert [i["content"] for i in items] == ["msg 0", "msg 1", "msg 2"]


async def test_list_messages_default_limit_returns_most_recent(
    client: AsyncClient, session: AsyncSession
):
    conv_id = await _seed_conversation(session)
    await _seed_messages(session, conv_id, count=60)

    response = await client.get(f"/api/conversations/{conv_id}/messages", params={"limit": 10})

    assert response.status_code == 200
    body = response.json()
    assert body["limit"] == 10
    assert len(body["items"]) == 10
    # As 10 mais recentes, em ordem cronológica
    contents = [i["content"] for i in body["items"]]
    assert contents == [f"msg {i}" for i in range(50, 60)]
    assert body["next_before"] is not None


async def test_list_messages_supports_before_cursor(
    client: AsyncClient, session: AsyncSession
):
    conv_id = await _seed_conversation(session)
    await _seed_messages(session, conv_id, count=20)

    page1 = await client.get(
        f"/api/conversations/{conv_id}/messages", params={"limit": 5}
    )
    assert page1.status_code == 200
    next_before = page1.json()["next_before"]
    assert next_before is not None

    page2 = await client.get(
        f"/api/conversations/{conv_id}/messages",
        params={"limit": 5, "before": next_before},
    )
    assert page2.status_code == 200
    p1_ids = {i["id"] for i in page1.json()["items"]}
    p2_ids = {i["id"] for i in page2.json()["items"]}
    assert p1_ids.isdisjoint(p2_ids)
    assert len(page2.json()["items"]) == 5


async def test_list_messages_returns_404_for_missing_conversation(client: AsyncClient):
    response = await client.get(f"/api/conversations/{uuid4()}/messages")
    assert response.status_code == 404


async def test_list_messages_requires_admin_token(client: AsyncClient, session: AsyncSession):
    conv_id = await _seed_conversation(session)
    response = await client.get(
        f"/api/conversations/{conv_id}/messages", headers={"X-Admin-Token": ""}
    )
    assert response.status_code == 401


async def test_list_messages_clamps_limit(client: AsyncClient, session: AsyncSession):
    conv_id = await _seed_conversation(session)
    response = await client.get(
        f"/api/conversations/{conv_id}/messages", params={"limit": 9999}
    )
    assert response.status_code == 422
