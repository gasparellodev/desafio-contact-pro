# backend/CLAUDE.md

> Regras do backend Python. Leia antes de adicionar/alterar código aqui.

## Propósito

API FastAPI + Socket.IO que recebe webhooks da Evolution API, orquestra IA/STT/TTS, persiste no Postgres e emite eventos em tempo real para o frontend.

## Princípios não-negociáveis

1. **Async end-to-end.** Nada de `time.sleep`, `requests`, ou ORM síncrono. Use `httpx.AsyncClient`, `AsyncSession` (SQLModel/SQLAlchemy) e `await`.
2. **Persistir antes de emitir.** Nunca emita Socket.IO antes de salvar a entidade no banco. Nunca envie ao WhatsApp sem persistir a `Message` OUT primeiro.
3. **Idempotência em webhooks.** Toda mensagem tem `whatsapp_message_id` UNIQUE; duplicatas são ignoradas silenciosamente.
4. **Settings centralizadas.** Nunca leia `os.environ` direto fora de `app/core/config.py`. Use `get_settings()`.
5. **Erros vão para Socket.IO `error`.** Erros que afetam o usuário emitem `error` com `{ code, message, conversation_id? }`.

## Estrutura

```
app/
  main.py                  # FastAPI + Socket.IO ASGIApp como root
  core/
    config.py              # pydantic-settings; get_settings() é fonte única
    logging.py             # JSON logger
    socketio.py            # AsyncServer + emit_global / emit_to_conversation
  db/
    session.py             # async engine + SessionLocal + get_session dep
    base.py                # importa todos os models para SQLModel.metadata
  models/                  # SQLModel tables
  schemas/                 # Pydantic I/O da API
  api/
    deps.py                # dependências comuns
    routes/                # endpoints (health, webhooks, conversations, leads, messages, whatsapp)
  services/
    whatsapp/              # Evolution client + handlers + media
    ai/                    # provider abstraction
    transcription/, tts/, vision/
    intent_classifier.py
    lead_qualification.py
    conversation_orchestrator.py
  knowledge_base/          # KB Contact Pro
alembic/                   # migrations
  env.py                   # já configurado para async + SQLModel.metadata + compare_type=True
  script.py.mako           # injeta `import sqlmodel` em cada migration
```

## Comandos

```bash
# Setup
uv sync

# Dev local
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Migrations
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "<descr>"

# Lint
uv run ruff check .
uv run ruff format .

# Tests
uv run pytest
```

## Como adicionar uma nova rota

1. Criar arquivo em `app/api/routes/<nome>.py` com `router = APIRouter(prefix="/api/...", tags=[...])`.
2. Registrar em `app/main.py` via `fastapi_app.include_router(...)`.
3. Schemas Pydantic em `app/schemas/` (não retornar SQLModel diretamente para evitar leak de campos).
4. Dependência de DB: `Depends(get_session)`.

## Como adicionar um service

1. Pasta em `app/services/<nome>/` com `__init__.py`.
2. Se for I/O com terceiros: usar `httpx.AsyncClient` (ou o singleton do app, quando criado).
3. Se for chamável pela orchestrator: receber dados puros (Pydantic), não `Session` (mantém testabilidade).

## Migrations: gotchas reais

- `import sqlmodel` já está em `script.py.mako` — qualquer `AutoString` em modelos SQLModel funciona.
- `compare_type=True` ativado.
- **Enums em Postgres** têm bugs no autogenerate (não geram `DROP TYPE` no downgrade nem `ALTER TYPE ADD VALUE`). Preferimos `Field(sa_column=Column(String))` + Pydantic Enum, OU edição manual da migration.
- UUID como PK: `Field(default_factory=uuid4, sa_column=Column(UUID(as_uuid=True), primary_key=True))`.

## Provider switch (OpenAI ↔ Anthropic)

`app/services/ai/factory.py` lê `settings.ai_provider` e retorna `AIProvider` adequado. **Não importe diretamente** `OpenAIProvider`/`AnthropicProvider` em outros módulos — sempre via factory.

## Não fazer

- `print()` para log → use `logging.getLogger(__name__).info({...})`.
- Tornar route handler `def` síncrono — sempre `async def`.
- Importar models dentro de migrations (alembic resolve via `target_metadata = SQLModel.metadata`).
- Criar uma segunda fonte de configuração que não passe por `get_settings()`.
- Emitir Socket.IO de dentro de um repository/service que não recebeu o orquestrador como dep.

## Links

- `app/main.py:1` — bootstrap
- `app/core/socketio.py:1` — gateway
- `app/services/conversation_orchestrator.py` — pipeline (a ser criado no PR #9)
- Plan: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
