# Backend — Contact Pro API

API FastAPI + Socket.IO que recebe webhooks da Evolution API, orquestra IA/STT/TTS, persiste no Postgres e emite eventos em tempo real para o frontend.

> Para visão geral do projeto, comandos Docker e setup completo, leia o [`README.md` da raiz](../README.md).
> Para convenções (rotas, services, models, schemas), leia [`CLAUDE.md`](./CLAUDE.md), [`app/api/CLAUDE.md`](./app/api/CLAUDE.md), [`app/schemas/CLAUDE.md`](./app/schemas/CLAUDE.md), [`app/services/CLAUDE.md`](./app/services/CLAUDE.md), [`app/models/CLAUDE.md`](./app/models/CLAUDE.md).

## Stack

- **Python 3.12** + **FastAPI ≥0.115** + **uvicorn[standard] ≥0.32**.
- **python-socketio 5.16** (ASGI root: `socketio.ASGIApp(sio, fastapi_app)`).
- **SQLModel** + **SQLAlchemy[asyncio]** + **asyncpg** + **Alembic** (compare_type=True).
- **OpenAI ≥1.50** (Whisper, gpt-4o-mini-tts, vision) + **Anthropic ≥0.40** (Claude com prompt cache).
- **httpx ≥0.27** + **tenacity ≥9** para Evolution client.
- **uv** como gerenciador de pacotes/lock (`uv sync`).
- **pytest 8** + **pytest-asyncio** + **testcontainers Postgres 16** + **httpx ASGITransport** para testes.

## Como rodar localmente (sem Docker)

Útil para iterar rápido em endpoints/services. Precisa de Postgres + Redis acessíveis.

```bash
# Subir só infra:
docker compose up -d db redis

# Em outro terminal:
cd backend
uv sync
cp ../.env.example .env   # ajuste DATABASE_URL para localhost:<porta-mapeada>

uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Swagger: http://localhost:8000/docs
# Health:  http://localhost:8000/health
```

## Como rodar testes

```bash
cd backend
uv sync                            # 1ª vez instala testcontainers, pytest, etc.
uv run pytest tests/ -v            # 23 testes, ~5s
uv run pytest --cov=app/schemas --cov-report=term-missing
```

> **Requisito:** Docker rodando (testcontainers sobe um Postgres 16-alpine isolado por sessão pytest). NullPool + engine função-scoped — sem cross-loop pain do pytest-asyncio.

## Estrutura

```
app/
  main.py                  # FastAPI + Socket.IO ASGIApp como root
  core/
    config.py              # pydantic-settings; get_settings() é fonte única
    socketio.py            # AsyncServer + emit_global / emit_to_conversation
  db/
    session.py             # async engine + SessionLocal + get_session dep
    base.py                # importa todos os models para SQLModel.metadata
  models/                  # SQLModel tables (Lead, Conversation, Message + enums)
  schemas/                 # Pydantic I/O da API (Read/Summary/ListItem/List/Page)
  api/
    routes/                # health, webhooks, whatsapp, conversations, leads
    security.py            # require_admin_token (HMAC compare_digest)
  services/
    whatsapp/              # Evolution client + handlers + media
    ai/                    # provider abstraction (OpenAI/Anthropic via factory)
    transcription/, tts/, vision/
    intent_classifier.py
    lead_qualification.py
    conversation_orchestrator.py
  knowledge_base/          # KB Contact Pro
alembic/                   # migrations (1 inicial: 0001_init_lead_conversation_message)
tests/                     # pytest async + testcontainers (23 testes hoje)
```

## Como adicionar...

| O que | Onde | Convenção em |
|---|---|---|
| Endpoint REST | `app/api/routes/<nome>.py` + registrar em `app/main.py` | [`app/api/CLAUDE.md`](./app/api/CLAUDE.md) |

## Endpoints atuais

- `GET /health` — liveness + dependencies (DB/Redis/Evolution).
- `POST /api/webhooks/evolution` — webhook Evolution (apikey-protected).
- `/api/whatsapp/*` (admin) — instance/qrcode/connection/webhook setup.
- `GET /api/conversations[, /{id}, /{id}/messages]` (admin) — listar conversas + mensagens cursor.
- `POST /api/conversations/{id}/messages` (admin) — **humano envia mensagem manual** (handoff).
- `GET /api/leads/{id}` (admin) — detalhe completo do lead.
- `POST /api/leads/{id}/resume-bot` (admin) — **libera bot quando estiver pausado por handoff**.
| Pydantic schema | `app/schemas/<nome>.py` (`<X>Read`/`<X>Summary`/`<X>ListItem`/`<X>List`/`<X>Page`) | [`app/schemas/CLAUDE.md`](./app/schemas/CLAUDE.md) |
| Service | `app/services/<nome>/` | [`app/services/CLAUDE.md`](./app/services/CLAUDE.md) |
| Model + migration | `app/models/<nome>.py` + `uv run alembic revision --autogenerate -m "..."` | [`app/models/CLAUDE.md`](./app/models/CLAUDE.md) |
| Teste | `backend/tests/api/test_<nome>.py` (httpx AsyncClient + ASGITransport + testcontainers) | [`CLAUDE.md`](./CLAUDE.md) |

Mais detalhes em [`CLAUDE.md`](./CLAUDE.md).
