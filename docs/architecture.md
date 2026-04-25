# Arquitetura

> Detalhes do desenho técnico. Visão de alto nível está no [`README.md`](../README.md).

## Diagrama de alto nível

```
[WhatsApp Cliente]
   │  (mensagens — texto / áudio PTT / imagem)
   ▼
[Evolution API v2.3.7]  ──► [PostgreSQL schema "evolution_api"]
  porta 8080              ──► [Redis db 6]
  volume: evolution_instances:/evolution/instances  (chaves Baileys)
   │
   │  REST (header `apikey:`) — outbound (sendText, sendAudio, sendReaction, getMedia)
   │  Webhook POST       — inbound (MESSAGES_UPSERT, CONNECTION_UPDATE, QRCODE_UPDATED)
   ▼
[Backend FastAPI + python-socketio (ASGIApp ROOT)]
   │
   ├─► api/routes/webhooks.py
   │     └─ ConversationOrchestrator (services/conversation_orchestrator.py)
   │           ├─ services/whatsapp/evolution_client.py (httpx + tenacity)
   │           ├─ services/ai/factory.py → OpenAIProvider | AnthropicProvider
   │           ├─ services/transcription/openai_stt.py (Whisper)
   │           ├─ services/tts/openai_tts.py (gpt-4o-mini-tts opus)
   │           ├─ services/vision/multimodal.py
   │           └─ models/{lead,conversation,message}.py (SQLModel async)
   │
   ├─► api/routes/whatsapp.py
   │     └─ proxy REST: POST /instance, GET /qrcode, GET /connection, POST /webhook (setup)
   │
   ├─► api/routes/health.py
   │     └─ GET /health → checa db + redis + evolution
   │
   └─► core/socketio.py
         └─ AsyncServer + emit_global / emit_to_conversation (rooms por conversa)
   │
   ├──► [PostgreSQL schema "public"]   SQLModel async + Alembic (0001_init)
   │
   └──► [Socket.IO v5 protocol]   socket.io-client 4.8.x
            │
            ▼
        [Frontend Vite + React 19 + Tailwind v4 + shadcn]
            ├─ lib/socket.ts        (singleton Socket.IO, autoConnect=false)
            ├─ lib/api.ts           (REST wrapper)
            ├─ hooks/useSocket      (connect/disconnect StrictMode-safe)
            ├─ hooks/useConnectionStatus  (wa.connection.update + wa.qrcode.updated)
            ├─ hooks/useConversations     (useReducer com 9 events)
            └─ components/{chat,lead,connection}
```

## Pipeline canônica do `ConversationOrchestrator`

Ver invariantes em [`backend/app/services/CLAUDE.md`](../backend/app/services/CLAUDE.md).

```
1.  webhook recebido → parse_messages_upsert
2.  if from_me → ignora (anti-loop)
3.  idempotency check via whatsapp_message_id UNIQUE
4.  upsert Lead (por whatsapp_jid) → upsert Conversation
5.  persist Message IN (status=RECEIVED) → emit wa.message.received
6.  send 👍 reaction → emit wa.reaction.sent
7.  if AUDIO: download base64 → Whisper STT → save transcription → emit audio.transcribed
    if IMAGE: download base64 → vision describe → save as transcription → emit audio.transcribed
8.  emit ai.thinking{start} → AI provider (system_prompt + history[12] + user_message)
    OpenAI: chat.completions.parse(response_format=AIResponse)
    Anthropic: tool_choice forced (emit_response) + cache_control: ephemeral
9.  AIResponse{reply, intent, lead_extracted, status_suggestion} → apply to Lead/Conversation
10. emit lead.updated + conversation.status_changed + ai.response.generated
11. persist Message OUT (status=PENDING)
12. send via Evolution:
    - if input AUDIO: TTS opus → sendWhatsAppAudio
    - else:           sendText com `quoted` da mensagem original
13. update status SENT/FAILED + error_reason
14. emit wa.message.sent OR wa.audio.sent
15. emit ai.thinking{end}
16. smart reaction final por status (✅ qualified / 👌 opt_out / 🤝 needs_human / 👍 new)
```

## Eventos Socket.IO

| Evento | Direção | Payload |
|---|---|---|
| `wa.connection.update` | server→client | `{state: 'open'\|'connecting'\|'close', statusReason?}` |
| `wa.qrcode.updated` | server→client | `{qrcode: string\|null}` |
| `wa.message.received` | server→client | Message |
| `wa.audio.received` | server→client | Message |
| `audio.transcribed` | server→client | `{messageId, transcription}` |
| `ai.thinking` | server→client | `{conversationId, status: 'start'\|'end'}` |
| `ai.response.generated` | server→client | Message |
| `wa.message.sent` | server→client | Message |
| `wa.audio.sent` | server→client | Message |
| `wa.reaction.sent` | server→client | `{messageId, emoji}` |
| `lead.updated` | server→client | Lead |
| `conversation.status_changed` | server→client | `Partial<Conversation> & {id}` |
| `error` | server→client | `{code?, message, conversation_id?}` |
| `join_conversation` | client→server | `{conversation_id}` |
| `leave_conversation` | client→server | `{conversation_id}` |

## Modelo de dados

Ver [`backend/app/models/CLAUDE.md`](../backend/app/models/CLAUDE.md).

- **leads**: `id` UUID PK, `whatsapp_jid` UNIQUE, name/company/phone, `service_interest`, `lead_goal`, `estimated_volume`, `status` (`new|qualified|needs_human|opt_out`), `created_at`, `updated_at`.
- **conversations**: FK `lead_id` (CASCADE), `last_intent`, `last_message_at`.
- **messages**: FK `conversation_id` (CASCADE), `whatsapp_message_id` UNIQUE (idempotência), `direction`, `type`, `content`, `transcription`, `media_url`, `media_mime`, `intent`, `status`, `quoted_message_id`, `error_reason`, `created_at`.

## Provider switch

```env
AI_PROVIDER=openai            # ou anthropic
AI_MODEL=gpt-4o-mini          # ou claude-sonnet-4-6
AI_API_KEY=                   # fallback
OPENAI_API_KEY=...            # explícito (também usado por STT/TTS/vision)
ANTHROPIC_API_KEY=...
```

`Settings.active_ai_api_key` resolve a chave certa: prefere a explícita do provider, cai para `AI_API_KEY` como fallback.

`get_ai_provider()` (lru_cache) lê `settings.ai_provider` e devolve `AIProvider` adequado. Outros módulos NUNCA importam concrete providers.
