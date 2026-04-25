"""Webhook recebido pela Evolution API. Ponto de entrada de toda mensagem do WhatsApp."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import get_settings
from app.core.socketio import emit_global
from app.services.whatsapp.payload import normalize_event, parse_messages_upsert

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/evolution", status_code=status.HTTP_200_OK)
async def evolution_webhook(
    request: Request,
    x_apikey: str | None = Header(default=None, alias="apikey"),
) -> dict[str, Any]:
    """Recebe eventos do Evolution. Valida apikey quando o webhook foi
    configurado para enviá-la (header opcional na config v2).

    Eventos tratados nesta entrega:
    - messages.upsert  → registra mensagem; orchestrator (PR #9) processa
    - connection.update → emite estado para o frontend
    - qrcode.updated   → emite QR para o frontend
    """
    settings = get_settings()

    # Validação leve — Evolution v2 não envia apikey por padrão no webhook,
    # então só validamos quando vier preenchido pelo client.
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
        # Orchestrator será conectado no PR #9. Por ora, apenas emite snapshot.
        await emit_global(
            "wa.message.received.raw",
            {
                "id": parsed.whatsapp_message_id,
                "remote_jid": parsed.remote_jid,
                "from_me": parsed.from_me,
                "type": parsed.message_type.value,
                "text": parsed.text,
                "has_media": bool(parsed.media_base64),
                "media_mime": parsed.media_mime,
            },
        )
        return {"status": "received", "id": parsed.whatsapp_message_id}

    if event in {"connection.update"}:
        data = payload.get("data") or {}
        await emit_global(
            "wa.connection.update",
            {"state": data.get("state"), "statusReason": data.get("statusReason")},
        )
        return {"status": "ok"}

    if event in {"qrcode.updated"}:
        data = payload.get("data") or {}
        await emit_global(
            "wa.qrcode.updated",
            {"qrcode": data.get("qrcode") or data.get("base64")},
        )
        return {"status": "ok"}

    return {"status": "ignored", "event": event}
