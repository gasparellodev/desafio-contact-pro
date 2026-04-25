# app/services/whatsapp/CLAUDE.md

> Contrato com a Evolution API v2.x. Leia antes de tocar em qualquer call para o WhatsApp.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `evolution_client.py` | Cliente HTTP (httpx + tenacity). **Única fonte** do header `apikey:`. Singleton via `get_evolution_client()`. |
| `payload.py` | Parser do webhook (extrai `key.id`, `remoteJid`, tipo, texto, mídia base64). |
| `handlers.py` (futuro) | Orquestrador de eventos do webhook — quem chama o ConversationOrchestrator. |

## Endpoints da Evolution v2 que cobrimos

| Método | Path | Cliente |
|---|---|---|
| `POST` | `/instance/create` | `create_instance()` |
| `GET`  | `/instance/connect/{instance}` | `connect()` |
| `GET`  | `/instance/connectionState/{instance}` | `connection_state()` |
| `POST` | `/webhook/set/{instance}` | `set_webhook(url, events?, base64=True)` |
| `POST` | `/message/sendText/{instance}` | `send_text(number, text, quoted?, delay_ms?)` |
| `POST` | `/message/sendWhatsAppAudio/{instance}` | `send_audio(number, audio_base64, ...)` |
| `POST` | `/message/sendReaction/{instance}` | `send_reaction(remote_jid, message_id, from_me, emoji)` |
| `POST` | `/chat/sendPresence/{instance}` | `send_presence(number, presence='composing', delay_ms=5000)` |
| `POST` | `/chat/getBase64FromMediaMessage/{instance}` | `download_media_base64(message_key)` |

## Convenções

1. **Auth.** Sempre via header `apikey:` (não `Authorization`). Centralizado no `httpx.AsyncClient` do client; nunca passar à mão.
2. **Retries.** Apenas em `5xx`, `429`, `408` e erros de transporte. `4xx` é definitivo (instância já existe, payload inválido, etc.).
3. **Webhook events em UPPERCASE** (`MESSAGES_UPSERT`, etc.) — `payload.py:normalize_event` converte para forma canônica `messages.upsert`.
4. **Idempotência.** Toda mensagem persiste com `whatsapp_message_id` UNIQUE. Webhooks repetidos pela Evolution são ignorados pelo orchestrator.
5. **Media base64.** Quando `webhook.base64=true`, áudio/imagem chegam em `data.message.base64`. Caso contrário, baixar via `download_media_base64`.
6. **Áudio PTT.** TTS gera `opus`; a Evolution converte qualquer formato via ffmpeg interno. `send_audio` aceita base64 puro (sem prefixo `data:image/...`) ou URL.
7. **Reaction.** `key.fromMe` precisa ser **igual** ao da mensagem original que está sendo reagida (Evolution rejeita silenciosamente se errado).

## Webhook payload — estrutura mínima esperada

```json
{
  "event": "messages.upsert",
  "instance": "contactpro",
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net", "fromMe": false, "id": "3EB0..." },
    "pushName": "Vinicius",
    "messageType": "conversation",
    "message": { "conversation": "Olá!" },
    "messageTimestamp": 1714000000
  }
}
```

Quando é áudio:

```json
{
  "data": {
    "messageType": "audioMessage",
    "message": {
      "audioMessage": { "ptt": true, "mimetype": "audio/ogg; codecs=opus", "seconds": 5 },
      "base64": "<binário-em-base64>"
    }
  }
}
```

## Como adicionar uma nova chamada à Evolution

1. Olhar a doc oficial em https://doc.evolution-api.com (ou os routers em `EvolutionAPI/evolution-api`).
2. Adicionar método no `EvolutionClient` reutilizando `_request` (que já faz retries e header correto).
3. Tipar o body com TypedDict ou dict[str, Any] se for trivial.
4. Documentar aqui.

## Não fazer

- Chamar a Evolution direto via `httpx.AsyncClient()` espalhado pelo código — sempre via `get_evolution_client()`.
- Logar `apikey` ou body completo de webhook em produção (PII no remote_jid e conteúdo).
- Confiar no `pushName` para qualificação (lead pode trocar a qualquer hora).
- Enviar texto + áudio na mesma mensagem (Evolution não suporta).
- Configurar `webhook.byEvents=true` (cria N webhooks por path; o pattern adotado é um único endpoint que faz dispatch interno).

## Links

- `evolution_client.py` — cliente
- `payload.py` — parser
- `app/api/routes/webhooks.py` — handler do webhook
- `app/api/routes/whatsapp.py` — proxy para QR/status
- Plan: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
