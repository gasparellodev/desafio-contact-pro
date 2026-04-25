# app/api/CLAUDE.md

> Convenção das rotas REST. Leia antes de adicionar/alterar endpoint.

## Estrutura

```
api/
  deps.py          # exporta get_session (DI da AsyncSession)
  security.py      # require_admin_token (HMAC compare_digest)
  routes/
    health.py        # GET /health (DB, Redis, Evolution)
    webhooks.py      # POST /api/webhooks/evolution (idempotente, apikey-protected)
    whatsapp.py      # /api/whatsapp/* (instance/qrcode/connection/webhook setup)
    conversations.py # GET /api/conversations[, /{id}, /{id}/messages]
    leads.py         # GET /api/leads/{id}
```

## Princípios

1. **Toda rota é `async def`.** Nada de handler síncrono.
2. **Schemas explícitos.** Nunca devolver `SQLModel` diretamente; sempre converter para um Pydantic em `app/schemas/`. Evita leak de campos internos e congela o contrato.
3. **Auth admin.** Endpoints administrativos (gestão WhatsApp, leitura de leads/conversas) usam `Depends(require_admin_token)` — header `X-Admin-Token`. Token vazio em settings = 503.
4. **Idempotência em writes.** Webhooks que recebem dados externos (Evolution) usam UNIQUE no DB + `try/except IntegrityError` para tolerar redelivery.
5. **Erros não vazam interno.** `str(exc)` pode conter URLs/credenciais — log estruturado fica no logger, resposta HTTP usa mensagem genérica + classe da exceção.
6. **Paginação:** preferir cursor para coleções com inserts frequentes (ex: mensagens via `before` timestamp). Offset/limit aceitável para coleções estáveis (ex: lista de conversas).
7. **Limites:** `Query(..., ge=1, le=200)` em todo limit param. 50 default.

## Como adicionar uma rota

1. Criar arquivo `app/api/routes/<nome>.py`:
   ```python
   from fastapi import APIRouter, Depends
   from app.api.security import require_admin_token

   router = APIRouter(
       prefix="/api/<nome>",
       tags=["<nome>"],
       dependencies=[Depends(require_admin_token)],  # se admin
   )
   ```
2. Registrar em `app/main.py`: `fastapi_app.include_router(<nome>.router)`.
3. Schemas em `app/schemas/<nome>.py` (Pydantic, com `ConfigDict(from_attributes=True)` para mapping direto de SQLModel).
4. Testes em `backend/tests/api/test_<nome>.py` cobrindo: happy path, 404, auth (401), validação de query params (422), paginação.

## Endpoints atuais

| Método | Path | Auth | Resumo |
|---|---|---|---|
| GET | `/health` | não | Liveness + dependências (DB/Redis/Evolution) |
| POST | `/api/webhooks/evolution` | apikey | Recebe `messages.upsert`, `connection.update`, `qrcode.updated` |
| POST | `/api/whatsapp/instance` | admin | Cria instância no Evolution |
| GET | `/api/whatsapp/qrcode` | admin | Pega QR para parear |
| GET | `/api/whatsapp/connection` | admin | Estado da conexão Evolution |
| POST | `/api/whatsapp/webhook` | admin | Configura webhook Evolution |
| GET | `/api/conversations` | admin | Lista paginada (filtros `status`, `q`) |
| GET | `/api/conversations/{id}` | admin | Detalhe da conversa |
| GET | `/api/conversations/{id}/messages` | admin | Mensagens cursor `before` |
| GET | `/api/leads/{id}` | admin | Detalhe completo do lead |

## Não fazer

- `def` síncrono para handler.
- `return some_sqlmodel_instance` — sempre converter via Pydantic.
- Esquecer `dependencies=[Depends(require_admin_token)]` em rota admin.
- Loggar `str(exc)` para o cliente — só na resposta de erro genérica.
- Criar UNIQUE compostos sem testar redelivery do Evolution.

## Links

- `app/schemas/CLAUDE.md` — convenção dos Pydantic schemas
- `app/services/whatsapp/CLAUDE.md` — contrato Evolution
