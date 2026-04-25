"""Webhook recebido pela Evolution API. Ponto de entrada de toda mensagem do WhatsApp."""

from __future__ import annotations

import hmac
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import get_settings
from app.core.socketio import emit_global
from app.db.session import SessionLocal
from app.services.conversation_orchestrator import ConversationOrchestrator
from app.services.whatsapp.payload import normalize_event, parse_messages_upsert

# Limite de tamanho do body do webhook (~25 MB — alinhado com STT do Whisper).
# Áudio/imagem em base64 (webhook.base64=true) chegam embutidos no payload.
MAX_WEBHOOK_BODY_BYTES = 25 * 1024 * 1024


def _mask_jid(jid: str | None) -> str:
    """Mascara o número telefônico no JID para reduzir PII em logs."""
    if not jid:
        return "<empty>"
    local = jid.split("@", 1)[0]
    if len(local) <= 4:
        return f"****@{jid.split('@', 1)[1]}" if "@" in jid else "****"
    masked = f"{local[:2]}****{local[-2:]}"
    suffix = jid.split("@", 1)[1] if "@" in jid else ""
    return f"{masked}@{suffix}" if suffix else masked

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

    # Auth obrigatória (#31). Comparação timing-safe via hmac.compare_digest.
    expected = settings.evolution_api_key
    if not expected:
        # Sem chave configurada: rejeita por segurança em vez de aceitar tudo.
        logger.error("webhook_apikey_not_configured")
        raise HTTPException(status_code=503, detail="webhook not configured")
    if not x_apikey or not hmac.compare_digest(x_apikey, expected):
        raise HTTPException(status_code=401, detail="invalid apikey")

    # Cap de tamanho do body (#34). Confiar no Content-Length quando presente;
    # caso ausente (chunked), continuar — Starlette/uvicorn já tem limite default.
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_WEBHOOK_BODY_BYTES:
        raise HTTPException(status_code=413, detail="payload too large")

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
                # Loga full exc internamente; resposta ao Evolution é genérica para não
                # vazar stack/SQL hints (achado [Médio] do security review).
                logger.exception(
                    "orchestrator_failed",
                    extra={
                        "error_class": exc.__class__.__name__,
                        "remote_jid": _mask_jid(parsed.remote_jid),
                    },
                )
                await emit_global(
                    "error",
                    {"code": "orchestrator_failed", "message": "internal_error"},
                )
                # Devolver 200 para Evolution não fazer redelivery infinita.
                return {"status": "error"}
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
