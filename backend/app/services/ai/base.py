"""Contrato comum dos providers de IA. OpenAI e Anthropic implementam.

A camada acima (orchestrator) só consome `AIProvider` — nunca importa
implementações concretas.
"""

from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel, Field

from app.models.enums import Intent, LeadStatus, ServiceInterest

ChatRole = Literal["user", "assistant"]


class ChatTurn(BaseModel):
    role: ChatRole
    content: str


class LeadExtracted(BaseModel):
    """Campos que a IA tenta extrair da conversa para preencher o Lead."""

    name: str | None = None
    company: str | None = None
    phone: str | None = None
    service_interest: ServiceInterest | None = None
    lead_goal: str | None = None
    estimated_volume: str | None = None


class AIResponse(BaseModel):
    """Saída estruturada padronizada — mesma forma para qualquer provider."""

    reply: str = Field(..., description="Mensagem em PT-BR a ser enviada ao lead.")
    intent: Intent = Field(..., description="Intenção classificada da última mensagem.")
    lead_extracted: LeadExtracted = Field(default_factory=LeadExtracted)
    status_suggestion: LeadStatus | None = Field(
        default=None,
        description="Sugestão de status do lead após esta resposta.",
    )


class AIProvider(Protocol):
    """Interface mínima que orchestrator espera de qualquer provider."""

    name: str
    model: str

    async def generate_response(
        self,
        *,
        system_prompt: str,
        history: list[ChatTurn],
        user_message: str,
    ) -> AIResponse: ...

    async def describe_image(self, *, image_base64: str, mime_type: str, hint: str = "") -> str:
        """Retorna descrição textual da imagem (para alimentar o pipeline de texto)."""
        ...
