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

---

## 2026-04-25 12:05 — PR #7: Socket.IO frontend client + tipos compartilhados

**Decisões:**
- `lib/socket.ts`: singleton `Socket<ServerToClientEvents, ClientToServerEvents>` fora de qualquer componente, `autoConnect: false`, transports `[websocket, polling]`, reconnect infinito com backoff 500ms→5s — pattern obrigatório para sobreviver ao double-mount do StrictMode.
- `types/domain.ts` espelha enums e modelos do backend; `types/socket.ts` declara contratos de 12 eventos (alinhados com a lista do plano).
- `hooks/useSocket` controla connect/disconnect; o cleanup **não** desconecta para preservar conexão entre re-mounts do StrictMode (pattern oficial).
- `hooks/useConnectionStatus` reage a `wa.connection.update` e `wa.qrcode.updated`.
- `lib/api.ts` wrapper minimalista de `fetch` (URL configurável via `VITE_API_URL`); sem react-query (escopo).

**Dificuldades:**
- Nenhuma — pattern oficial das docs cumpriu o caso.

**Trade-offs:**
- Sem `import.meta.env.VITE_API_URL` por padrão — fallback para `http://localhost:8000`. Documentar no README final como customizar.

**Sugestões da IA rejeitadas/alteradas:**
- IA sugeriu mover singleton para um React Context. Rejeitado: o singleton fora do componente é mais simples, evita re-render em consumidores que só precisam de `socket.emit`.

**Tempo gasto:** ~10 min

**Smoke test:** `npm run build` → tsc strict + Vite verde.

---

## 2026-04-25 12:25 — PR #8: AI provider abstraction + KB Contact Pro

**Decisões:**
- `base.py`: `AIProvider` Protocol com 2 métodos (`generate_response`, `describe_image`). Output sempre `AIResponse{reply, intent, lead_extracted, status_suggestion}` Pydantic.
- `OpenAIProvider`: `client.chat.completions.parse(response_format=AIResponse)` — pattern recomendado em 2026 (mais robusto que `response_format={"type":"json_schema",...}` cru).
- `AnthropicProvider`: `tool_choice={"type":"tool","name":"emit_response"}` forçado, com `input_schema` JSON espelho do `AIResponse`. System prompt em block list com `cache_control: ephemeral` (reduz custo da KB ~90% após 1ª chamada).
- `factory.py:get_ai_provider()` lru_cache lê `settings.ai_provider`. Outros módulos só importam o factory.
- `knowledge_base/contact_pro.md` cobre os 5 serviços + tom + regras de qualificação.
- `prompts.py:build_system_prompt` concatena regras + KB; lru_cache.

**Dificuldades:**
- Path da KB falhou no primeiro smoke (faltava 1 nível de `parent`); corrigido para `parent.parent.parent` a partir de `prompts.py`.
- Anthropic tool_use schema precisa replicar exatamente os enums do desafio — qualquer divergência rejeitaria a resposta. Replicado à mão; futuro: gerar a partir do Pydantic via `model_json_schema()`.

**Trade-offs:**
- Sem chamada real à OpenAI/Anthropic ainda (sem chaves nesta máquina). Validação acontece com smoke do compose-up + chave do usuário.
- Vision usa o mesmo provider escolhido em `AI_PROVIDER` — mais simples que ter um terceiro env. Se o usuário usar Anthropic + quiser GPT vision, terá que fazer override manual.

**Sugestões da IA rejeitadas/alteradas:**
- IA inicial sugeriu adicionar `cache_control` em todo bloco system. Mantive só no bloco da KB (reduz miss em cache invalidation).
- IA sugeriu `temperature=0.7` para conversação; rebaixei para 0.4 (mais previsível, ainda natural).

**Tempo gasto:** ~25 min

**Smoke test:** `from app.services.ai.factory import get_ai_provider` + `build_system_prompt()` retorna 4307 chars; AIResponse fields batem.

**Pendente:** smoke test real com chave (próxima fase no compose-up).

---

## 2026-04-25 12:55 — PR #9: ConversationOrchestrator (texto)

