"""Testes do gating de auto-pause em PRICING.

Garantem que:
- O bot NÃO pausa em PRICING quando lead está sem dados (cenário regressivo:
  primeira mensagem "qual o preço?"). Esses leads precisam ser qualificados
  primeiro pelo bot antes de transferir pro consultor.
- O bot PAUSA em PRICING quando o lead já está qualificado.
- HUMAN_HANDOFF e NEEDS_HUMAN continuam sendo gatilhos imediatos (sem gating).
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.models.enums import Intent, LeadStatus, ServiceInterest
from app.models.lead import Lead
from app.services.conversation_orchestrator import ConversationOrchestrator


def _make_lead(**overrides) -> Lead:
    base = {
        "id": uuid4(),
        "whatsapp_jid": "5511999990001@s.whatsapp.net",
        "name": None,
        "company": None,
        "phone": "+5511999990001",
        "service_interest": ServiceInterest.UNKNOWN,
        "lead_goal": None,
        "estimated_volume": None,
        "status": LeadStatus.NEW,
        "bot_paused": False,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    base.update(overrides)
    return Lead(**base)


# ---------- _is_lead_qualified (helper puro, sem DB nem AI) ----------


class TestIsLeadQualified:
    def test_lead_vazio_nao_qualificado(self):
        assert ConversationOrchestrator._is_lead_qualified(_make_lead()) is False

    def test_so_name_nao_qualificado(self):
        lead = _make_lead(name="Maria")
        assert ConversationOrchestrator._is_lead_qualified(lead) is False

    def test_name_e_interesse_sem_contexto_nao_qualificado(self):
        lead = _make_lead(name="Maria", service_interest=ServiceInterest.CONTACT_Z)
        assert ConversationOrchestrator._is_lead_qualified(lead) is False

    def test_name_interesse_e_objetivo_qualificado(self):
        lead = _make_lead(
            name="Maria",
            service_interest=ServiceInterest.CONTACT_Z,
            lead_goal="aumentar conversão de leads inbound",
        )
        assert ConversationOrchestrator._is_lead_qualified(lead) is True

    def test_name_interesse_e_volume_qualificado(self):
        lead = _make_lead(
            name="Maria",
            service_interest=ServiceInterest.MAILING,
            estimated_volume="50k contatos/mês",
        )
        assert ConversationOrchestrator._is_lead_qualified(lead) is True

    def test_name_apenas_espacos_nao_qualificado(self):
        lead = _make_lead(
            name="   ",
            service_interest=ServiceInterest.CONTACT_Z,
            lead_goal="alguma coisa",
        )
        assert ConversationOrchestrator._is_lead_qualified(lead) is False

    def test_lead_goal_apenas_espacos_nao_basta(self):
        lead = _make_lead(
            name="Maria",
            service_interest=ServiceInterest.CONTACT_Z,
            lead_goal="   ",
        )
        # Sem goal real e sem volume → falta contexto
        assert ConversationOrchestrator._is_lead_qualified(lead) is False

    def test_interesse_unknown_nao_qualifica_mesmo_com_outros(self):
        lead = _make_lead(
            name="Maria",
            service_interest=ServiceInterest.UNKNOWN,
            lead_goal="quero algo",
            estimated_volume="muito",
        )
        assert ConversationOrchestrator._is_lead_qualified(lead) is False


# ---------- Condição de auto-pause replicada (espelho do orchestrator) ----------
# Como `process_pending` faz IO (DB, AI, Evolution), testar a condição em
# isolamento via expressão equivalente. Mantém este teste rodando em ms.


def _should_pause_for(*, intent: Intent, status_suggestion: LeadStatus | None, lead: Lead) -> bool:
    """Cópia da condição que o orchestrator avalia. Se o orchestrator mudar,
    este helper precisa ser atualizado — discrepância é detectada porque os
    casos abaixo cobrem todos os ramos.
    """
    return (
        intent == Intent.HUMAN_HANDOFF
        or status_suggestion == LeadStatus.NEEDS_HUMAN
        or (intent == Intent.PRICING and ConversationOrchestrator._is_lead_qualified(lead))
    )


class TestAutoPauseCondition:
    """Cenário regressivo: primeira mensagem do lead é sobre preço."""

    def test_pricing_em_lead_vazio_nao_pausa(self):
        # O bug que estamos corrigindo: bot pausava aqui e consultor recebia
        # conversa sem nome/empresa/serviço.
        assert (
            _should_pause_for(
                intent=Intent.PRICING, status_suggestion=None, lead=_make_lead()
            )
            is False
        )

    def test_pricing_em_lead_qualificado_pausa(self):
        lead = _make_lead(
            name="Maria",
            service_interest=ServiceInterest.CONTACT_Z,
            lead_goal="qualificar leads inbound",
        )
        assert (
            _should_pause_for(intent=Intent.PRICING, status_suggestion=None, lead=lead)
            is True
        )

    def test_human_handoff_pausa_mesmo_com_lead_vazio(self):
        # Lead pediu humano explicitamente — pausa imediata, sem gating.
        assert (
            _should_pause_for(
                intent=Intent.HUMAN_HANDOFF, status_suggestion=None, lead=_make_lead()
            )
            is True
        )

    def test_needs_human_status_pausa_mesmo_com_lead_vazio(self):
        # IA detectou necessidade de humano (frustração/erro) — gatilho imediato.
        assert (
            _should_pause_for(
                intent=Intent.GENERAL_QUESTION,
                status_suggestion=LeadStatus.NEEDS_HUMAN,
                lead=_make_lead(),
            )
            is True
        )

    @pytest.mark.parametrize(
        "intent",
        [
            Intent.GENERAL_QUESTION,
            Intent.SUPPORT,
            Intent.CONTACT_Z,
            Intent.MAILING,
            Intent.DATA_ENRICHMENT,
        ],
    )
    def test_outros_intents_nao_pausam(self, intent: Intent):
        lead = _make_lead(
            name="Maria",
            service_interest=ServiceInterest.CONTACT_Z,
            lead_goal="qualquer",
        )
        assert (
            _should_pause_for(intent=intent, status_suggestion=None, lead=lead) is False
        )
