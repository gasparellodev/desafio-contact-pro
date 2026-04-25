"""Parser de payloads do webhook Evolution v2.

Formato do evento (com `webhook.base64=true`):

{
  "event": "messages.upsert",          # ou MESSAGES_UPSERT em alguns deploys
  "instance": "contactpro",
  "data": {
    "key": { "remoteJid": "...@s.whatsapp.net", "fromMe": false, "id": "3EB0..." },
    "pushName": "...",
    "messageType": "conversation" | "audioMessage" | "imageMessage" | "extendedTextMessage" | ...,
    "message": {
      "conversation": "texto",
      "extendedTextMessage": { "text": "..." },
      "audioMessage": { "ptt": true, "mimetype": "audio/ogg; codecs=opus", "seconds": 5 },
      "imageMessage": { "caption": "...", "mimetype": "image/jpeg" },
      "base64": "<media base64 quando webhook.base64=true>"
    },
    "messageTimestamp": 1714000000
  }
}
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.models.enums import MessageType


@dataclass
class ParsedMessage:
    event: str
    whatsapp_message_id: str
    remote_jid: str
    from_me: bool
    push_name: str | None
    message_type: MessageType
    text: str
    media_base64: str | None
    media_mime: str | None
    raw: dict[str, Any]


def normalize_event(name: str | None) -> str:
    return (name or "").replace("_", ".").lower()


def parse_messages_upsert(payload: dict[str, Any]) -> ParsedMessage | None:
    """Extrai os campos relevantes de um evento messages.upsert. Retorna None
    quando o payload não contém uma mensagem válida (e.g. outra estrutura)."""
    data = payload.get("data") or {}
    key = data.get("key") or {}
    if not key.get("id") or not key.get("remoteJid"):
        return None

    raw_type = (data.get("messageType") or "").lower()
    text = ""
    media_base64: str | None = None
    media_mime: str | None = None
    msg = data.get("message") or {}

    if raw_type in {"conversation", "extendedtextmessage"}:
        msg_type = MessageType.TEXT
        text = msg.get("conversation") or (msg.get("extendedTextMessage") or {}).get("text", "")
    elif raw_type == "audiomessage":
        msg_type = MessageType.AUDIO
        audio = msg.get("audioMessage") or {}
        media_mime = audio.get("mimetype")
        media_base64 = msg.get("base64")
    elif raw_type == "imagemessage":
        msg_type = MessageType.IMAGE
        image = msg.get("imageMessage") or {}
        media_mime = image.get("mimetype")
        text = image.get("caption", "") or ""
        media_base64 = msg.get("base64")
    else:
        # Tipo não suportado nesta entrega — ignorar silenciosamente.
        return None

    return ParsedMessage(
        event=normalize_event(payload.get("event")),
        whatsapp_message_id=key["id"],
        remote_jid=key["remoteJid"],
        from_me=bool(key.get("fromMe")),
        push_name=data.get("pushName"),
        message_type=msg_type,
        text=text or "",
        media_base64=media_base64,
        media_mime=media_mime,
        raw=payload,
    )


def jid_to_phone(remote_jid: str) -> str:
    """Extrai o número do JID (e.g. '5511999999999@s.whatsapp.net' → '5511999999999')."""
    return remote_jid.split("@", 1)[0] if "@" in remote_jid else remote_jid
