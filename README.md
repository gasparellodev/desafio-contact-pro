# Desafio Contact Pro — Chatbot WhatsApp + IA

Chatbot WhatsApp com IA para atendimento inicial de leads da **Contact Pro**, com inbox web em tempo real **responsiva** (mobile/tablet/desktop), suporte a **texto, áudio e imagem**, qualificação automática e classificação de intenção. Frontend com **rotas deep-linkáveis** (`/conversations/:id` sobrevive ao reload), **suíte de testes** (73 testes — 23 backend + 50 frontend) e **cobertura ≥80%**.

> **Spec do desafio:** [`desafio-tecnico.md`](./desafio-tecnico.md).
> **Diário de desenvolvimento:** [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md) (alimenta o AI Usage Report).
> **Convenções para agentes:** [`CLAUDE.md`](./CLAUDE.md) e os `CLAUDE.md` por módulo (backend, frontend, services, models, hooks, components).

---

## Visão geral

O sistema:

1. Recebe mensagens (**texto**, **áudio** ou **imagem**) de leads via WhatsApp através da **Evolution API v2.3.7** (Baileys 7.x internamente).
2. Persiste no PostgreSQL e emite eventos em tempo real via **Socket.IO** para o frontend.
3. Transcreve áudio com **OpenAI Whisper**; descreve imagens via **GPT-4o-mini** ou **Claude Sonnet 4.6** (multimodal).
4. Classifica intenção e gera resposta via **OpenAI** *ou* **Anthropic** (provider configurável por env, com mesma `AIResponse` estruturada).
5. Atualiza dados do lead (nome, empresa, intenção, status `new|qualified|needs_human|opt_out`) automaticamente.
6. Responde **em texto** (com `quoted` na mensagem original) ou **em áudio** TTS opus (quando o input foi áudio).
7. Aplica **reactions inteligentes**: 👍 ao receber, ✅ qualified, 👌 opt_out, 🤝 needs_human, ⚠️ erro.
8. **Frontend hidrata via REST** (`GET /api/conversations`, `/api/leads/{id}`, `/api/whatsapp/connection`) no mount; **Socket.IO mescla deltas** no cache do TanStack Query — F5 mantém a conversa aberta; mensagens novas aparecem em tempo real sem refetch.

---

## Stack

| Camada | Escolha (versões pinadas) |
|---|---|
| Backend | Python 3.12 + FastAPI ≥0.115 + uvicorn[standard] ≥0.32 |
| WhatsApp | Evolution API v2.3.7 (`evoapicloud/evolution-api`) — empacota Baileys 7.0.0-rc.9 |
| AI | OpenAI ≥1.50 + Anthropic ≥0.40 (`AI_PROVIDER=openai\|anthropic`) |
| STT | OpenAI `whisper-1` |
| TTS | OpenAI `gpt-4o-mini-tts` (`response_format=opus`) |
| Vision | gpt-4o-mini (OpenAI) ou claude-sonnet-4-6 (Anthropic) |
| Banco | PostgreSQL 16 + SQLModel + SQLAlchemy[asyncio] + asyncpg + Alembic |
| Cache | Redis 7 (exigido pelo Evolution v2) |
| Real-time | python-socketio 5.16.x (ASGI root) + socket.io-client 4.8.x |
| Frontend | Vite 8 + React 19.2 + Tailwind v4 (`@tailwindcss/vite`) + shadcn/ui (OKLCH) |
| Routing | React Router 7 (`createBrowserRouter`, code splitting) |
| Server cache | TanStack Query 5 (`useQuery` + `setQueryData` para deltas Socket.IO) |
| Tests backend | pytest 8 + pytest-asyncio + testcontainers Postgres 16 + httpx ASGITransport |
| Tests frontend | Vitest 4 + Testing Library 16 + jsdom 29 + axe-core 4 |
| HTTP | httpx ≥0.27 + tenacity ≥9 |

---

## Pré-requisitos

