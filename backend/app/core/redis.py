"""Singleton do cliente Redis async para todo o backend.

Centraliza para que o worker do buffer (`message_buffer.buffer_worker`),
o webhook (`enqueue`) e qualquer healthcheck reusem a mesma conexão pool.
"""

from __future__ import annotations

import logging

from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_client: Redis | None = None


def get_redis() -> Redis:
    """Retorna o singleton. Conexão é lazy via redis-py (criada no 1º comando)."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = Redis.from_url(settings.redis_url, decode_responses=False)
        logger.info("redis_singleton_created", extra={"url": settings.redis_url})
    return _client


async def close_redis() -> None:
    """Fecha o cliente no shutdown do app."""
    global _client
    if _client is not None:
        try:
            await _client.aclose()
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis_close_failed", extra={"error_class": exc.__class__.__name__})
        finally:
            _client = None
