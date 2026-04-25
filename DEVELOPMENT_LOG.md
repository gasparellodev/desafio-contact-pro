# Development Log — Desafio Contact Pro

Diário cronológico do desenvolvimento. Cada PR significativo deve adicionar uma entrada com decisões, dificuldades, trade-offs e sugestões da IA que foram rejeitadas ou alteradas. Este arquivo alimenta a seção `AI Usage Report` do `README.md` na entrega.

Formato:

```markdown
## YYYY-MM-DD HH:MM — PR #N: <título>
**Decisões:**
- ...
**Dificuldades:**
- ...
**Trade-offs:**
- ...
**Sugestões da IA rejeitadas/alteradas:**
- ...
**Tempo gasto:** ~Xmin
```

---

## 2026-04-25 10:11 — Planejamento inicial

**Decisões:**
- Stack escolhida: Python 3.12 + FastAPI no backend, React 19 + Tailwind v4 + shadcn no frontend, Evolution API v2.3.7 para WhatsApp, PostgreSQL + Redis (exigência do Evolution v2), provider switch OpenAI/Anthropic via env, OpenAI Whisper + gpt-4o-mini-tts (response_format=opus), Socket.IO via python-socketio ASGI root.
- Sistema de `CLAUDE.md` por módulo + `DEVELOPMENT_LOG.md` na raiz como contrato vivo de regras.
- Workflow: PRs por feature, conventional commits, `/code-review` e `/security-review` antes do merge.

**Dificuldades:**
- Inicialmente considerado SQLite + Prisma — descartado: Prisma Python (`prisma-client-py`) é community-maintained e Evolution v2 não suporta sqlite-internal. Migrado para PostgreSQL + SQLModel + Alembic.
- Evolution API é serviço gerenciado (não biblioteca direta). Trade-off documentado: empacota Baileys 7.0.0-rc.9 internamente, cumpre o requisito "Baileys ou whatsmeow" do desafio.

**Trade-offs:**
- Postgres compartilhado entre Evolution (`schema=evolution_api`) e backend (`schema=contactpro`) para reduzir containers e simplicar setup.
- KB Contact Pro embedada no system prompt (sem RAG real) — Anthropic prompt cache reduz custo.
- Orquestrador inline (sem fila assíncrona) — simplificação consciente para 6h.

**Sugestões da IA rejeitadas/alteradas:**
- IA sugeriu inicialmente NestJS para backend; alterado para Python+FastAPI por preferência do usuário.
- IA sugeriu WebSocket nativo do FastAPI; alterado para Socket.IO por reconexão automática e rooms.

**Tempo gasto:** ~30 min de brainstorm + validação técnica via web research.

---

## 2026-04-25 10:30 — PR #1: Bootstrap repo + CLAUDE.md + DEVELOPMENT_LOG.md

**Decisões:**
- Monorepo simples (`backend/` + `frontend/` no root), não workspaces.
- `.gitignore` agressivo cobrindo Python, Node, secrets, sessões WhatsApp e dumps.
- README skeleton com seções obrigatórias do desafio (visão, stack, setup, AI Usage Report).
- `.github/` com PR template + issue templates + labels semânticos.

**Dificuldades:**
- Sistema de permissões bloqueou `gh repo create --public` (ação irreversível). Aguardando confirmação do usuário ou execução manual com prefixo `!` no chat.

**Trade-offs:**
- Trabalho local segue em paralelo enquanto remote não está criado; commits ficam locais até o push.

**Tempo gasto:** ~15 min

---

## 2026-04-25 10:45 — PR #2: Backend scaffold

**Decisões:**
- `uv` como gerenciador de pacotes (rápido, lockfile estável). Python 3.12.
- FastAPI 0.115+ + Socket.IO 5.16+ via `socketio.ASGIApp(sio, fastapi_app, socketio_path="socket.io")` como ASGI root — padrão validado nas docs do `python-socketio` para evitar bug de `app.mount()`.
- SQLModel + SQLAlchemy[asyncio] + asyncpg (mais rápido que psycopg3 em 2026).
- Alembic com template `async`. Editado `script.py.mako` para incluir `import sqlmodel` (`AutoString` em models). `compare_type=True` ativado.
- `app/core/config.py` com `pydantic-settings` é fonte única de configuração; demais módulos chamam `get_settings()`.
- Logging em JSON via `python-json-logger` (estruturado, fácil de tailar).
- Endpoint `/health` checa DB, Redis e Evolution em paralelo, retornando degradação granular.
- Dockerfile `python:3.12-slim` + uv binário copiado de `ghcr.io/astral-sh/uv:0.11`. `entrypoint.sh` espera Postgres via `app/scripts/wait_for_db.py` e roda `alembic upgrade head` antes de uvicorn.

**Dificuldades:**
- Primeiro draft do `entrypoint.sh` tinha um one-liner Python misturando syntax JS (`.then()`). Substituído por módulo `app/scripts/wait_for_db.py` async/idiomático com retry de 60s.

**Trade-offs:**
- `uv.lock` não está no Dockerfile inicialmente (`uv sync --frozen || uv sync`); aceita rebuild se lock dessincronizar — mais rápido para iterar em 6h.
- Logger silencia `uvicorn.access` (warning+) para não poluir; pode reativar em debug.

**Sugestões da IA rejeitadas/alteradas:**
- Sugestão inicial era `psycopg[binary,pool] 3.x` como driver. Trocado para `asyncpg` por performance (validado em pesquisa).
- Sugestão de montar Socket.IO via `app.mount('/sio', ...)` foi rejeitada — `python-socketio` docs mostram explicitamente que o padrão é envelopar o FastAPI no ASGIApp.

**Tempo gasto:** ~25 min

**Smoke test:** `uv run python -c "from app.main import app, fastapi_app"` → OK. Rotas `/health`, `/docs`, `/redoc`, `/openapi.json` registradas.