- **Docker Desktop ≥ 24** (única dependência obrigatória — sobe os 5 containers).
- *(Opcional, para rodar testes localmente sem container)*: **Node ≥ 20** + **uv ≥ 0.5** (`pip install uv`).

## Como rodar em 5 minutos (Docker Compose)

```bash
git clone https://github.com/gasparellodev/desafio-contact-pro.git
cd desafio-contact-pro

cp .env.example .env
# Edite .env e preencha SÓ as 4 chaves do bloco "Setup mínimo":
#   OPENAI_API_KEY=sk-...                  (obrigatório se AI_PROVIDER=openai; também usado por STT/TTS/vision)
#   ANTHROPIC_API_KEY=sk-ant-...           (obrigatório se AI_PROVIDER=anthropic)
#   EVOLUTION_API_KEY=qualquer-string-aqui (sua "senha" da instância Evolution)
#   ADMIN_API_TOKEN + VITE_ADMIN_TOKEN     (a MESMA string nos dois — protege endpoints + UI)
# Tudo o resto tem default funcional pro Docker; só override se precisar.

docker compose up --build
```

Sobem 5 serviços:

| Serviço | Porta host | O que faz |
|---|---|---|
| `db` | 5432 | PostgreSQL 16 (schemas `evolution_api` e `public`) |
| `redis` | 6379 | Redis 7 (exigido pelo Evolution) |
| `evolution` | 8080 | Evolution API v2.3.7 |
| `backend` | 8000 | FastAPI + Socket.IO; roda `alembic upgrade head` no entrypoint |
| `frontend` | 5173 | UI React + Tailwind + shadcn |

Acesse:

- Frontend: <http://localhost:5173> — redireciona para `/conversations`. Deep-links como `/conversations/<uuid>` sobrevivem a reload.
- Swagger da API: <http://localhost:8000/docs>
- Health-check: <http://localhost:8000/health> — retorna `ok`/`degraded` com status de DB, Redis e Evolution.

Em < 30s após `docker compose up`, todos os 5 containers ficam **healthy**.

---

## Como conectar o WhatsApp (QR Code)

1. Abra <http://localhost:5173>.
2. Clique em **"Inicializar instância"** no painel direito (uma vez na primeira execução). Isso:
   - faz `POST /instance/create` no Evolution
   - configura o webhook `POST /webhook/set/{instance}` apontando para `http://backend:8000/api/webhooks/evolution`
   - busca o QR Code via `GET /instance/connect/{instance}`
3. Escaneie o QR com WhatsApp → Aparelhos conectados → Conectar um aparelho.
4. O badge no header muda de `connecting` → `open`.

A sessão Baileys é persistida no volume `evolution_instances` (montado em `/evolution/instances`). Restart do compose mantém a conta pareada.

### Resetar a sessão WhatsApp

```bash
docker compose down
docker volume rm desafio-contact-pro_evolution_instances
docker compose up
```

---

## Como testar

### Texto

1. Envie uma mensagem de texto do seu celular para o número pareado.
2. Em <1s, a mensagem aparece na inbox em tempo real.
3. Reaction 👍 aparece na mensagem original (no celular).
4. "IA pensando…" aparece no chat.
5. Resposta volta no WhatsApp como **reply** (com cota da mensagem original).
6. A intenção classificada e dados extraídos atualizam o painel "Lead".

### Áudio

1. Envie um áudio (PTT — segure o botão de microfone).
2. Bubble exibe `🎙️ Áudio` enquanto transcreve via Whisper.
3. Transcrição aparece **inline** abaixo do bubble (`audio.transcribed` event).
4. Bot responde **em áudio** (`gpt-4o-mini-tts` → `opus` → `sendWhatsAppAudio`).
5. Se TTS falhar, há fallback automático para texto.

### Imagem

1. Envie uma imagem (com ou sem legenda).
2. Bubble exibe `🖼️ Imagem`; descrição via vision aparece inline.
3. Bot responde com base na descrição + legenda.

### Pause / handoff humano

