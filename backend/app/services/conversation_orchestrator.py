"""ConversationOrchestrator — pipeline central de cada mensagem recebida.

Invariantes (NÃO QUEBRAR):
- Persiste antes de emitir Socket.IO.
- Idempotência por whatsapp_message_id (UNIQUE).
- Nunca envia ao WhatsApp sem persistir Message OUT primeiro.
- Erros em send/AI viram Message com status=FAILED + emit `error`.

Fluxo (texto; áudio/imagem entram nos PRs #11–14):
 1. parse webhook → lead upsert → conversation upsert → message IN persist
 2. emit wa.message.received + send 👍 + emit wa.reaction.sent
 3. (futuro) STT/Vision se for áudio/imagem
 4. ai.thinking start → AI provider → ai.thinking end
 5. atualiza lead + emit lead.updated, conversation.status_changed
 6. persist message OUT → send text via Evolution → atualiza message.status
 7. emit ai.response.generated + wa.message.sent + smart reaction
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.socketio import emit_global, emit_to_conversation
from app.models.conversation import Conversation
from app.models.enums import (
    Direction,
    Intent,
    LeadStatus,
    MessageStatus,
    MessageType,
    ServiceInterest,
)
from app.models.lead import Lead
from app.models.message import Message
from app.services.ai.base import AIProvider, AIResponse, ChatTurn
from app.services.ai.factory import get_ai_provider
from app.services.ai.prompts import build_system_prompt
from app.services.transcription.openai_stt import OpenAITranscriber, get_transcriber
from app.services.tts.openai_tts import OpenAITTS, get_tts
from app.services.vision.multimodal import describe_image as describe_image_async
from app.services.whatsapp.evolution_client import (
    EvolutionAPIError,
    EvolutionClient,
    get_evolution_client,
)
from app.services.whatsapp.payload import ParsedMessage, jid_to_phone

logger = logging.getLogger(__name__)

HISTORY_LIMIT = 12  # últimas N mensagens (IN+OUT) que entram no contexto da IA


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _msg_to_dict(msg: Message) -> dict:
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "whatsapp_message_id": msg.whatsapp_message_id,
        "direction": msg.direction.value if isinstance(msg.direction, Direction) else msg.direction,
        "type": msg.type.value if isinstance(msg.type, MessageType) else msg.type,
        "content": msg.content,
        "transcription": msg.transcription,
        "media_url": msg.media_url,
        "media_mime": msg.media_mime,
        "intent": msg.intent.value if isinstance(msg.intent, Intent) else msg.intent,
        "status": msg.status.value if isinstance(msg.status, MessageStatus) else msg.status,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


def _lead_to_dict(lead: Lead) -> dict:
    return {
        "id": str(lead.id),
        "whatsapp_jid": lead.whatsapp_jid,
        "name": lead.name,
        "company": lead.company,
        "phone": lead.phone,
        "service_interest": lead.service_interest.value
        if isinstance(lead.service_interest, ServiceInterest)
        else lead.service_interest,
        "lead_goal": lead.lead_goal,
        "estimated_volume": lead.estimated_volume,
        "status": lead.status.value if isinstance(lead.status, LeadStatus) else lead.status,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }


class ConversationOrchestrator:
    def __init__(
        self,
        session: AsyncSession,
        ai: AIProvider | None = None,
        whatsapp: EvolutionClient | None = None,
        transcriber: OpenAITranscriber | None = None,
        tts: OpenAITTS | None = None,
    ) -> None:
        self.session = session
        self.ai = ai or get_ai_provider()
        self.whatsapp = whatsapp or get_evolution_client()
        self.transcriber = transcriber or get_transcriber()
        self.tts = tts or get_tts()

    # ----- repository helpers (inline para 6h) -----

    async def _upsert_lead(self, *, jid: str, push_name: str | None) -> Lead:
        result = await self.session.execute(select(Lead).where(Lead.whatsapp_jid == jid))
        lead = result.scalar_one_or_none()
        if lead:
            if push_name and not lead.name:
                lead.name = push_name
                lead.updated_at = _now()
                self.session.add(lead)
            return lead
        lead = Lead(
            whatsapp_jid=jid,
            name=push_name,
            phone=jid_to_phone(jid),
        )
        self.session.add(lead)
        await self.session.flush()
        return lead

    async def _upsert_conversation(self, lead: Lead) -> Conversation:
        result = await self.session.execute(
            select(Conversation).where(Conversation.lead_id == lead.id)
        )
        conv = result.scalar_one_or_none()
        if conv:
            return conv
        conv = Conversation(lead_id=lead.id)
        self.session.add(conv)
        await self.session.flush()
        return conv

    async def _exists_message(self, whatsapp_message_id: str | None) -> bool:
        if not whatsapp_message_id:
            return False
        result = await self.session.execute(
            select(Message.id).where(Message.whatsapp_message_id == whatsapp_message_id)
        )
        return result.scalar_one_or_none() is not None

    async def _history(self, conversation_id: UUID) -> list[ChatTurn]:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        msgs = result.scalars().all()
        # mantemos as últimas HISTORY_LIMIT
        msgs = msgs[-HISTORY_LIMIT:]
        turns: list[ChatTurn] = []
        for m in msgs:
            role = "user" if m.direction == Direction.IN else "assistant"
            content = m.transcription or m.content or ""
            if not content:
                continue
            turns.append(ChatTurn(role=role, content=content))
        return turns

    # ----- main pipeline -----

    async def handle_incoming(self, parsed: ParsedMessage) -> None:
        """Pipeline completa para uma mensagem recebida."""
        if parsed.from_me:
            # mensagens enviadas pelo próprio bot — ignoramos no pipeline (ack via emit ja sai pelo fluxo OUT)
            return

        # 1. idempotência
        if await self._exists_message(parsed.whatsapp_message_id):
            logger.info("orchestrator_duplicate_ignored", extra={"id": parsed.whatsapp_message_id})
            return

        # 2. lead + conversation
        lead = await self._upsert_lead(jid=parsed.remote_jid, push_name=parsed.push_name)
        conv = await self._upsert_conversation(lead)

        # 3. persist IN
        msg_in = Message(
            conversation_id=conv.id,
            whatsapp_message_id=parsed.whatsapp_message_id,
            direction=Direction.IN,
            type=parsed.message_type,
            content=parsed.text,
            media_mime=parsed.media_mime,
            status=MessageStatus.RECEIVED,
        )
        self.session.add(msg_in)
        await self.session.commit()
        await self.session.refresh(msg_in)
        await emit_to_conversation(
            str(conv.id), "wa.message.received", _msg_to_dict(msg_in)
        )

        # 4. reaction 👍
        try:
            await self.whatsapp.send_reaction(
                remote_jid=parsed.remote_jid,
                message_id=parsed.whatsapp_message_id,
                from_me=False,
                emoji="👍",
            )
            await emit_to_conversation(
                str(conv.id),
                "wa.reaction.sent",
                {"messageId": parsed.whatsapp_message_id, "emoji": "👍"},
            )
        except EvolutionAPIError as exc:
            logger.warning("reaction_failed", extra={"error": str(exc)})

        # 5. áudio → STT; imagem → vision (multimodal)
        ai_input_text = parsed.text or ""
        if parsed.message_type == MessageType.IMAGE:
            description = await self._describe_image(parsed)
            if description:
                msg_in.transcription = description
                self.session.add(msg_in)
                await self.session.commit()
                await self.session.refresh(msg_in)
                await emit_to_conversation(
                    str(conv.id),
                    "audio.transcribed",
                    {"messageId": str(msg_in.id), "transcription": description},
                )
                caption = parsed.text or ""
                ai_input_text = (
                    f"[Lead enviou imagem. Descrição: {description}]"
                    + (f"\nLegenda: {caption}" if caption else "")
                )
            else:
                ai_input_text = "[imagem recebida — descrição indisponível]"
        elif parsed.message_type == MessageType.AUDIO:
            transcription = await self._transcribe_audio(parsed)
            if transcription:
                msg_in.transcription = transcription
                self.session.add(msg_in)
                await self.session.commit()
                await self.session.refresh(msg_in)
                await emit_to_conversation(
                    str(conv.id),
                    "audio.transcribed",
                    {"messageId": str(msg_in.id), "transcription": transcription},
                )
                ai_input_text = transcription
            else:
                ai_input_text = "[áudio recebido sem transcrição disponível]"
        if not ai_input_text:
            ai_input_text = "[mensagem sem texto]"

        # 6. AI thinking + chamada
        await emit_to_conversation(
            str(conv.id),
            "ai.thinking",
            {"conversationId": str(conv.id), "status": "start"},
        )
        history = await self._history(conv.id)
        # Remove última entrada que seria o user_message duplicado
        if history and history[-1].role == "user" and history[-1].content == ai_input_text:
            history = history[:-1]

        try:
            ai_resp: AIResponse = await self.ai.generate_response(
                system_prompt=build_system_prompt(),
                history=history,
                user_message=ai_input_text,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("ai_failed", extra={"error": str(exc)})
            await emit_to_conversation(
                str(conv.id),
                "ai.thinking",
                {"conversationId": str(conv.id), "status": "end"},
            )
            await emit_global("error", {"code": "ai_error", "message": str(exc)})
            await self._send_smart_reaction(parsed, "⚠️")
            return

        await emit_to_conversation(
            str(conv.id), "ai.thinking", {"conversationId": str(conv.id), "status": "end"}
        )

        # 7. atualiza lead a partir de extracted
        self._apply_extracted_to_lead(lead, ai_resp)
        if ai_resp.status_suggestion:
            lead.status = ai_resp.status_suggestion
        lead.updated_at = _now()
        conv.last_intent = ai_resp.intent
        conv.last_message_at = _now()
        self.session.add(lead)
        self.session.add(conv)

        # 8. persist OUT — se entrada foi áudio, responder em áudio
        out_type = MessageType.AUDIO if parsed.message_type == MessageType.AUDIO else MessageType.TEXT
        msg_out = Message(
            conversation_id=conv.id,
            direction=Direction.OUT,
            type=out_type,
            content=ai_resp.reply,
            intent=ai_resp.intent,
            status=MessageStatus.PENDING,
            quoted_message_id=msg_in.id,
        )
        self.session.add(msg_out)
        await self.session.commit()
        await self.session.refresh(msg_out)

        # 9. emit lead/conversation/ai.response (UI já mostra a resposta enquanto Evolution envia)
        await emit_to_conversation(str(conv.id), "lead.updated", _lead_to_dict(lead))
        await emit_to_conversation(
            str(conv.id),
            "conversation.status_changed",
            {"id": str(conv.id), "last_intent": ai_resp.intent.value},
        )
        await emit_to_conversation(
            str(conv.id), "ai.response.generated", _msg_to_dict(msg_out)
        )

        # 10. envio para o WhatsApp (texto OR áudio com TTS, com quoted)
        try:
            if out_type == MessageType.AUDIO:
                send_result = await self._send_audio_reply(parsed=parsed, reply_text=ai_resp.reply)
                msg_out.media_mime = f"audio/ogg; codecs={self.tts.format}"
            else:
                send_result = await self.whatsapp.send_text(
                    number=jid_to_phone(parsed.remote_jid),
                    text=ai_resp.reply,
                    quoted={
                        "key": {
                            "remoteJid": parsed.remote_jid,
                            "fromMe": False,
                            "id": parsed.whatsapp_message_id,
                        },
                        "message": {"conversation": parsed.text or ""},
                    },
                )
            wa_id = (send_result.get("key") or {}).get("id") if isinstance(send_result, dict) else None
            msg_out.whatsapp_message_id = wa_id
            msg_out.status = MessageStatus.SENT
        except EvolutionAPIError as exc:
            logger.exception("send_failed", extra={"error": str(exc), "type": out_type.value})
            msg_out.status = MessageStatus.FAILED
            msg_out.error_reason = str(exc)
            await emit_global(
                "error",
                {
                    "code": f"send_{out_type.value}_failed",
                    "message": str(exc),
                    "conversation_id": str(conv.id),
                },
            )
            # Fallback: se áudio falhou, tenta enviar como texto
            if out_type == MessageType.AUDIO:
                try:
                    await self.whatsapp.send_text(
                        number=jid_to_phone(parsed.remote_jid),
                        text=ai_resp.reply,
                    )
                    msg_out.status = MessageStatus.SENT
                    msg_out.error_reason = (msg_out.error_reason or "") + " | fallback texto enviado"
                except EvolutionAPIError as exc2:
                    msg_out.error_reason = (msg_out.error_reason or "") + f" | fallback falhou: {exc2}"
        except Exception as exc:  # noqa: BLE001
            logger.exception("send_unexpected", extra={"error": str(exc)})
            msg_out.status = MessageStatus.FAILED
            msg_out.error_reason = str(exc)
        finally:
            self.session.add(msg_out)
            await self.session.commit()
            await self.session.refresh(msg_out)
            event_name = "wa.audio.sent" if out_type == MessageType.AUDIO else "wa.message.sent"
            await emit_to_conversation(str(conv.id), event_name, _msg_to_dict(msg_out))

        # 11. smart reaction baseado em status
        await self._send_smart_reaction(parsed, self._reaction_for_status(lead.status))

    # ----- helpers -----

    async def _describe_image(self, parsed: ParsedMessage) -> str:
        import base64

        b64 = parsed.media_base64
        mime = parsed.media_mime or "image/jpeg"
        if not b64:
            try:
                media = await self.whatsapp.download_media_base64(
                    {
                        "id": parsed.whatsapp_message_id,
                        "remoteJid": parsed.remote_jid,
                        "fromMe": False,
                    }
                )
            except EvolutionAPIError as exc:
                logger.warning("image_download_failed", extra={"error": str(exc)})
                return ""
            b64 = media.get("base64")
            mime = media.get("mimetype") or mime
        if not b64:
            return ""
        try:
            image_bytes = base64.b64decode(b64)
        except Exception as exc:  # noqa: BLE001
            logger.exception("image_decode_failed", extra={"error": str(exc)})
            return ""
        return await describe_image_async(
            image_bytes=image_bytes,
            mime_type=mime,
            hint=parsed.text or "",
            provider=self.ai,
        )

    async def _send_audio_reply(self, *, parsed: ParsedMessage, reply_text: str) -> dict:
        """Gera TTS e envia como PTT via Evolution. Retorna a resposta crua do Evolution."""
        import base64

        audio_bytes = await self.tts.synthesize(
            text=reply_text,
            instructions=(
                "Tom cordial, profissional, ritmo natural. Voz de assistente comercial brasileiro."
            ),
        )
        audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
        return await self.whatsapp.send_audio(
            number=jid_to_phone(parsed.remote_jid),
            audio_base64=audio_b64,
        )

    async def _transcribe_audio(self, parsed: ParsedMessage) -> str:
        """Baixa o áudio (se ainda não veio em base64) e transcreve via Whisper."""
        import base64

        b64 = parsed.media_base64
        mime = parsed.media_mime
        if not b64:
            try:
                media = await self.whatsapp.download_media_base64(
                    {
                        "id": parsed.whatsapp_message_id,
                        "remoteJid": parsed.remote_jid,
                        "fromMe": False,
                    }
                )
            except EvolutionAPIError as exc:
                logger.warning("audio_download_failed", extra={"error": str(exc)})
                return ""
            b64 = media.get("base64")
            mime = media.get("mimetype") or mime or "audio/ogg"
        if not b64:
            return ""
        try:
            audio_bytes = base64.b64decode(b64)
        except Exception as exc:  # noqa: BLE001
            logger.exception("audio_decode_failed", extra={"error": str(exc)})
            return ""
        try:
            return await self.transcriber.transcribe(audio_bytes=audio_bytes, mime_type=mime)
        except Exception as exc:  # noqa: BLE001
            logger.exception("stt_pipeline_failed", extra={"error": str(exc)})
            return ""

    @staticmethod
    def _reaction_for_status(status: LeadStatus) -> str:
        return {
            LeadStatus.QUALIFIED: "✅",
            LeadStatus.OPT_OUT: "👌",
            LeadStatus.NEEDS_HUMAN: "🤝",
            LeadStatus.NEW: "👍",
        }.get(status, "👍")

    async def _send_smart_reaction(self, parsed: ParsedMessage, emoji: str) -> None:
        try:
            await self.whatsapp.send_reaction(
                remote_jid=parsed.remote_jid,
                message_id=parsed.whatsapp_message_id,
                from_me=False,
                emoji=emoji,
            )
            await emit_global(
                "wa.reaction.sent",
                {"messageId": parsed.whatsapp_message_id, "emoji": emoji},
            )
        except EvolutionAPIError as exc:
            logger.warning("smart_reaction_failed", extra={"error": str(exc), "emoji": emoji})

    @staticmethod
    def _apply_extracted_to_lead(lead: Lead, ai_resp: AIResponse) -> None:
        ext = ai_resp.lead_extracted
        if ext.name and not lead.name:
            lead.name = ext.name
        if ext.company and not lead.company:
            lead.company = ext.company
        if ext.phone and not lead.phone:
            lead.phone = ext.phone
        if ext.service_interest and lead.service_interest in (
            ServiceInterest.UNKNOWN,
            None,
        ):
            lead.service_interest = ext.service_interest
        if ext.lead_goal and not lead.lead_goal:
            lead.lead_goal = ext.lead_goal
        if ext.estimated_volume and not lead.estimated_volume:
            lead.estimated_volume = ext.estimated_volume
