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
- `gh repo create` público desde o começo (visibilidade alinhada com o desafio).
- `.gitignore` agressivo cobrindo Python, Node, secrets, sessões WhatsApp e dumps.
- README skeleton com seções obrigatórias do desafio (visão, stack, setup, AI Usage Report).
- `.github/` com PR template + issue templates + labels semânticos.

**Dificuldades:**
- (preencher conforme surgir)

**Trade-offs:**
- (preencher conforme surgir)

**Sugestões da IA rejeitadas/alteradas:**
- (preencher conforme surgir)

**Tempo gasto:** _em andamento_
