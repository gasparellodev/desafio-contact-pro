# Como usar / testar

## Pré-requisitos

- Docker 24+ e Docker Compose v2
- Chave OpenAI (`OPENAI_API_KEY`) — obrigatória para STT/TTS/vision e quando `AI_PROVIDER=openai`
- (opcional) Chave Anthropic (`ANTHROPIC_API_KEY`) — quando `AI_PROVIDER=anthropic`
- Celular com WhatsApp para parear

## Subir o stack

```bash
cp .env.example .env
# preencha as chaves (mínimo OPENAI_API_KEY e EVOLUTION_API_KEY)
docker compose up --build
```

Aguarde até ver os healthchecks passarem (~30s):

```bash
curl http://localhost:8000/health
# {"status":"ok","db":"ok","redis":"ok","evolution":"ok"}
```

## Conectar WhatsApp

1. Abra <http://localhost:5173>.
2. No painel direito, clique em **Inicializar instância**.
3. Aguarde ~5s. O QR Code aparece.
4. WhatsApp → Aparelhos conectados → Conectar um aparelho → escaneie.
5. Badge do header muda de `connecting` → `open`.

## Testar texto

1. Envie qualquer mensagem do seu celular para o número pareado.
2. **<1s**: aparece na inbox.
3. Reaction 👍 aparece na mensagem original.
4. "IA pensando…" aparece no chat.
5. Resposta volta no WhatsApp como **reply** (citação). Aparece no chat também.
6. Painel "Lead" atualiza com nome (se mencionado) e intenção.

### Exemplos de conversa

- "Olá, queria automatizar o atendimento da minha empresa pelo WhatsApp" → intenção `contact_z`, status pode subir a `qualified` se completar com volume/empresa.
- "Quanto custa?" → IA não inventa preço; pergunta volume/segmento.
- "Não tenho interesse, obrigado" → status `opt_out`, reaction final 👌.
- "Preciso falar com humano" → status `needs_human`, reaction final 🤝.

## Testar áudio

1. Envie um áudio (PTT, segurar microfone).
2. Bubble exibe `🎙️ Áudio (transcrevendo...)`.
3. Em ~2-3s, a transcrição aparece **inline** abaixo do bubble.
4. Bot responde **em áudio** (PTT) e a transcrição da resposta também é exibida.
5. Se TTS falhar, há fallback automático para texto (status `failed` + `error_reason` registrados).

## Testar imagem

1. Envie uma foto (com ou sem legenda).
2. Bubble exibe `🖼️ Imagem`.
3. Descrição via vision (gpt-4o-mini ou Claude) aparece inline.
4. Bot responde considerando a descrição + legenda.

## Trocar de provider de IA

Edite `.env`:

```env
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=sk-ant-...
```

Reinicie só o backend:

```bash
docker compose restart backend
```

A próxima mensagem usa o Claude. As mensagens existentes mantêm o que foi gerado pelo provider anterior.

## Persistência e reload

- Refresh do navegador mantém todo o histórico (carregado do Postgres pelo backend nas próximas iterações; estado em memória re-hidrata via Socket.IO eventos novos).
- `docker compose down && docker compose up` mantém: pareamento WhatsApp (volume `evolution_instances`), banco (volume `postgres_data`), conta Evolution (Postgres schema `evolution_api`).

## Resetar a sessão WhatsApp

```bash
docker compose down
docker volume rm desafio-contact-pro_evolution_instances
docker compose up
```

Depois clique novamente em **Inicializar instância** na UI.

## Resetar tudo

```bash
docker compose down -v   # remove TODOS os volumes (perde sessão e banco)
docker compose up --build
```

## Ver logs

```bash
docker compose logs -f backend
docker compose logs -f evolution
docker compose logs -f frontend
```

Backend usa logger JSON estruturado — filtre por `event` se quiser:

```bash
docker compose logs backend | grep webhook_received
```

## Health-check e Swagger

- Health-check: `curl http://localhost:8000/health`
- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>
- OpenAPI JSON: <http://localhost:8000/openapi.json>
