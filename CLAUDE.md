# CLAUDE.md — Desafio Contact Pro

> Ponto de entrada para qualquer agente (Claude Code, Codex, Cursor) trabalhando neste repositório. Leia este arquivo antes de qualquer alteração.

## O que é o produto

Chatbot de WhatsApp com IA para atendimento inicial de leads da Contact Pro. Recebe texto, áudio e imagem, qualifica o lead, classifica intenção, gera resposta via OpenAI ou Anthropic, e atualiza um frontend web em tempo real via Socket.IO.

Spec completo em `desafio-tecnico.md`. Plano de execução em `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`.

## Stack (versões pinadas — abr/2026)

| Camada | Tech |
|---|---|
| Backend | Python 3.12 + FastAPI ≥0.115 + uvicorn[standard] ≥0.32 |
| WhatsApp | Evolution API v2.3.7 (`evoapicloud/evolution-api`) — empacota Baileys 7.x |
| AI | OpenAI ≥1.50 + Anthropic ≥0.40 (switch via `AI_PROVIDER`) |
| STT / TTS | OpenAI `whisper-1` + `gpt-4o-mini-tts` (`response_format=opus`) |
| Banco | PostgreSQL 16 + SQLModel + SQLAlchemy[asyncio] + asyncpg + Alembic |
| Cache | Redis 7 (exigido pelo Evolution v2) |
| Real-time | python-socketio 5.16.x + socket.io-client 4.8.x (Socket.IO v5) |
| Frontend | Vite 6 + React 19 + Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui |
| HTTP | httpx ≥0.27 + tenacity ≥9 |

## Comandos essenciais

```bash
# Subir tudo
cp .env.example .env   # depois preencha as chaves
docker compose up --build

# Backend isolado (dev)
cd backend && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend isolado (dev)
cd frontend && npm run dev

# Migrations
cd backend && uv run alembic upgrade head
cd backend && uv run alembic revision --autogenerate -m "descr"

# Reset da sessão WhatsApp
docker compose down
docker volume rm desafio-contact-pro_evolution_instances
docker compose up
```

## Estrutura do repo

```
backend/   # FastAPI + Socket.IO + AI + STT/TTS + Evolution client
frontend/  # Vite + React + Tailwind + shadcn (chat UI)
docs/      # Decisões, arquitetura, API
.github/   # Templates de issue e PR
desafio-tecnico.md     # Spec original do desafio
DEVELOPMENT_LOG.md     # Diário cronológico de decisões/dificuldades
```

Cada módulo significativo tem seu próprio `CLAUDE.md`:
- `backend/CLAUDE.md` — regras Python, async, SQLModel, Alembic
- `backend/app/services/whatsapp/CLAUDE.md` — contrato Evolution
- `backend/app/services/ai/CLAUDE.md` — Provider abstraction, prompts
- `backend/app/services/CLAUDE.md` — pipeline ConversationOrchestrator
- `backend/app/models/CLAUDE.md` — esquema do banco
- `backend/app/api/CLAUDE.md` — convenção REST
- `frontend/CLAUDE.md` — shadcn-only, hooks, Socket.IO singleton
- `frontend/src/components/CLAUDE.md` — convenção de componentes
- `frontend/src/hooks/CLAUDE.md` — convenção de hooks

## Política de commits e PRs

**Conventional Commits obrigatório**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. Escopo opcional entre parênteses (`feat(whatsapp): ...`).

**Toda mudança via PR**, com:
1. Branch `feat/...` ou `chore/...`
2. Atualização do(s) `CLAUDE.md` do(s) módulo(s) afetado(s)
3. Entrada em `DEVELOPMENT_LOG.md`
4. `/code-review` (subagent `sentry-skills:code-review`)
5. `/security-review` (skill `sentry-skills:security-review`) quando há entrada externa, auth ou secrets
6. Smoke test manual antes do merge
7. Squash merge para main

**Nunca commitar:** `.env`, sessões do WhatsApp, chaves de API, `node_modules`, `__pycache__`, dumps de DB, credenciais. O `.gitignore` deve cobrir tudo isso.

## Provider switch (OpenAI ↔ Anthropic)

```env
AI_PROVIDER=openai            # ou anthropic
AI_MODEL=gpt-4o-mini          # ou claude-sonnet-4-6
AI_API_KEY=...
```

Trocar provider exige apenas `docker compose restart backend`. Ambos retornam `AIResponse{ reply, intent, lead_extracted, status_suggestion }` (contrato em `backend/app/services/ai/base.py`).

## Princípios de design

- **Async end-to-end**: nada de chamadas síncronas em request handlers
- **Idempotência**: webhooks do Evolution podem chegar duas vezes — `whatsapp_message_id` é UNIQUE, ignorar duplicatas
- **Persistir antes de emitir**: nunca emite Socket.IO antes de salvar no DB; nunca envia mensagem ao WhatsApp sem persistir OUT primeiro
- **shadcn-only para UI primitives**: nunca criar `<button>` cru, sempre via componente shadcn
- **Strict TypeScript**: `strict: true`, sem `any`
- **Sem RAG**: KB Contact Pro embedada no system prompt, com Anthropic prompt cache para custo

## Limitações conhecidas (intencionais para o prazo de 6h)

- Sem autenticação na UI
- Apenas uma instância WhatsApp por vez
- Orchestrator inline (sem Celery/RQ)
- Knowledge base estática (sem embeddings)
- Testes apenas smoke

Documentadas em detalhe no `README.md` seção "Limitações".

## Onde olhar primeiro

- Bug em recebimento: `backend/app/api/routes/webhooks.py` + `backend/app/services/conversation_orchestrator.py`
- Bug de envio: `backend/app/services/whatsapp/evolution_client.py`
- Bug de IA: `backend/app/services/ai/{base,openai_provider,anthropic_provider}.py`
- Bug de tempo real: `backend/app/core/socketio.py` + `frontend/src/lib/socket.ts`
- Bug de UI: `frontend/src/components/chat/*`
