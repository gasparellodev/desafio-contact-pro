# app/services/CLAUDE.md

> Pipeline canônica e invariantes do orchestrator. Leia antes de tocar em qualquer service.

## ConversationOrchestrator

Cérebro do sistema. Recebe `ParsedMessage` do webhook Evolution e administra todo o ciclo até a resposta no WhatsApp + UI.

### Invariantes (NÃO QUEBRAR)

1. **Persiste antes de emitir.** Cada `Message` é gravado e `commit`-ado **antes** de qualquer `emit_to_conversation` ou `emit_global`.
2. **Idempotência.** `whatsapp_message_id` UNIQUE — duplicatas (Evolution faz redelivery em até 3×) são detectadas em `_exists_message` e ignoradas.
3. **Nunca envia ao WhatsApp sem persistir OUT.** O `Message OUT` em `PENDING` é salvo antes do `send_text`. Após sucesso → `SENT`. Após falha → `FAILED + error_reason`.
4. **`from_me` é descartado.** Mensagens enviadas pelo bot voltam pelo webhook; ignoramos para evitar loop.
5. **Reaction 👍 é fire-and-forget.** Falha não interrompe o pipeline (apenas loga warning).
6. **Smart reaction final** depende do `status` do lead pós-AI: ✅ qualified, 👌 opt_out, 🤝 needs_human, 👍 new.
7. **Histórico tem cap de 12 mensagens** (`HISTORY_LIMIT`) para controlar custo de prompt e latência.

### Pipeline (texto)

```
parse → upsert lead → upsert conversation → idempotency check
  → persist Message IN (status=RECEIVED) + emit wa.message.received
  → send 👍 + emit wa.reaction.sent
  → emit ai.thinking{start}
  → AI provider (system_prompt + history + user_message) → AIResponse
  → apply extracted to lead + status_suggestion + last_intent
  → emit lead.updated + conversation.status_changed
  → persist Message OUT (status=PENDING)
  → emit ai.response.generated
  → send_text via Evolution (com quoted)
  → status SENT/FAILED + emit wa.message.sent
  → emit ai.thinking{end}
  → smart reaction (✅/👌/🤝/👍)
```

### Como adicionar áudio (PR #11)

Inserir entre `idempotency check` e `send 👍`:
1. Se `parsed.message_type == AUDIO`: descobrir base64 (de `parsed.media_base64` ou `getBase64FromMediaMessage`), passar para STT (`OpenAIWhisperTranscriber`), gravar `transcription` em `msg_in`, emit `audio.transcribed`.
2. Trocar `ai_input_text = parsed.text or ...` por `ai_input_text = msg_in.transcription`.
3. Após `send_text`, se input foi áudio, ALTERNATIVA: chamar TTS e `send_audio` em vez de `send_text`.

### Como adicionar imagem (PR #14)

1. Se `parsed.message_type == IMAGE`: chamar `ai.describe_image(image_base64, mime_type, hint=parsed.text)`.
2. `ai_input_text = f"[O usuário enviou uma imagem. Descrição: {description}]\nLegenda: {parsed.text}"`.

## Não fazer

- Importar concrete provider (`OpenAIProvider`/`AnthropicProvider`) — sempre `get_ai_provider()`.
- Emitir Socket.IO sem `await` (eventos perdidos).
- Fazer `commit` no meio de uma operação que pode falhar — agrupe por unidade de trabalho.
- Adicionar lógica de UI ao orchestrator. Frontend recebe events e decide visualização.

## Links

- `conversation_orchestrator.py` — pipeline
- `whatsapp/evolution_client.py` — I/O com Evolution
- `ai/factory.py` — provider switch
- `ai/prompts.py` — system prompt
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
