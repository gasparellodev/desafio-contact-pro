"""STT via OpenAI Whisper."""

from __future__ import annotations

import io
import logging

from openai import AsyncOpenAI

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class OpenAITranscriber:
    name = "openai"

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.model = self.settings.stt_model
        self.client = AsyncOpenAI(api_key=self.settings.active_stt_api_key)

    async def transcribe(
        self,
        *,
        audio_bytes: bytes,
        mime_type: str | None = None,
        filename_hint: str = "audio.ogg",
        language: str | None = "pt",
    ) -> str:
        """Whisper aceita ogg/opus, m4a, mp3, wav. Limite 25 MB.

        WhatsApp PTT é ogg/opus por padrão.
        """
        # OpenAI lib espera arquivo-like com nome (extensão) — passa mime via filename
        ext = "ogg"
        if mime_type and "/" in mime_type:
            ext = mime_type.split("/", 1)[1].split(";")[0].strip()
            ext = {"mpeg": "mp3", "x-m4a": "m4a"}.get(ext, ext)
        filename = filename_hint if "." in filename_hint else f"audio.{ext}"

        buf = io.BytesIO(audio_bytes)
        buf.name = filename

        kwargs: dict = {"model": self.model, "file": buf}
        if language:
            kwargs["language"] = language

        try:
            resp = await self.client.audio.transcriptions.create(**kwargs)
        except Exception as exc:  # noqa: BLE001
            logger.exception("stt_failed", extra={"model": self.model, "error": str(exc)})
            raise

        text = getattr(resp, "text", None) or ""
        return text.strip()


_singleton: OpenAITranscriber | None = None


def get_transcriber() -> OpenAITranscriber:
    global _singleton
    if _singleton is None:
        _singleton = OpenAITranscriber()
    return _singleton