Quando a IA classifica `intent=human_handoff` ou `status_suggestion=needs_human`, o backend **automaticamente** pausa o bot pra aquele lead (`Lead.bot_paused=True`). A última fala da IA ainda vai (avisar o lead que vai transferir), mas próximas mensagens caem em modo skip:
- Mensagem persistida ✓
- Emit Socket.IO `wa.message.received` ✓
- Reaction 👍 ✓
- **Sem typing, sem AI, sem resposta automática.**

Pra responder como humano:
1. UI mostra badge `PAUSADO · humano` âmbar no header da conversa pausada + a lista marca a conversa com `⚑ pausado`.
2. Input de envio manual aparece automático embaixo das mensagens — digita texto + clica "Enviar".
3. Backend chama `POST /api/conversations/{id}/messages` → Evolution `send_text` → mensagem chega no celular do lead. Socket.IO `wa.message.sent` mescla no cache da UI sem refetch.
4. Quando quiser que o bot volte: clica "Retomar bot" no header → `POST /api/leads/{id}/resume-bot` → `bot_paused=False` → badge some, input some.

### Indicador "digitando..."

Antes de chamar a IA, o backend dispara `evolution.send_presence(composing, delay=8000)` no contato. O lead vê **"digitando..."** no WhatsApp enquanto a IA processa. Falha do Evolution não trava pipeline (try/except + log warning).

### Trocar de provider de IA

1. Edite `.env`: `AI_PROVIDER=anthropic` e ajuste `AI_MODEL=claude-sonnet-4-6`.
2. `docker compose restart backend`.
3. A próxima mensagem usa o Claude com `tool_choice` forçado e prompt cache.

### Deep-link e persistência

- Cada conversa tem URL única: `/conversations/<uuid>`.
- F5 mantém a conversa aberta — frontend recarrega via `GET /api/conversations/{id}/messages` (REST) e Socket.IO reconecta para deltas em tempo real.
- Mensagens novas aparecem **sem refetch**: backend emite `wa.message.received`, `SocketProvider` chama `queryClient.setQueryData(...)` para mesclar.

---

## Como rodar os testes

A suíte total: **73 testes** (23 backend + 50 frontend) em ~10s combinado.

### Backend (pytest + testcontainers)

```bash
cd backend
uv sync                        # instala deps (~10s na 1ª vez)
uv run pytest tests/ -v        # 23 testes, ~5s (testcontainers spin-up Postgres)
uv run pytest --cov=app/schemas --cov-report=term-missing   # cobertura dos schemas
```

> **Requisito:** Docker rodando (testcontainers sobe um Postgres 16-alpine isolado).

### Frontend (Vitest + RTL + axe-core)

```bash
cd frontend
npm install                    # ~5s na 1ª vez
npm run test                   # 50 testes, ~3s
npm run test:coverage          # 85% statements / 67% branches / 87% functions / 91% lines
npm run typecheck              # tsc strict
npm run lint                   # eslint, zero erros
```

Testes co-located (`Component.test.tsx` ao lado de `Component.tsx`); a11y validada com `axe-core` em componentes críticos (zero violations).

---

## Provider/modelo de IA usado

- **Default:** OpenAI `gpt-4o-mini` (rápido, barato, structured output via `chat.completions.parse`).
- **Alternativo:** Anthropic `claude-sonnet-4-6` (tool_choice forçado + `cache_control: ephemeral` no system prompt — reduz custo da KB ~90% após 1ª chamada).
- **STT:** OpenAI `whisper-1` (limite 25 MB; aceita ogg/opus PTT direto).
- **TTS:** OpenAI `gpt-4o-mini-tts` (`response_format=opus`, voice `alloy`, `instructions=` controla estilo).
- **Vision:** mesmo provider ativo (`gpt-4o-mini` ou `claude-sonnet-4-6`).

---

## Arquitetura

