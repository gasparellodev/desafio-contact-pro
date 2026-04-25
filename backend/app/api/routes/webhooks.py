"""Webhook recebido pela Evolution API. Ponto de entrada de toda mensagem do WhatsApp."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import get_settings
from app.core.socketio import emit_global
from app.db.session import SessionLocal
from app.services.conversation_orchestrator import ConversationOrchestrator
from app.services.whatsapp.payload import normalize_event, parse_messages_upsert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/evolution", status_code=status.HTTP_200_OK)
async def evolution_webhook(
    request: Request,
    x_apikey: str | None = Header(default=None, alias="apikey"),
) -> dict[str, Any]:
    """Recebe eventos do Evolution. Valida apikey quando presente.

    Eventos tratados:
    - messages.upsert  → ConversationOrchestrator (texto/áudio/imagem)
    - connection.update → emite estado WhatsApp
    - qrcode.updated   → emite QR Code para UI
    """
    settings = get_settings()

    if x_apikey and settings.evolution_api_key and x_apikey != settings.evolution_api_key:
        raise HTTPException(status_code=401, detail="invalid apikey")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="invalid json") from None

    event = normalize_event(payload.get("event"))
    logger.info("webhook_received", extra={"event": event, "instance": payload.get("instance")})

    if event in {"messages.upsert"}:
        parsed = parse_messages_upsert(payload)
        if parsed is None:
            return {"status": "ignored", "reason": "unsupported_message_type"}
        if parsed.from_me:
            return {"status": "ignored", "reason": "self_message"}

        # ConversationOrchestrator administra a sessão internamente.
        async with SessionLocal() as session:
            orchestrator = ConversationOrchestrator(session)
            try:
                await orchestrator.handle_incoming(parsed)
            except Exception as exc:  # noqa: BLE001
                logger.exception("orchestrator_failed", extra={"error": str(exc)})
                await emit_global(
                    "error",
                    {"code": "orchestrator_failed", "message": str(exc)},
                )
                # Devolver 200 para Evolution não fazer redelivery infinita.
                return {"status": "error", "detail": str(exc)[:200]}
        return {"status": "processed", "id": parsed.whatsapp_message_id}

    if event in {"connection.update"}:
        data = payload.get("data") or {}
        await emit_global(
            "wa.connection.update",
            {"state": data.get("state"), "statusReason": data.get("statusReason")},
        )
        return {"status": "ok"}

    if event in {"qrcode.updated"}:
        data = payload.get("data") or {}
        qr = data.get("qrcode") or data.get("base64")
        await emit_global("wa.qrcode.updated", {"qrcode": qr})
        return {"status": "ok"}

    return {"status": "ignored", "event": event}
