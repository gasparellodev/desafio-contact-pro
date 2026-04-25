# Decisões técnicas (ADRs leves)

## DR-001 — Evolution API v2.3.7 ao invés de Baileys direto

**Contexto:** Desafio exige Baileys ou whatsmeow como biblioteca.
**Decisão:** Usar Evolution API container (`evoapicloud/evolution-api:v2.3.7`).
**Justificativa:** Evolution **empacota Baileys 7.0.0-rc.9** (verificável no `package.json` do projeto Evolution). Cumpre o requisito da biblioteca e acelera a entrega em 6h: REST + Webhook unificados, audio/PTT com ffmpeg interno, sessão persistida em volume.
**Trade-off:** Container extra; precisa Postgres + Redis (não suporta sqlite-internal em v2).

## DR-002 — Postgres compartilhado (schemas separados)

**Contexto:** Evolution v2 exige Postgres; backend também precisa.
**Decisão:** Um único container Postgres com schemas `evolution_api` (Evolution) e `public` (backend).
**Justificativa:** Reduz containers, simplifica setup, init SQL no compose cria os schemas idempotentemente.
**Trade-off:** Falha do schema `evolution_api` afeta o mesmo cluster do backend (em produção, separar).

## DR-003 — VARCHAR para enums no Postgres

**Contexto:** Modelos têm 6 enums (`LeadStatus`, `Intent`, etc.).
**Decisão:** Armazenar como `String(N)` com Pydantic Enum como tipo Python.
**Justificativa:** Autogenerate do Alembic tem bugs conhecidos com `pg.ENUM` (não gera `DROP TYPE` no downgrade, não suporta `ALTER TYPE ADD VALUE`). Validação fica na borda Python.
**Trade-off:** Sem enforcement no banco. Mitigação: validação Pydantic em todo I/O.

## DR-004 — Provider switch via env (OpenAI ↔ Anthropic)

**Contexto:** Desafio aceita um provider; usuário pediu ambos.
**Decisão:** Abstração `AIProvider` (Protocol em `services/ai/base.py`); fábrica via `AI_PROVIDER` env.
**Justificativa:** Orchestrator não conhece detalhes do provider; permite A/B na demo. OpenAI usa `chat.completions.parse(response_format=AIResponse)`, Anthropic usa `tool_choice` forçado + `cache_control: ephemeral` (reduz custo da KB ~90%).
**Trade-off:** Mais código para manter; schema duplicado em JSON (Anthropic) e Pydantic (OpenAI).

## DR-005 — Socket.IO ao invés de WebSocket nativo

**Contexto:** Real-time é obrigatório.
**Decisão:** `python-socketio` ASGI root + `socket.io-client` 4.8.x.
**Justificativa:** Reconnect automático, rooms por conversa, fallback HTTP, tipagem TS. Validado nas docs oficiais que `socketio.ASGIApp(sio, fastapi_app)` deve ser **app raiz**, não `fastapi_app.mount()`.
**Trade-off:** Dep extra no frontend (~30 KB gzip).

## DR-006 — `cache_control: ephemeral` no system prompt do Anthropic

**Contexto:** System prompt + KB Contact Pro = ~4300 chars (~1100 tokens). Cada chamada paga.
**Decisão:** Marcar o bloco system com `cache_control: {type: 'ephemeral'}`.
**Justificativa:** Anthropic prompt cache: 1ª chamada paga normal, próximas (TTL 5min) custam 10% do input. Reduz custo da conversa em ~90% após o primeiro turno.
**Trade-off:** Incompatível com `extended_thinking` (não usamos).

## DR-007 — TTS em `opus` por default

**Contexto:** WhatsApp PTT é `audio/ogg; codecs=opus`.
**Decisão:** `response_format="opus"` no `gpt-4o-mini-tts`.
**Justificativa:** Evolution converte qualquer formato via ffmpeg interno, mas pular conversão reduz latência. `instructions=` parameter (apenas em `gpt-4o-mini-tts`) permite controlar tom.
**Trade-off:** Modelo mais novo; menos voices que `tts-1`.

## DR-008 — Idempotência por `whatsapp_message_id` UNIQUE

**Contexto:** Evolution faz redelivery de webhook em até 3× (retry policy interno).
**Decisão:** Coluna `Message.whatsapp_message_id` com índice UNIQUE; orchestrator checa existência antes de processar.
**Justificativa:** Sem isso, redelivery duplica leads e respostas.
**Trade-off:** Caso o backend explode entre o save e o reply, o lead recebe a resposta uma vez (correto), mas se a Evolution não recebe ack, ela retenta — a checagem por id absorve.

## DR-009 — Histórico capado em 12 mensagens

**Contexto:** Conversas de qualificação ficam longas; cada chamada inclui o histórico.
**Decisão:** `HISTORY_LIMIT = 12` em `conversation_orchestrator.py`.
**Justificativa:** Equilíbrio entre contexto e custo/latência. ~12 turns cobrem uma sessão típica de qualificação.
**Trade-off:** Lead em conversa muito longa pode "esquecer" detalhes do começo. Aceitável; em produção: sumarização automática a cada N turns.

## DR-010 — shadcn-only para UI primitives

**Contexto:** Desafio exige frontend funcional, não polido.
**Decisão:** Copiar primitives do shadcn (button, card, badge, scroll-area, separator, avatar) para `src/components/ui/`. Sem dep `@radix-ui/themes` ou Mantine.
**Justificativa:** shadcn é o padrão atual em 2026; cópias locais permitem customização. Tailwind v4 + OKLCH defaults.
**Trade-off:** 8+ arquivos para manter; pequeno dever de revisão quando atualizar shadcn.

## DR-011 — `useReducer` ao invés de zustand/react-query

**Contexto:** Estado global da inbox (conversas, mensagens, thinking).
**Decisão:** `useReducer` em `hooks/useConversations.ts`.
**Justificativa:** Para 6h, evita dep extra; o estado é simples (~5 actions). Componente raiz consome o hook uma vez.
**Trade-off:** Sem cache HTTP (Suspense-based); refresh do navegador não traz histórico via REST (futuro: endpoint `GET /api/conversations` + hidratação).

## DR-012 — StrictMode + Socket.IO singleton

**Contexto:** React 19 StrictMode dupla-monta componentes em dev → 2 conexões Socket.IO.
**Decisão:** Singleton fora do componente (`lib/socket.ts`) com `autoConnect: false`. `useSocket` chama `connect()` no mount; cleanup **não** desconecta (mantém viva entre re-mounts).
**Justificativa:** Pattern oficial do socket.io. Evita race conditions e duplicação de listeners.
**Trade-off:** Em produção (sem StrictMode), perde-se o "graceful disconnect" no unmount — aceitável porque o cliente fecha a aba ou navega.