```
[WhatsApp Cliente]
   │
   ▼
[Evolution API v2.3.7]  ──► [PostgreSQL schema "evolution_api"]
  (porta 8080)            ──► [Redis db 6]
  volume: evolution_instances:/evolution/instances
   │  REST (header `apikey:`) + Webhooks (POST → backend)
   ▼
[Backend FastAPI + Socket.IO ASGIApp (root)]
   ├─ ConversationOrchestrator (pipeline central — invariantes em services/CLAUDE.md)
   ├─ AI Provider (OpenAI | Anthropic) ──── factory.py + Protocol
   ├─ STT (OpenAI whisper-1)
   ├─ TTS (OpenAI gpt-4o-mini-tts → opus)
   ├─ Vision (multimodal do mesmo provider)
   └─ httpx AsyncClient + tenacity retries (Evolution client)
   │
   ├──► [PostgreSQL]   SQLModel async + Alembic migrations
   │
   └──► [Socket.IO v5] socket.io-client 4.8.x → React + Tailwind + shadcn
```

Detalhes em [`docs/architecture.md`](./docs/architecture.md).

---

## Decisões e trade-offs

Resumo no [`docs/decisions.md`](./docs/decisions.md). Os principais:

- **Evolution API ao invés de Baileys direto** — empacota Baileys 7.0.0-rc.9; via REST/Webhook acelera muito a entrega em 6h. `package.json` declara explicitamente a dependência da Baileys.
- **Postgres compartilhado** entre Evolution (schema `evolution_api`) e backend (`public`) — reduz containers e tempo de cold start.
- **VARCHAR para enums** em vez de `pg.ENUM` — autogenerate do Alembic tem bugs conhecidos com Enums no Postgres.
- **Provider switch via env**, com `AIResponse` estruturada — garante que orchestrator não precisa conhecer detalhes do provider.
- **`cache_control: ephemeral` no Anthropic** — reduz custo do system prompt + KB Contact Pro em ~90%.
- **Sem fila assíncrona** — orquestrador inline; latência ~3-5s aceitável para single-instance.
- **shadcn-only para UI** — todas as primitives copiadas para `src/components/ui/`; sem react-query / zustand para preservar tempo.

---

## Limitações conhecidas (decisões conscientes para o prazo)

- Sem autenticação de **usuário** (app é admin-only; endpoints exigem `X-Admin-Token`).
- Apenas **uma instância** WhatsApp por vez.
- Orchestrator inline, **sem fila assíncrona** (Celery/RQ ficou fora do prazo).
- Knowledge base **estática** (sem RAG com embeddings).
- Sem autorização HMAC/assinatura nos webhooks (Evolution v2 não envia; defesa é `apikey` obrigatório + rede interna).
- Sem TLS / Nginx / deploy cloud — `docker compose up` é o suficiente.
- Histórico da IA capado em 12 mensagens (`HISTORY_LIMIT`).
- `_apply_extracted_to_lead` não sobrescreve campos existentes (lead que muda nome em conversas futuras não atualiza).
- Cobertura backend (23 testes) cobre os endpoints REST de leitura — orchestrator/AI providers/Evolution client ainda dependem de smoke manual (Spec B do plano cobre isso).
- E2E cross-stack ainda manual — Playwright fica para Spec C (CI/CD).

---

## Troubleshooting

| Sintoma | Causa | Como resolver |
|---|---|---|
| Badge `wa: unknown` no header | Resolvido pelo PR #56 — frontend hidrata via `/api/whatsapp/connection` no mount. Se ainda aparecer, `docker compose restart backend` (o proxy backend → Evolution pode estar fora do ar). | — |
| QR Code não aparece | Instância já existe (status `connecting`) ou Evolution ainda subindo. Aguarde 30s; clique novamente. Para reset completo, ver "Resetar a sessão WhatsApp". | — |
| Mensagem não chega no UI | Webhook não configurado. Re-clique "Inicializar instância" (configura webhook idempotente) ou cheque `docker compose logs backend \| grep webhook`. | — |
| `401 unauthorized` na UI | `ADMIN_API_TOKEN` não preenchido em `.env` ou `VITE_ADMIN_TOKEN` no frontend não bate. Rebuild: `docker compose up -d --build frontend`. | — |
| `502 evolution unreachable` no console | Evolution está fora do ar. `docker compose ps evolution` e logs. UI degrada para `wa: unknown` (não quebra). | — |
| Backend não sobe (`Waiting → Recreate → Restarting`) | Conflito de porta. `docker ps` para ver quem usa 8000/5432/6379/8080. Mude `APP_PORT`/`POSTGRES_HOST_PORT`/`REDIS_HOST_PORT` no `.env`. | — |
| Bot parou de responder pra um lead específico | `Lead.bot_paused=True` (auto-pause em handoff). Esperado. Use UI ou `curl -X POST -H "X-Admin-Token: ..." http://localhost:8000/api/leads/<id>/resume-bot` pra retomar. | — |
| Pytest falha com `cannot connect to Docker` | Docker Desktop não está rodando — testcontainers precisa dele. | — |

