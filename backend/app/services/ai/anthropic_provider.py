"""Anthropic provider — structured output via tool_choice + cache_control no system prompt."""

from __future__ import annotations

import json
import logging
from typing import Any

from anthropic import AsyncAnthropic

from app.core.config import Settings, get_settings
from app.services.ai.base import AIResponse, ChatTurn

logger = logging.getLogger(__name__)

# Schema do tool — mesmo shape do AIResponse Pydantic.
EMIT_TOOL_SCHEMA: dict[str, Any] = {
    "name": "emit_response",
    "description": (
        "Emite a resposta estruturada do assistente comercial."
        " Sempre que receber input do usuário, chame esta tool com a estrutura completa."
    ),
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["reply", "intent", "lead_extracted"],
        "properties": {
            "reply": {"type": "string"},
            "intent": {
                "type": "string",
                "enum": [
                    "contact_z",
                    "contact_tel",
                    "mailing",
                    "data_enrichment",
                    "pricing",
                    "human_handoff",
                    "opt_out",
                    "support",
                    "general_question",
                ],
            },
            "lead_extracted": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": ["string", "null"]},
                    "company": {"type": ["string", "null"]},
                    "phone": {"type": ["string", "null"]},
                    "service_interest": {
                        "type": ["string", "null"],
                        "enum": [
                            "contact_z",
                            "contact_tel",
                            "mailing",
                            "data_enrichment",
                            "unknown",
                            None,
                        ],
                    },
                    "lead_goal": {"type": ["string", "null"]},
                    "estimated_volume": {"type": ["string", "null"]},
                },
            },
            "status_suggestion": {
                "type": ["string", "null"],
                "enum": ["new", "qualified", "needs_human", "opt_out", None],
            },
        },
    },
}


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model = self.settings.ai_model
        if self.model == "gpt-4o-mini":  # fallback default não faz sentido aqui
            self.model = "claude-sonnet-4-6"
        self.client = AsyncAnthropic(api_key=self.settings.active_ai_api_key)

    async def generate_response(
        self,
        *,
        system_prompt: str,
        history: list[ChatTurn],
        user_message: str,
    ) -> AIResponse:
        # System em block list para suportar prompt cache (cache_control: ephemeral).
        system_blocks: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ]
        messages: list[dict[str, Any]] = []
        for turn in history:
            messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user_message})

        try:
            resp = await self.client.messages.create(
                model=self.model,
                max_tokens=800,
                system=system_blocks,
                messages=messages,
                tools=[EMIT_TOOL_SCHEMA],
                tool_choice={"type": "tool", "name": "emit_response"},
                temperature=0.4,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("anthropic_generate_failed", extra={"error": str(exc)})
            raise

        # tool_use block é o primeiro com type=tool_use
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use":
                payload = block.input  # já é dict
                return AIResponse.model_validate(payload)

        raise RuntimeError("anthropic não emitiu tool_use esperado")

    async def describe_image(
        self, *, image_base64: str, mime_type: str, hint: str = ""
    ) -> str:
        text_prompt = (
            "Descreva sucintamente em português o que aparece nesta imagem para um "
            "assistente comercial entender o contexto."
        )
        if hint:
            text_prompt += f" Contexto adicional: {hint}"

        resp = await self.client.messages.create(
            model=self.model,
            max_tokens=300,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": text_prompt},
                    ],
                }
            ],
        )

        parts: list[str] = []
        for block in resp.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "\n".join(parts).strip()


# Helper para ler dict tipados (caso anthropic SDK retorne via .dict())
def _to_dict(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    return json.loads(json.dumps(obj, default=str))