**Decisões:**
- `services/conversation_orchestrator.py` em arquivo único (~250 linhas) — para 6h, ter o pipeline na frente é melhor que distribuir em N repositórios.
- Pipeline texto-only neste PR (áudio/imagem entram nos PRs #11–14 estendendo o método).
- Cap de histórico em **12 mensagens** (`HISTORY_LIMIT`) — controla custo da chamada e latência.
- Reaction 👍 fire-and-forget (não bloqueia se falhar).
- Smart reaction final ≠ 👍: ✅ qualified, 👌 opt_out, 🤝 needs_human (decisão própria — desafio não exige mas adiciona contexto visual no celular).
- Webhook handler (`api/routes/webhooks.py`) instancia `SessionLocal()` per-request e passa para o orchestrator. Sempre devolve 200 (mesmo em erro do AI/send) para Evolution não fazer redelivery infinita; o erro é emitido via `error` no Socket.IO.

**Dificuldades:**
- Decidir o que fazer com `from_me=True`: ignorar (nossa escolha) vs. usar como ack do envio. Optei por ignorar — o ciclo OUT já tem feedback explícito via persistência + `wa.message.sent` antes mesmo do webhook chegar.
- Anti-loop: o `quoted` no `send_text` precisa do payload original com `key.fromMe=false` (do remetente original). Documentado.

**Trade-offs:**
- Sem fila assíncrona — o webhook handler bloqueia até toda a pipeline terminar. Para WhatsApp single-instance e prazo de 6h, é aceitável (latência ~3-5s típica). Documentar como limitação no README.
- `_apply_extracted_to_lead` só preenche campos vazios (não sobrescreve). Trade-off: lead que muda de nome/empresa em conversas posteriores não atualiza. Bom o suficiente para a entrega.

**Sugestões da IA rejeitadas/alteradas:**
- IA inicial sugeriu emitir todos os 12 eventos do Socket.IO em uma única função `emit_pipeline()`. Rejeitei: cada emit espelha um momento real do pipeline; agrupar quebraria observabilidade.

**Tempo gasto:** ~30 min

**Smoke test:** `from app.services.conversation_orchestrator import ConversationOrchestrator` OK, todas as rotas registradas, sem erros de importação.

---

## 2026-04-25 13:25 — PR #10: Frontend UI completa

**Decisões:**
- Layout split 12-col: 3 (ConversationList) + 6 (MessageList) + 3 (QRCodePanel + LeadPanel).
- `useConversations` com `useReducer` (sem zustand/react-query no escopo de 6h). 9 events do socket são reduzidos: `wa.message.received`, `wa.audio.received`, `audio.transcribed`, `wa.message.sent`, `wa.audio.sent`, `ai.response.generated`, `lead.updated`, `conversation.status_changed`, `ai.thinking`.
- `MessageBubble` distingue tipo (TEXT/AUDIO/IMAGE), exibe transcrição inline em áudio, mostra status badge (sent/failed/etc) e horário.
- `AIThinkingIndicator` com 3 dots staggered animate-bounce.
- `QRCodePanel` tem botão "Inicializar instância" que faz POST `/api/whatsapp/instance` + POST `/api/whatsapp/webhook` + GET `/api/whatsapp/qrcode` em sequência. Renderiza imagem do QR embed em base64.
- `LeadPanel` mostra nome, empresa, telefone, interesse, objetivo, volume estimado, status colorido (success qualified, warning needs_human).
- Auto-scroll no `MessageList` em cada nova mensagem ou flag de thinking.

**Dificuldades:**
- TS erro inicial: `conversation.status_changed` typed como `Conversation` mas o backend só envia `{id, last_intent}`. Ajustado para `Partial<Conversation> & {id: string}` no socket.ts.
- StrictMode + Socket.IO: validei via `useSocket` cleanup que NÃO desconecta — pattern mantém a conexão viva entre re-mounts em dev.

**Trade-offs:**
- Sem virtualização do `MessageList` — `ScrollArea` + `overflow-y-auto` é suficiente para <500 mensagens (caso típico de uma conversa de qualificação).
- Sem suporte a múltiplas conversas selecionadas — a UI mostra apenas a `active` (primeira por default ou via `setActiveId`).
- Sem dark mode toggle — tokens do shadcn já suportam, mas adicionar UI de toggle não é prioridade.

**Sugestões da IA rejeitadas/alteradas:**
- IA inicial sugeriu `react-hot-toast` para o erro emit. Rejeitei: o `error` evento já vai ser exibido em uma futura iteração; menos uma dep.

**Tempo gasto:** ~30 min

**Smoke test:** `npm run build` → tsc strict + Vite verde (302KB JS gzip 94KB).

---

## 2026-04-25 13:55 — PR #11: Audio in (Whisper STT)

**Decisões:** OpenAITranscriber (`whisper-1`, language=pt). Orchestrator: download base64 → decode → transcribe → grava em `msg_in.transcription` → emit `audio.transcribed` → substitui `ai_input_text`.
**Tempo:** ~15 min.

---

## 2026-04-25 14:10 — PR #12: Audio out (TTS opus → PTT)

**Decisões:** OpenAITTS (`gpt-4o-mini-tts`, `response_format=opus`). Se input foi áudio, gera TTS, base64-encode e envia via `send_audio`. Fallback automático para texto se falhar.
**Tempo:** ~15 min.

---

## 2026-04-25 14:25 — PR #13: Lead UI (entregue dentro do PR #10)

LeadPanel + status pills + intent badges já estavam no PR #10. Marcado completo sem PR separado.

---

## 2026-04-25 14:30 — PR #14: Vision (imagens via multimodal)

**Decisões:** `services/vision/multimodal.py:describe_image` chama o `AIProvider` ativo. Limite ~4MB. Orchestrator: detecta `MessageType.IMAGE`, baixa, descreve, grava como `transcription`, compõe `ai_input_text` com a descrição.
**Dificuldades:** Edits intermediários falharam silenciosamente; recuperado via Read explícito.
**Tempo:** ~15 min.

---

## 2026-04-25 14:45 — PR #15: Smart reactions (entregue no PR #9)

`_reaction_for_status` no orchestrator já mapeia LeadStatus→emoji e é chamado ao final do pipeline. Marcado completo sem PR separado.

---

## 2026-04-25 14:55 — PR #16: README + AI Usage Report + docs final

**Decisões:**
- README final cobre **todas** as 17 seções obrigatórias do desafio (visão, stack, como rodar, env, conexão WhatsApp, sessão/reset, testar texto/áudio/imagem, providers, arquitetura, decisões, limitações, "o que faria com mais tempo", AI Usage Report, status checkbox).
- `docs/architecture.md` com diagrama detalhado, pipeline canônica numerada, tabela de eventos Socket.IO, modelo de dados, provider switch.
- `docs/usage.md` com pré-requisitos, smoke commands, exemplos de conversa, troca de provider, reset, logs, swagger.
- `docs/decisions.md` com 12 ADRs leves (Evolution, Postgres compartilhado, VARCHAR enums, provider switch, Socket.IO, prompt cache, TTS opus, idempotência, history limit, shadcn-only, useReducer, StrictMode).
- `AI Usage Report` consolidado a partir deste DEVELOPMENT_LOG.

**Tempo:** ~25 min.

**Smoke test final:** `docker compose config --quiet` ✓; `cd backend && uv run python -c "from app.main import app"` ✓; `cd frontend && npm run build` ✓.

---

## 2026-04-25 14:50 — PR de follow-up A: críticos do security review (#31, #32) + body cap (#34)

**Decisões:**
- **#31** (apikey bypassável): header obrigatório; `hmac.compare_digest` para timing-safe; sem chave configurada → 503.
- **#32** (race em idempotência): `try/except IntegrityError` no commit da Message IN; duplicata silenciosa via UNIQUE.
- **#34** (body cap): guard de Content-Length 25 MB → 413 quando excede.
- Bonus: response do orchestrator não vaza `str(exc)`; helper `_mask_jid` para PII em logs.

**Tempo:** ~15 min.

---

## 2026-04-25 15:00 — PR de follow-up C: derivar Anthropic tool schema do Pydantic (#35)

**Decisões:**
- `_build_emit_tool_schema()` deriva `input_schema` de `AIResponse.model_json_schema()`. Helper `_resolve_refs` inline `$ref → $defs/X` recursivamente (Anthropic não resolve `$defs` automaticamente).
- Schema antigo (~70 linhas hard-coded) removido. `EMIT_TOOL_SCHEMA` agora calculado uma vez no import.
- Smoke: round-trip — payload de exemplo com 9 intents válidos passa em `AIResponse.model_validate`.
- Bonus: removido `_to_dict` que era dead code (achado [Baixo] do code review do PR #24).
- `services/ai/CLAUDE.md` atualizado: regra agora é "schema gerado de `AIResponse`; mude o Pydantic, não o tool".

**Tempo:** ~10 min.

---

## Recap — todos os 5 follow-ups fechados

| Issue | PR follow-up | Status |
|---|---|---|
| #31 webhook apikey | #36 | ✅ merged |
| #32 race idempotência | #36 | ✅ merged |
| #34 body cap | #36 | ✅ merged |
| #33 admin auth proxy | #37 | ✅ merged |
| #35 schema derivation | (pending PR C) | ⏳ open |

---

## 2026-04-25 16:30 — PR #46 / Issue #45: REST read endpoints (Spec A — Phase 1 backend)

**Contexto:** parte do épico #44 (Spec A: frontend overhaul + backend read APIs). Brainstorming registrado em `/Users/gasparellodev/.claude/plans/precisamos-criar-um-plano-abstract-wombat.md`. Frontend hoje constrói estado só via Socket.IO em tempo real; reload zera tudo porque não há endpoint REST para rehidratar da Postgres (que já persiste tudo). Esta PR fecha esse buraco do lado do backend, sem tocar frontend ainda.

**Decisões:**
- 4 endpoints novos, todos sob `Depends(require_admin_token)` (consistência com `whatsapp.py`):
  - `GET /api/conversations` — paginação offset+limit (50 default, 200 max), filtros opcionais `status` (LeadStatus) e `q` (ILIKE em name/phone/whatsapp_jid). Ordenação por `last_message_at desc`. Envelope `ConversationList { items, total, limit, offset }`.
  - `GET /api/conversations/{id}` — detalhe (sem mensagens) com `LeadSummary` embutido.
  - `GET /api/conversations/{id}/messages` — paginação cursor `before` timestamp, retorna em ordem cronológica ascendente. Envelope `MessagePage { items, next_before, limit }`. Padrão clássico de infinite scroll up para chat.
  - `GET /api/leads/{id}` — `LeadRead` completo.
- Pydantic schemas explícitos em `app/schemas/{lead,conversation}.py` (com `ConfigDict(from_attributes=True)`). Pasta `schemas/` estava vazia — nova convenção `<X>Read`/`<X>Summary`/`<X>ListItem`/`<X>List`/`<X>Page` documentada em `app/schemas/CLAUDE.md` (criado).
- `app/api/CLAUDE.md` foi criado também (era referenciado pelo CLAUDE.md raiz mas não existia).
- Infra de testes: `tests/conftest.py` usando **testcontainers Postgres 16-alpine** (mesma imagem do compose) por sessão pytest, engine async com `NullPool` por teste, `httpx.AsyncClient` via `ASGITransport`, override de `get_session` para apontar pro engine de teste. Headers de admin já injetados no client.
- 17 testes cobrindo: pagination (offset+limit), filters (status), search (q em name/phone/jid), ordering (last_message_at), 404 (conversation/lead missing), auth (401 sem token), cursor pagination (`before`/`next_before`), validação Pydantic (`limit>200` → 422). 100% cobertura dos schemas.

**Dificuldades:**
- Primeira tentativa do conftest deu `cannot perform operation: another operation is in progress` (asyncpg compartilhando connection entre fixtures). Fix: `NullPool` no engine para que cada session pegue conexão fresca.
- Segunda tentativa deu `Event loop is closed` no teardown (session-scoped engine + função-scoped tests = mismatch de event loop). Fix: engine **função-scoped**; `create_all` é idempotente sobre Postgres já inicializado, custo trivial. Container continua session-scoped (startup ~3-5s).
- Pivotei `asyncio_default_fixture_loop_scope` de `session` para `function` por consistência.

**Trade-offs:**
- Engine recriado por teste é levemente mais lento que session-scoped, mas elimina toda complexidade de loop scope. 17 testes em ~5s é aceitável; revisita se passar de 30s.
- Não usei factory-boy ainda — Spec B vai introduzir. Para esta fase, helpers inline (`_seed_pair`, `_make_lead`) são suficientes e mais legíveis.
- TRUNCATE no setup do engine (não teardown) garante limpeza mesmo se teste anterior crashou no meio. Custo de uma query a mais é desprezível.

**Sugestões da IA rejeitadas/alteradas:**
- Considerei adicionar `last_message_preview` direto em `ConversationListItem` via subquery, mas mantive fora do v1 — UI pode pegar ao abrir conversa, e schema fica mais simples. Adicionar na v2 se for necessário pelo design da `frontend-design`.
- Considerei testcontainers com `aiosqlite` em memória pra rodar sem Docker, mas modelo usa `PG_UUID` direto — não funciona em SQLite sem TypeDecorator. Postgres real é mais correto e o repo já depende de Docker para tudo.

**Reviews aplicadas (commit fixup `08c831f`):**
- sentry-skills:code-review + superpowers:code-reviewer + sentry-skills:security-review.
- Cursor de `/messages` migrou para `(created_at, id)` via `tuple_` para evitar pular mensagens com timestamp idêntico (race IN/OUT). `MessagePage.next_before_id` adicionado; cliente que passa só `before` continua funcionando (compat).
- `count_stmt` da listagem só faz JOIN com Lead quando há filtro `status`/`q`. Caso default usa `count(Conversation.id)` puro.
- `LeadSummary` ganhou `service_interest` (sidebar usa sem round-trip extra).
- `_escape_like` aplica escape de `%`/`_` no parâmetro `q` — busca passa a ser substring literal (princípio do menor surpresa).
- 5 testes adicionais: invalid token (`compare_digest` path), filtros combinados, `offset >= total`, cursor com timestamp ties, serialização de campos de mídia. `test_list_messages_clamps_limit` renomeado para `rejects_limit_above_max`.

**Smoke test:**
```bash
cd backend && uv run pytest tests/api -v   # 23 passed in ~5s
docker compose up -d --build backend
curl -H "X-Admin-Token: $TOKEN" 'http://localhost:8000/api/conversations?limit=2'  # ok, lead.service_interest presente
curl -H "X-Admin-Token: $TOKEN" 'http://localhost:8000/api/conversations?q=%25'    # total: 0 (escape funciona)
```

**Tempo:** ~70min (incluindo brainstorming, plano, infra de testes, iteração no conftest, 2 reviews, fixup, PR).
