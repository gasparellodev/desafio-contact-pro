"""TTS via OpenAI gpt-4o-mini-tts (saída em opus para PTT do WhatsApp)."""

from __future__ import annotations

import logging

from openai import AsyncOpenAI

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class OpenAITTS:
    name = "openai"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model = self.settings.tts_model
        self.voice = self.settings.tts_voice
        self.format = self.settings.tts_format
        self.client = AsyncOpenAI(api_key=self.settings.active_tts_api_key)

    async def synthesize(
        self, *, text: str, instructions: str | None = None
    ) -> bytes:
        """Gera bytes de áudio. `response_format=opus` é o formato nativo do PTT do WhatsApp."""
        kwargs: dict = {
            "model": self.model,
            "voice": self.voice,
            "response_format": self.format,
            "input": text,
        }
        if instructions and self.model.startswith("gpt-4o-mini-tts"):
            kwargs["instructions"] = instructions
        try:
            # `with_streaming_response` é o caminho correto para obter bytes em SDKs >=1.50;
            # `create` direto retorna `LegacyAPIResponse` cujo `.content` já é bytes (sync),
            # mas para evitar a deprecação de `LegacyAPIResponse.read()` usamos streaming.
            async with self.client.audio.speech.with_streaming_response.create(
                **kwargs
            ) as resp:
                chunks = []
                async for chunk in resp.iter_bytes():
                    chunks.append(chunk)
                return b"".join(chunks)
        except Exception as exc:  # noqa: BLE001
            logger.exception("tts_failed", extra={"model": self.model, "error": str(exc)})
            raise


_singleton: OpenAITTS | None = None


def get_tts() -> OpenAITTS:
    global _singleton
    if _singleton is None:
        _singleton = OpenAITTS()
    return _singleton
