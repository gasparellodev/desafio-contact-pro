"""Factory que escolhe o provider de IA conforme `settings.ai_provider`.

Outros módulos NUNCA importam OpenAIProvider/AnthropicProvider diretamente —
sempre via `get_ai_provider()`.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.anthropic_provider import AnthropicProvider
from app.services.ai.base import AIProvider
from app.services.ai.openai_provider import OpenAIProvider


@lru_cache
def get_ai_provider() -> AIProvider:
    settings = get_settings()
    if settings.ai_provider == "anthropic":
        return AnthropicProvider(settings)
    return OpenAIProvider(settings)
