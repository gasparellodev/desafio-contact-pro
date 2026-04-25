"""Dependências de segurança comuns."""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException

from app.core.config import get_settings


async def require_admin_token(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> None:
    """Valida o header `X-Admin-Token` contra `settings.admin_api_token`.

    - Sem token configurado no servidor → 503 (rejeita por segurança).
    - Sem header ou header inválido → 401.
    - Comparação via `hmac.compare_digest` para timing-safe.
    """
    settings = get_settings()
    if not settings.admin_api_token:
        raise HTTPException(status_code=503, detail="admin endpoints not configured")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, settings.admin_api_token):
        raise HTTPException(status_code=401, detail="invalid admin token")
