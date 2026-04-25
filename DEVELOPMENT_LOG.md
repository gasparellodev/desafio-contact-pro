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

---

## 2026-04-25 11:05 — PR #3: Frontend scaffold

**Decisões:**
- Vite 8 + React 19.2 + TypeScript 6 (strict) + Tailwind v4 via plugin oficial `@tailwindcss/vite` (sem `postcss.config.js`).
- shadcn/ui no estilo `new-york`, base color `neutral`, tokens em **OKLCH** (defaults v4) — escritos diretamente em `src/index.css` via `@theme inline`.
- 6 primitives copiados manualmente (button, card, badge, scroll-area, separator, avatar) ao invés de rodar `npx shadcn@latest init` interativo — mais rápido e determinístico para 6h.
- Path alias `@/*` configurado em `vite.config.ts` (resolve.alias) **e** em `tsconfig.app.json` (sem `baseUrl` — deprecated em TS 6, usar só `paths` com `moduleResolution: "bundler"`).
- `vite.config.ts` com `server.host: true`, `server.port: 5173`, `server.watch.usePolling: true` (necessário para HMR via bind-mount em macOS).
- `App.tsx` placeholder com layout split (3 cards: Conversas | Mensagens | Lead) usando shadcn `Card` + `Badge`.
- Dockerfile multi-stage (deps → builder → runner com `vite preview`).

**Dificuldades:**
- TypeScript 6 falhou no primeiro build com `TS5101: 'baseUrl' is deprecated`. Solução: remover `baseUrl`, manter só `paths` (resolução em modo bundler funciona).
- shadcn CLI é interativo e exigiria responder prompts; optei por copiar componentes manualmente (decisão consciente para preservar tempo).

**Trade-offs:**
- Sem react-query / zustand neste momento — estado vai ficar em hooks customizados com `useReducer` quando o PR #10 chegar (escopo enxuto).
- `npm run build` valida tudo (tsc strict + Vite); como teste é simples, não vale Vitest neste PR.

**Sugestões da IA rejeitadas/alteradas:**
- IA sugeriu manter `baseUrl: "."` com `ignoreDeprecations: "6.0"` para silenciar; alterado para remover `baseUrl` por completo (mais limpo, sem flag de desuso).

**Tempo gasto:** ~25 min

**Smoke test:** `npm run build` → tsc strict OK, Vite build OK (22 KB CSS, 223 KB JS gzip 70 KB).

---

## 2026-04-25 11:15 — PR #4: docker-compose 5 services + .env.example

**Decisões:**
- 5 serviços: `db` (postgres:16-alpine), `redis` (redis:7-alpine, AOF on), `evolution` (evoapicloud/evolution-api:v2.3.7), `backend`, `frontend`.
- Postgres compartilhado: schema `evolution_api` para Evolution + `public` para o backend (init SQL em `docker/postgres-init/00-create-schemas.sql`).
- `depends_on` com `condition: service_healthy` (db, redis) — backend só sobe depois que infra está pronta.
- Healthchecks reais em todos os serviços críticos (`pg_isready`, `redis-cli ping`, `wget` na Evolution, `curl` no backend).
- `EVOLUTION_WEBHOOK_URL` aponta para `http://backend:8000/...` (rede interna do compose, não `localhost`).
- Variáveis sensíveis sem default no compose (`AI_API_KEY`, `EVOLUTION_API_KEY`, etc.) — vêm do `.env`.

**Dificuldades:**
- Evolution v2 exige Postgres + Redis (validado na pesquisa); montar tudo em um único compose simplifica setup mas aumenta tempo de cold start (~30s).

**Trade-offs:**
- Volume `evolution_instances:/evolution/instances` persiste sessão Baileys. Documentar reset (`docker volume rm`) no README final.
- Sem Nginx / TLS / proxy reverso — fora de escopo (challenge não exige).

**Sugestões da IA rejeitadas/alteradas:**
- IA inicial sugeriu `evoapicloud/evolution-api:latest`; ajustei para tag fixa `v2.3.7` (reprodutibilidade).

**Tempo gasto:** ~15 min

**Smoke test:** `docker compose config --quiet` → válido (warnings esperados sobre vars sem `.env`).

---

## 2026-04-25 11:25 — PR #5: DB models (Lead/Conversation/Message) + initial migration

