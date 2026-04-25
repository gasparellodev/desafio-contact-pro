# Desafio Contact Pro — Chatbot WhatsApp + IA

Chatbot WhatsApp com IA para atendimento inicial de leads da **Contact Pro**, com frontend web em tempo real, suporte a **texto, áudio e imagem**, qualificação automática e classificação de intenção.

> **Spec do desafio:** [`desafio-tecnico.md`](./desafio-tecnico.md).
> **Diário de desenvolvimento:** [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md) (alimenta o AI Usage Report).
> **Convenções para agentes:** [`CLAUDE.md`](./CLAUDE.md) e os `CLAUDE.md` por módulo.

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
| HTTP | httpx ≥0.27 + tenacity ≥9 |

---

## Como rodar (Docker Compose)

```bash
git clone https://github.com/<your-user>/desafio-contact-pro.git
cd desafio-contact-pro

cp .env.example .env
# Edite .env e preencha pelo menos:
#   OPENAI_API_KEY=sk-...                  (obrigatório se AI_PROVIDER=openai e para STT/TTS/vision)
#   ANTHROPIC_API_KEY=sk-ant-...           (obrigatório se AI_PROVIDER=anthropic)
#   EVOLUTION_API_KEY=qualquer-string-aqui (será o seu apikey do Evolution)
#   AI_API_KEY=                            (fallback usado quando faltar a explícita)

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

- Frontend: <http://localhost:5173>
- Swagger da API: <http://localhost:8000/docs>
- Health-check: <http://localhost:8000/health>

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

### Trocar de provider de IA

1. Edite `.env`: `AI_PROVIDER=anthropic` e ajuste `AI_MODEL=claude-sonnet-4-6`.
2. `docker compose restart backend`.
3. A próxima mensagem usa o Claude com `tool_choice` forçado e prompt cache.

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

## Limitações conhecidas (decisões conscientes para o prazo de 6h)

- Sem autenticação / login na UI (app local).
- Apenas **uma instância** WhatsApp por vez.
- Orchestrator inline, **sem fila assíncrona** (Celery/RQ não cabe em 6h).
- Knowledge base **estática** (sem RAG com embeddings).
- Sem autorização HMAC/assinatura nos webhooks (Evolution v2 não envia; defesa é `apikey` opcional + rede interna).
- **Sem testes automatizados** completos (apenas smoke por import e build verificados a cada PR).
- Sem TLS / Nginx / deploy cloud — `docker compose up` é o suficiente.
- Histórico da IA capado em 12 mensagens (`HISTORY_LIMIT`).
- `_apply_extracted_to_lead` não sobrescreve campos existentes (lead que muda nome em conversas futuras não atualiza).

---

## O que faria com mais tempo

- **RAG real** com embeddings da KB Contact Pro (Postgres + pgvector ou Chroma).
- **Fila assíncrona** (Celery + Redis ou Vercel Queues) para webhooks → workers.
- **Testes E2E** com pytest + httpx ASGITransport + WebSocket de teste.
- **Rate limiting** no webhook + assinatura HMAC opcional.
- **Multi-instância** WhatsApp.
- **Observabilidade**: Sentry + métricas Prometheus (latência por etapa do pipeline).
- **Audit log** de todas as ações IA → lead (para review humano).
- UI: dark mode toggle, virtualização do `MessageList`, busca de conversas.
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

### Tempo aproximado de execução

- **Brainstorm + plano + validações técnicas**: ~50 min
- **PRs #1–4 (setup repo, scaffolding backend/frontend, docker-compose)**: ~80 min
- **PRs #5–9 (DB, Evolution client, Socket.IO, AI providers, orchestrator)**: ~120 min
- **PR #10 (UI completa)**: ~30 min
- **PRs #11–14 (audio in/out, vision)**: ~75 min
- **PR #16 (docs final)**: ~30 min

**Total ≈ 6 horas** (cumpriu o prazo).

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