---

## O que faria com mais tempo

- **RAG real** com embeddings da KB Contact Pro (Postgres + pgvector ou Chroma).
- **Fila assíncrona** (Celery + Redis ou Vercel Queues) para webhooks → workers.
- **Spec B**: suíte completa de testes backend (factories factory-boy, mocks `respx` para Evolution/OpenAI/Anthropic, `fakeredis`, testcontainers já em uso).
- **Spec C**: CI/CD GitHub Actions (lint + typecheck + pytest + vitest + cobertura) + Playwright cross-stack contra docker-compose real.
- **Rate limiting** no webhook + assinatura HMAC opcional.
- **Multi-instância** WhatsApp.
- **Observabilidade**: Sentry + métricas Prometheus (latência por etapa do pipeline).
- **Audit log** de todas as ações IA → lead (para review humano).
- UI: dark mode toggle, virtualização do `MessageList`, busca de conversas, scroll-up infinito de mensagens (`useInfiniteQuery` com cursor `(before, before_id)`).
- Migrar Evolution para integração direta com Baileys/whatsmeow (cumpre estritamente "biblioteca").

---

## AI Usage Report

> Seção obrigatória. Consolidada a partir do [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md).

### Ferramentas usadas

- **Claude Code (Opus 4.7, 1M context)** como agent principal — brainstorming, planejamento, validação técnica via Web search, scaffolding, implementação de todos os módulos, escrita do `CLAUDE.md` por módulo e do `DEVELOPMENT_LOG`.
- **Skills do superpowers**: `brainstorming`, `using-git-worktrees`, `executing-plans`, `verification-before-completion` (orientaram o fluxo).
- **Skills da Claude Code Plugin Vercel** (knowledge update sobre stack atual em 2026: AI Gateway, Fluid Compute, etc.).
- **Subagentes especializados** (general-purpose) para validação paralela de Evolution API, stack Python (python-socketio + asyncpg + Alembic + OpenAI/Anthropic SDKs) e stack frontend (Tailwind v4 + shadcn + React 19 + Vite).

### Onde usei IA

- **Brainstorming inicial**: alinhamento de stack, trade-offs (Evolution vs Baileys direto, Prisma vs SQLModel, OpenAI Whisper vs Groq, etc.).
- **Planejamento detalhado**: 16 PRs em 4 fases gravados em `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`.
- **Validação técnica externa** via 3 subagentes (Evolution API endpoints reais, padrões 2026 do python-socketio + SQLModel + OpenAI/Anthropic SDKs, integração Tailwind v4 + shadcn).
- **Scaffolding**: backend (FastAPI + Alembic + Dockerfile), frontend (Vite + Tailwind v4 + shadcn primitives copiados manualmente).
- **Implementação**: cada PR foi codificado pela IA com base no plano + validações.
- **Documentação**: `CLAUDE.md` por módulo, `DEVELOPMENT_LOG.md` cronológico, este README.
- **Conventional Commits** com co-autoria explícita "Claude Opus 4.7".

### Onde revisei manualmente

