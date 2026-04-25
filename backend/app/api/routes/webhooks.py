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

        # 1) Persiste IN + reactions + STT/vision (steps 1-5 do pipeline).
        # 2) Enfileira no buffer Redis com debounce — worker async agrega
        #    mensagens consecutivas (< MESSAGE_BUFFER_DEBOUNCE_SECONDS) em
        #    1 só chamada de IA. Reduz custo + melhora contexto da resposta.
        async with SessionLocal() as session:
            orchestrator = ConversationOrchestrator(session)
            try:
                msg = await orchestrator.persist_incoming(parsed)
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "orchestrator_persist_failed",
                    extra={
                        "error_class": exc.__class__.__name__,
                        "remote_jid": _mask_jid(parsed.remote_jid),
                    },
                )
                await emit_global(
                    "error",
                    {"code": "orchestrator_failed", "message": "internal_error"},
                )
                return {"status": "error"}

        if msg is None:
            # Descartada (from_me / duplicata / lead pausado). Sem enqueue.
            return {"status": "skipped", "id": parsed.whatsapp_message_id}

        # Enqueue no Redis pro worker processar batched.
        try:
            from app.core.redis import get_redis
            from app.services.message_buffer import enqueue

            redis_client = get_redis()
            await enqueue(
                redis_client,
                conversation_id=str(msg.conversation_id),
                message_id=str(msg.id),
                debounce_seconds=settings.message_buffer_debounce_seconds,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "buffer_enqueue_failed",
                extra={
                    "error_class": exc.__class__.__name__,
                    "message_id": str(msg.id),
                },
            )
            # Fallback: processa síncrono se Redis estiver fora.
            async with SessionLocal() as session:
                fallback = ConversationOrchestrator(session)
                try:
                    await fallback.process_pending(
                        str(msg.conversation_id), [str(msg.id)]
                    )
                except Exception:
                    logger.exception("fallback_process_failed")

        return {"status": "queued", "id": parsed.whatsapp_message_id}

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
