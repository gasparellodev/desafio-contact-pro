# app/services/tts/CLAUDE.md

> TTS (text-to-speech) — síntese de áudio para resposta em PTT.

## Provider atual

OpenAI `gpt-4o-mini-tts` via `client.audio.speech.create`.

- `response_format="opus"` por default — formato nativo do PTT do WhatsApp.
- Instructions parameter (apenas em `gpt-4o-mini-tts`) controla estilo do áudio (cordial, profissional, etc.).
- Voice padrão: `alloy` (neutra, em PT funciona bem).

## Como integra ao orchestrator

Quando o usuário envia áudio: AI gera `reply` em texto → TTS gera bytes opus → `EvolutionClient.send_audio` envia como PTT (Evolution converte se necessário via ffmpeg interno).

## Como adicionar outro provider (ElevenLabs, Azure)

1. Criar `<nome>_tts.py` com método `synthesize(text, instructions?) -> bytes`.
2. Adicionar option em `Settings.tts_provider`.
3. Atualizar este CLAUDE.md.

## Não fazer

- Mandar texto enorme (>1000 chars) — o áudio fica longo e o lead não escuta.
- Gerar TTS em formato mp3 e enviar como PTT — funciona mas Evolution faz reconversão (latência extra).
- Esquecer de capturar exceções da OpenAI (HTTP 429 / quota → fallback para resposta em texto).

## Links

- `openai_tts.py` — TTS
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
