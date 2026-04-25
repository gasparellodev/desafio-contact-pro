"""OpenAI provider — usa chat.completions.parse para structured output Pydantic."""

from __future__ import annotations

import logging
from typing import Any

from openai import AsyncOpenAI

from app.core.config import Settings, get_settings
from app.services.ai.base import AIResponse, ChatTurn

logger = logging.getLogger(__name__)


class OpenAIProvider:
    name = "openai"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model = self.settings.ai_model
        self.client = AsyncOpenAI(
            api_key=self.settings.active_ai_api_key,
        )

    async def generate_response(
        self,
        *,
        system_prompt: str,
        history: list[ChatTurn],
        user_message: str,
    ) -> AIResponse:
        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
        for turn in history:
            messages.append({"role": turn.role, "content": turn.content})
        messages.append({"role": "user", "content": user_message})

        try:
            completion = await self.client.chat.completions.parse(
                model=self.model,
                messages=messages,
                response_format=AIResponse,
                temperature=0.4,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("openai_generate_failed", extra={"error": str(exc)})
            raise

        parsed = completion.choices[0].message.parsed
        if parsed is None:
            raise RuntimeError("openai returned empty parsed response")
        return parsed

    async def describe_image(
        self, *, image_base64: str, mime_type: str, hint: str = ""
    ) -> str:
        prompt = (
            "Descreva sucintamente em português o que aparece nesta imagem "
            "para um assistente comercial entender o contexto. "
        )
        if hint:
            prompt += f"Contexto adicional: {hint}"
        completion = await self.client.chat.completions.create(
            model=self.settings.vision_model or self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{image_base64}"},
                        },
                    ],
                }
            ],
            temperature=0.3,
            max_tokens=300,
        )
        return completion.choices[0].message.content or ""
