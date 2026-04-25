from typing import Any

import httpx
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(session: AsyncSession = Depends(get_session)) -> dict[str, Any]:
    settings = get_settings()
    status = {"status": "ok", "db": "unknown", "redis": "unknown", "evolution": "unknown"}

    # Postgres
    try:
        await session.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as exc:  # noqa: BLE001
        status["db"] = f"error: {exc.__class__.__name__}"
        status["status"] = "degraded"

    # Redis
    try:
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        await redis.ping()
        await redis.close()
        status["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        status["redis"] = f"error: {exc.__class__.__name__}"
        status["status"] = "degraded"

    # Evolution
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(f"{settings.evolution_api_url}/")
            status["evolution"] = "ok" if r.status_code < 500 else f"error: {r.status_code}"
    except Exception as exc:  # noqa: BLE001
        status["evolution"] = f"error: {exc.__class__.__name__}"
        status["status"] = "degraded"

    return status
