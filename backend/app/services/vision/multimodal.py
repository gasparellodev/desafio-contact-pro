"""Wrapper sobre o AIProvider.describe_image — adapta inputs do orchestrator."""

from __future__ import annotations

import logging

from app.services.ai.base import AIProvider
from app.services.ai.factory import get_ai_provider

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 4 * 1024 * 1024  # ~4MB → ~3MB em base64; Anthropic limit ~3.75MB


async def describe_image(
    *,
    image_bytes: bytes,
    mime_type: str,
    hint: str = "",
    provider: AIProvider | None = None,
) -> str:
    if len(image_bytes) > MAX_IMAGE_BYTES:
        logger.warning("vision_image_too_large", extra={"size": len(image_bytes)})
        return "[imagem muito grande para descrição]"
    import base64

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    prov = provider or get_ai_provider()
    try:
        return await prov.describe_image(
            image_base64=image_b64, mime_type=mime_type, hint=hint
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("vision_describe_failed", extra={"error": str(exc)})
        return ""
