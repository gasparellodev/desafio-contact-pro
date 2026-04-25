# app/models/CLAUDE.md

> Regras dos models de banco. Leia antes de criar/alterar tabela.

## Modelos

| Modelo | Tabela | Resumo |
|---|---|---|
| `Lead` | `leads` | 1 por número WhatsApp. `whatsapp_jid` UNIQUE. |
| `Conversation` | `conversations` | Pertence a um Lead. Guarda última intenção e timestamp. |
| `Message` | `messages` | Cada mensagem (IN/OUT). `whatsapp_message_id` UNIQUE → idempotência. |

## Enums (em `enums.py`)

`LeadStatus`, `ServiceInterest`, `Intent`, `Direction`, `MessageType`, `MessageStatus`. Todos `str, Enum` — armazenados como `VARCHAR(N)` no Postgres, validados na camada Pydantic.

## Por que NÃO usamos `pg.ENUM`

O autogenerate do Alembic tem bugs conhecidos com Postgres ENUM:
- não gera `DROP TYPE` no downgrade
- não suporta `ALTER TYPE ADD VALUE`
- migra para outro tipo gera revisão quebrada

Solução: `Column(String(N))` com Pydantic Enum como tipo Python. Trade-off aceito: validação não acontece no DB, mas o app valida em todo I/O.

## Convenções

- **PK:** `UUID` com `default_factory=uuid4`, coluna `PG_UUID(as_uuid=True)`.
- **Timestamps:** `DateTime(timezone=True)`, `default_factory=_now` que usa `datetime.now(UTC)`.
- **FKs:** sempre com `ondelete="CASCADE"` quando a relação é parte-todo (Conversation→Lead, Message→Conversation).
- **Índices:** em `whatsapp_jid` (Lead), `whatsapp_message_id` (Message), `lead_id` (Conversation), `conversation_id` (Message), `direction` (Message), `created_at` (Message), `status` (Lead).
- **Idempotência:** `whatsapp_message_id` UNIQUE NULL — Evolution pode redeliver, orchestrator faz `INSERT ... ON CONFLICT DO NOTHING` ou checagem prévia.

## Como adicionar um novo model

1. Criar arquivo em `app/models/<nome>.py`.
2. Subclassar `SQLModel, table=True`.
3. Registrar import em `app/db/base.py` (senão SQLModel.metadata não enxerga).
4. Gerar migration: `uv run alembic revision --autogenerate -m "<descr>"`.
5. **Revisar a migration manualmente** antes de aplicar — autogenerate pode gerar lixo (especialmente índices, defaults com `func`).
6. `uv run alembic upgrade head`.

## Como adicionar um campo

1. Adicionar `Field(...)` no model.
2. Migration autogerada deve detectar (`compare_type=True` está ativado).
3. Para `nullable=False` em tabela com dados existentes: usar `server_default=` + alterar o tipo em duas etapas (add nullable → backfill → make NOT NULL). Não tente fazer numa migration só.

## Não fazer

- `Column(Enum(...))` — vai quebrar autogenerate. Use `String(N)` + Pydantic Enum.
- Esquecer de adicionar import em `app/db/base.py` — SQLModel.metadata fica vazio para esse model.
- `DateTime` sem `timezone=True` — sempre UTC com tz.
- FK sem `ondelete=` — vira lixo órfão.

## Links

- `enums.py` — fonte canônica das enums (espelha o desafio)
- `app/db/base.py` — registry de models para Alembic
- Plan: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
