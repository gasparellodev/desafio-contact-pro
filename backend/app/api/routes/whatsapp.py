"""Rotas de controle da instância WhatsApp.

Permitem ao frontend pegar o QR Code, status da conexão e disparar criação
da instância na primeira execução. As chamadas são proxy para o Evolution.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.security import require_admin_token
from app.services.whatsapp.evolution_client import EvolutionAPIError, get_evolution_client

# Todas as rotas exigem `X-Admin-Token` (issue #33). Vazio em settings = 503.
router = APIRouter(
    prefix="/api/whatsapp",
    tags=["whatsapp"],
    dependencies=[Depends(require_admin_token)],
)


@router.post("/instance")
async def create_instance() -> dict:
    """Idempotente: se a instância já existir, devolve o erro original (4xx)."""
    client = get_evolution_client()
    try:
        result = await client.create_instance()
    except EvolutionAPIError as exc:
        # Quando a instância já existe, Evolution retorna 4xx. O frontend pode tratar.
        return {"status": "exists_or_error", "detail": str(exc)}
    return {"status": "created", "data": result}


@router.get("/qrcode")
async def get_qrcode() -> dict:
    client = get_evolution_client()
    try:
        return await client.connect()
    except EvolutionAPIError as exc:
        # Não vaza str(exc) (URLs internas / hints SQL); detalhe completo vai para o log.
        import logging

        logging.getLogger(__name__).exception(
            "evolution_proxy_error", extra={"error_class": exc.__class__.__name__}
        )
        raise HTTPException(status_code=502, detail="evolution unreachable") from exc


@router.get("/connection")
async def get_connection_state() -> dict:
    client = get_evolution_client()
    try:
        return await client.connection_state()
    except EvolutionAPIError as exc:
        # Não vaza str(exc) (URLs internas / hints SQL); detalhe completo vai para o log.
        import logging

        logging.getLogger(__name__).exception(
            "evolution_proxy_error", extra={"error_class": exc.__class__.__name__}
        )
        raise HTTPException(status_code=502, detail="evolution unreachable") from exc


@router.post("/webhook")
async def setup_webhook() -> dict:
    """Configura o webhook do Evolution apontando para este backend."""
    from app.core.config import get_settings

    settings = get_settings()
    client = get_evolution_client()
    try:
        # Repassa `apikey` como header customizado nos webhooks do Evolution para
        # nosso backend conseguir validar a origem (issue #31 deixou apikey obrigatório).
        return await client.set_webhook(
            url=settings.evolution_webhook_url,
            base64=True,
            headers={"apikey": settings.evolution_api_key},
        )
    except EvolutionAPIError as exc:
        # Não vaza str(exc) (URLs internas / hints SQL); detalhe completo vai para o log.
        import logging

        logging.getLogger(__name__).exception(
            "evolution_proxy_error", extra={"error_class": exc.__class__.__name__}
        )
        raise HTTPException(status_code=502, detail="evolution unreachable") from exc
