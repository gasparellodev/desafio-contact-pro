"""Rotas de controle da instância WhatsApp.

Permitem ao frontend pegar o QR Code, status da conexão e disparar criação
da instância na primeira execução. As chamadas são proxy para o Evolution.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.whatsapp.evolution_client import EvolutionAPIError, get_evolution_client

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


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
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/connection")
async def get_connection_state() -> dict:
    client = get_evolution_client()
    try:
        return await client.connection_state()
    except EvolutionAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/webhook")
async def setup_webhook() -> dict:
    """Configura o webhook do Evolution apontando para este backend."""
    from app.core.config import get_settings

    settings = get_settings()
    client = get_evolution_client()
    try:
        return await client.set_webhook(
            url=settings.evolution_webhook_url,
            base64=True,
        )
    except EvolutionAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
