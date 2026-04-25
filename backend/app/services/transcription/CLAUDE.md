# app/services/transcription/CLAUDE.md

> STT (speech-to-text) — transcrição de áudio recebido.

## Provider atual

OpenAI Whisper (`whisper-1`) via `client.audio.transcriptions.create`.

- Aceita: ogg, opus, m4a, mp3, mp4, mpga, mpeg, wav, webm.
- Limite: **25 MB**.
- WhatsApp PTT chega como `audio/ogg; codecs=opus` — Whisper aceita direto.
- Default `language="pt"` para reduzir alucinação.

## Como adicionar outro provider (Groq Whisper, Deepgram, Google)

1. Criar `app/services/transcription/<nome>_stt.py` com método `transcribe(audio_bytes, mime_type, filename_hint, language)` retornando `str`.
2. Adicionar option em `Settings.stt_provider`.
3. Atualizar este CLAUDE.md.

## Não fazer

- Logar `audio_bytes` (binário grande).
- Passar mime sem extensão correta no filename — Whisper rejeita.
- Esquecer de validar tamanho (>25 MB → erro 413 da OpenAI).

## Links

- `openai_stt.py` — transcriber
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
