# Desafio Contact Pro — Chatbot WhatsApp + IA

Chatbot de WhatsApp com IA para atendimento inicial de leads da **Contact Pro**, com frontend web em tempo real, suporte a texto, áudio e imagem, qualificação automática e classificação de intenção.

> Spec original do desafio: [`desafio-tecnico.md`](./desafio-tecnico.md).
> Diário de desenvolvimento: [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md).
> Convenções para agentes: [`CLAUDE.md`](./CLAUDE.md).

## Visão geral

O sistema:
1. Recebe mensagens (texto, áudio, imagem) de leads via WhatsApp através da **Evolution API**.
2. Persiste no PostgreSQL e emite eventos em tempo real via Socket.IO para o frontend.
3. Transcreve áudio com OpenAI Whisper e descreve imagens com modelos multimodais.
4. Classifica intenção e gera resposta via OpenAI ou Anthropic (provider configurável por env).
5. Atualiza dados do lead (nome, empresa, interesse, status) automaticamente.
6. Responde em texto ou áudio (TTS) e adiciona reactions inteligentes.

## Stack

- **Backend:** Python 3.12 + FastAPI + Socket.IO (python-socketio ASGI)
- **Frontend:** Vite + React 19 + Tailwind v4 + shadcn/ui
- **WhatsApp:** Evolution API v2.3.7 (Baileys 7.x internamente)
- **Banco:** PostgreSQL 16 + SQLModel + Alembic + asyncpg
- **Cache:** Redis 7
- **AI:** OpenAI (gpt-4o-mini, whisper-1, gpt-4o-mini-tts) e Anthropic (Claude Sonnet 4.6)
- **Containers:** Docker Compose (5 serviços)

## Como rodar

> _Seção completa será preenchida no PR final. Resumo abaixo._

```bash
# 1. Clone
git clone https://github.com/<your-user>/desafio-contact-pro.git
cd desafio-contact-pro

# 2. Configurar env
cp .env.example .env
# Preencha OPENAI_API_KEY (e ANTHROPIC_API_KEY se for usar provider switch)

# 3. Subir tudo
docker compose up --build

# 4. Acessar
open http://localhost:5173   # Frontend
open http://localhost:8000/docs   # Swagger da API
```

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Convenções e ponto de entrada para agentes |
| [`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md) | Diário cronológico (decisões, dificuldades, trade-offs) |
| [`docs/architecture.md`](./docs/architecture.md) | Diagrama, fluxos, decisões arquiteturais (TBD no PR final) |
| [`docs/usage.md`](./docs/usage.md) | Como testar texto, áudio, imagem (TBD no PR final) |
| [`docs/decisions.md`](./docs/decisions.md) | ADRs leves (TBD no PR final) |
| [`backend/CLAUDE.md`](./backend/CLAUDE.md) | Regras do backend |
| [`frontend/CLAUDE.md`](./frontend/CLAUDE.md) | Regras do frontend |

---

## Conexão WhatsApp

_TBD no PR final: como gerar QR Code, parear, onde a sessão é armazenada (volume `evolution_instances`), como resetar._

## Como testar

_TBD no PR final: roteiro manual para texto, áudio, imagem e provider switch._

## Provider de IA

_TBD: documentar provider/modelo ativo, como trocar entre OpenAI e Anthropic via `AI_PROVIDER`._

## Provider de STT / TTS

_TBD: OpenAI `whisper-1` + `gpt-4o-mini-tts` (response_format=opus). Justificativa de escolha._

## Arquitetura

_TBD: diagrama, pipeline do `ConversationOrchestrator`, eventos Socket.IO._

## Decisões e trade-offs

_TBD: links para `docs/decisions.md`._

## Limitações conhecidas

_TBD: sem auth, instância única, sem fila assíncrona, KB estática, sem testes completos._

## O que faria com mais tempo

_TBD: RAG com embeddings, multi-instância, fila Celery, testes E2E, observabilidade._

---

## AI Usage Report

> Esta seção é obrigatória pelo desafio. Será preenchida no PR final consolidando o `DEVELOPMENT_LOG.md`.

### Ferramentas usadas
_TBD_

### Onde usei IA
_TBD_

### Onde revisei manualmente
_TBD_

### Uma sugestão da IA que rejeitei ou alterei
_TBD_

### Como validei a entrega
_TBD_

### Tempo aproximado de execução
_TBD_

---

## Status do desafio

- [x] Setup do repositório
- [ ] Conexão WhatsApp (Evolution + Baileys)
- [ ] Recebimento de texto
- [ ] Envio de texto (com reply)
- [ ] Reaction / curtida
- [ ] IA real respondendo
- [ ] Frontend funcional
- [ ] Tempo real (Socket.IO)
- [ ] Persistência mínima
- [ ] Docker Compose
- [ ] Recebimento de áudio + STT
- [ ] Resposta em áudio (TTS)
- [ ] Imagens (vision)
- [ ] Qualificação de lead + intenção visíveis
- [ ] Reactions inteligentes
- [ ] Documentação final