- Arquitetura: pipeline do `ConversationOrchestrator` (invariantes, ordem de eventos, idempotência).
- Segurança: header `apikey:` centralizado, sanitização de logs, `.gitignore` agressivo, sem secrets no diff.
- Persistência: schema do banco, FKs `CASCADE`, índices, escolha de `VARCHAR` para enums.
- Sessão WhatsApp: volume `evolution_instances`, comando de reset documentado.
- Prompts: regras (não inventar preço, opt-out, hand-off, status_suggestion); KB com 5 serviços do desafio.
- Migrations: `0001_init` escrita à mão (autogenerate seria frágil sem Postgres local + bugs conhecidos com Enums).
- StrictMode + Socket.IO (singleton fora do componente, `autoConnect: false`, cleanup que NÃO desconecta).

### Sugestões da IA rejeitadas/alteradas

- **NestJS para backend** → trocado para FastAPI por preferência.
- **WebSocket nativo do FastAPI** → trocado para Socket.IO (rooms, reconnect, fallback).
- **`prisma-client-py`** → trocado para SQLModel + Alembic (idiomático em Python, mais maduro).
- **`response_format={"type":"json_schema",...}` cru no OpenAI** → trocado para `chat.completions.parse(response_format=AIResponse)` (recomendado em 2026).
- **`baseUrl` no `tsconfig.app.json`** → removido (deprecated em TS 6).
- **Validação HMAC do webhook** → não existe assinatura nativa no Evolution v2; usei `apikey` opcional + rede interna (documentado).
- **Mover singleton do Socket.IO para Context React** → mantido como variável módulo (mais simples; menos re-render).
- **`temperature=0.7` para conversação** → rebaixado para 0.4 (mais previsível).
- **`atendai/evolution-api:latest`** → fixado em `evoapicloud/evolution-api:v2.3.7` (a antiga imagem é v1, deprecada).

### Como validei a entrega

- **Smoke test por PR**: `uv run python -c "from app.main import app"` no backend; `npm run build` (tsc strict + Vite) no frontend.
- **`docker compose config --quiet`** valida YAML do compose.
- **Validação de tipos** estrita no TS (`strict: true`, sem `any`).
- **`gh` CLI** confirmado autenticado antes da Fase 0.
- **Verificação ponta-a-ponta** está documentada em `docs/usage.md` (16 passos cobrindo texto/áudio/imagem/persistência/reset).
- A validação **end-to-end com chaves reais** depende do usuário rodar `docker compose up` com `.env` preenchido — todos os smoke tests intermediários passaram.

---

## Status do desafio

- [x] Setup do repositório
- [x] Conexão WhatsApp via Evolution API (Baileys 7.x)
- [x] Recebimento de texto
- [x] Envio de texto (com **reply** em mensagem citada)
- [x] Reaction / curtida (👍 ao receber + reaction inteligente final)
- [x] IA real respondendo (OpenAI **e** Anthropic via switch)
- [x] Frontend funcional (React + Tailwind + shadcn)
- [x] Tempo real (Socket.IO ASGI root + cliente JS)
- [x] Persistência mínima (PostgreSQL + SQLModel + Alembic)
- [x] Docker Compose (5 serviços)
- [x] Recebimento de áudio + STT (Whisper)
- [x] Resposta em áudio (TTS opus → PTT)
- [x] Imagens (vision) — diferencial
- [x] Qualificação de lead + intenção visíveis na UI
- [x] Reactions inteligentes por status
- [x] Documentação final + AI Usage Report
- [x] **Frontend responsivo mobile-first** (Sheet shadcn em mobile/tablet, 3 colunas em desktop)
- [x] **Persistência de contexto no reload** (URL = fonte da verdade do `activeId` + REST hidrata + Socket.IO mescla)
- [x] **Suíte de testes** (23 backend pytest + 50 frontend Vitest, 73 total) com cobertura ≥80% statements
- [x] **A11y validado com axe-core** em componentes críticos (zero violations)
- [x] **Code splitting por rota** (initial bundle gzip ~125KB)
- [x] **ErrorBoundary global** com UI de fallback
- [x] **Workflow de issue → branch → PR → squash merge** com Conventional Commits, atualização de CLAUDE.md e DEVELOPMENT_LOG por PR
