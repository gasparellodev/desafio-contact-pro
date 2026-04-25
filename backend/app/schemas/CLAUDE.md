# app/schemas/CLAUDE.md

> Pydantic I/O da API. Leia antes de adicionar schema.

## Por que existe

Routes nunca devolvem `SQLModel` diretamente. Schemas Pydantic são o contrato público da API: o que vai pro cliente é explicitamente versionado e não vaza campos internos (`error_reason`, futuras flags privadas, etc).

## Convenção

- Um arquivo por agregado: `lead.py`, `conversation.py`, etc.
- Nomes:
  - `<X>Read` — payload completo de detalhe.
  - `<X>Summary` — subset embutido em outro recurso (ex: `LeadSummary` dentro de `ConversationListItem`).
  - `<X>ListItem` — item de listagem, geralmente subset com agregações (preview, contadores).
  - `<X>List` — envelope paginado: `{ items, total, limit, offset }` ou `{ items, next_cursor }`.
  - `<X>Page` — envelope com cursor: `{ items, next_before, limit }`.
- `model_config = ConfigDict(from_attributes=True)` — habilita mapping direto de SQLModel via `Schema.model_validate(model)`.
- Datas como `datetime` (timezone-aware), serializadas em ISO 8601 pelo padrão Pydantic.
- Enums: importar do `app/models/enums.py` (mesma fonte canônica). Pydantic serializa como `value` (string).
- IDs: `UUID` (Pydantic faz cast de str ↔ uuid).

## Como adicionar

1. Criar/editar `app/schemas/<nome>.py` com classes acima.
2. Importar e usar em `app/api/routes/<nome>.py` no `response_model=` e nas conversões manuais (`Schema.model_validate(...)`).
3. Não importar SQLModel direto no schema — só `app.models.enums.*`.
4. Atualizar este arquivo se introduzir nova convenção (ex: pageado por offset vs cursor).

## Não fazer

- Schemas com lógica de negócio. Conversão pura, no máximo um campo derivado.
- Espelhar 100% da SQLModel — selecione o que o cliente precisa.
- Reusar `<X>Read` como input de write — crie `<X>Create`/`<X>Update` separados quando precisar.
- Importar SQLModel direto.