**Decisões:**
- 3 tabelas: `leads`, `conversations`, `messages`. Todas as enums (LeadStatus, ServiceInterest, Intent, Direction, MessageType, MessageStatus) armazenadas como `VARCHAR` para evitar bug do Alembic com pg.ENUM.
- PK UUID em todas (Postgres native via `PG_UUID(as_uuid=True)`).
- `whatsapp_jid` UNIQUE em leads, `whatsapp_message_id` UNIQUE em messages → idempotência de webhooks.
- FKs com `ondelete="CASCADE"` (Conversation→Lead, Message→Conversation).
- Migration `0001_init` escrita à mão (sem rodar autogenerate) por dois motivos: (1) Postgres não está rodando localmente; (2) o autogenerate gera lixo com Enums e índices, sempre exige edição manual depois.
- `app/db/base.py` importa todos os models para SQLModel.metadata enxergar.

**Dificuldades:**
- Alembic autogenerate exige Postgres rodando — preferi escrever a migration manual e validar via inspeção dos objetos `__table__` em Python (`SQLModel.metadata.tables`). Confirma colunas e índices.

**Trade-offs:**
- Sem ENUM nativo no Postgres = sem validação na borda do banco. Mitigação: validação Pydantic em todo I/O da camada de aplicação.
- Sem `relationship()` declarativo (Lead.conversations, etc.) por enquanto — se for necessário no orchestrator (PR #9), adiciono lá.

**Sugestões da IA rejeitadas/alteradas:**
- IA sugeriu inicialmente `Field(default=LeadStatus.NEW)` direto. Substituído por `sa_column=Column(String(32), ..., default=LeadStatus.NEW.value)` para garantir que o tipo SQL seja `VARCHAR` mesmo se SQLModel tentar inferir Enum nativo.

**Tempo gasto:** ~15 min

**Smoke test:** `from app.db.base import *` — 3 tabelas, todas as colunas e enums batem com a spec do desafio.

---

## 2026-04-25 11:45 — PR #6: Evolution API client + webhook receiver

**Decisões:**
- `EvolutionClient` com `httpx.AsyncClient` (header `apikey:` no construtor — única fonte) + `tenacity` para retries em 5xx/429/transport errors. 4xx é definitivo (sem retry).
- 8 métodos cobrindo: instance create/connect/state/logout, webhook set, sendText (com `quoted` para reply), sendWhatsAppAudio (Evolution converte via ffmpeg interno), sendReaction, downloadMediaBase64.
- `payload.py` com `parse_messages_upsert(payload)` extraindo `key.id`, `remoteJid`, `messageType`, texto/mídia base64 — neutraliza variações de nome de evento (`messages.upsert` vs `MESSAGES_UPSERT`) via `normalize_event`.
- `app/api/routes/webhooks.py` POST `/api/webhooks/evolution` é o único endpoint de entrada do WhatsApp; valida `apikey` opcionalmente, despacha para handlers e emite `wa.message.received.raw` / `wa.connection.update` / `wa.qrcode.updated` no Socket.IO.
- `app/api/routes/whatsapp.py` proxy REST para frontend pegar QR/status e disparar setup do webhook.

**Dificuldades:**
- Tipo do evento da Evolution v2 varia: alguns deploys mandam `messages.upsert`, outros `MESSAGES_UPSERT`. Resolvi via `normalize_event` que tolera ambos.
- Sem Postgres rodando local, não dá para testar fluxo end-to-end agora — smoke test só valida que rotas estão registradas. Validação real virá no compose-up.

**Trade-offs:**
- O webhook deste PR ainda não chama o orchestrator (chega no PR #9). Por ora ele só emite snapshot raw para o Socket.IO — útil para debug do frontend antes do orchestrator estar pronto.
- Singleton do `EvolutionClient` é instanciado on-demand (`get_evolution_client()`); não está no lifespan ainda. Em produção, mover para lifespan + fechar no shutdown — TODO documentado.

**Sugestões da IA rejeitadas/alteradas:**
- IA inicial sugeriu validação de assinatura HMAC do webhook. Evolution v2 não envia assinatura no header — a única defesa é a `apikey` (opcional) e a topologia de rede interna do Docker. Documentado.

**Tempo gasto:** ~25 min

**Smoke test:** `uv run python -c "from app.main import fastapi_app"` — 6 rotas registradas (`/health`, `/api/webhooks/evolution`, `/api/whatsapp/*`).

**Pendente para `/security-review`:**
- Webhook autorização (apenas `apikey` opcional + rede interna)
- Sanitização do `remote_jid` antes de logar (PII)
- Limite de tamanho do body (`fastapi` default é sem limite)
