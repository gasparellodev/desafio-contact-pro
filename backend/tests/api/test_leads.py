"""Testes do endpoint GET /api/leads/{id}."""

from __future__ import annotations

from uuid import uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import LeadStatus, ServiceInterest
from app.models.lead import Lead


async def _make_lead(session: AsyncSession, **overrides) -> Lead:
    lead = Lead(
        whatsapp_jid=overrides.get("whatsapp_jid", "5511999990001@s.whatsapp.net"),
        name=overrides.get("name", "Cliente Teste"),
        company=overrides.get("company", "Acme Inc"),
        phone=overrides.get("phone", "+5511999990001"),
        service_interest=overrides.get("service_interest", ServiceInterest.CONTACT_Z),
        status=overrides.get("status", LeadStatus.QUALIFIED),
    )
    session.add(lead)
    await session.commit()
    await session.refresh(lead)
    return lead


async def test_get_lead_returns_full_payload(client: AsyncClient, session: AsyncSession):
    lead = await _make_lead(session)

    response = await client.get(f"/api/leads/{lead.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(lead.id)
    assert body["whatsapp_jid"] == "5511999990001@s.whatsapp.net"
    assert body["name"] == "Cliente Teste"
    assert body["company"] == "Acme Inc"
    assert body["phone"] == "+5511999990001"
    assert body["service_interest"] == "contact_z"
    assert body["status"] == "qualified"
    assert "created_at" in body and "updated_at" in body


async def test_get_lead_returns_404_when_missing(client: AsyncClient):
    response = await client.get(f"/api/leads/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"] == "lead not found"


async def test_get_lead_requires_admin_token(client: AsyncClient, session: AsyncSession):
    lead = await _make_lead(session)
    # Remove o header padrão para testar 401
    response = await client.get(f"/api/leads/{lead.id}", headers={"X-Admin-Token": ""})
    assert response.status_code == 401
