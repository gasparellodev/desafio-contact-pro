# Desafio Técnico — Chatbot WhatsApp com IA para Atendimento de Leads da Contact Pro

## Contexto

A Contact Pro desenvolve soluções de comunicação, atendimento, marketing, vendas, automação e IA.

Neste desafio, você deve construir um **chatbot de WhatsApp com IA** para realizar o atendimento inicial de leads interessados nos serviços da Contact Pro.

O bot deve conversar com o lead, responder dúvidas, qualificar o interesse, registrar informações básicas e permitir que a conversa seja acompanhada em uma interface web em tempo real.

Este desafio simula uma parte real dos nossos produtos e do tipo de problema que enfrentamos no dia a dia.

---

# Prazo

O desafio deve ser entregue em até **6 horas corridas** a partir do horário combinado de início.

Exemplo:

```text
Início: 09:00
Entrega máxima: 15:00
```

Não haverá janela adicional de entrega.

O escopo é propositalmente ambicioso. Não esperamos perfeição. Esperamos ver:

* priorização;
* raciocínio técnico;
* uso inteligente de IA;
* entrega funcional;
* clareza sobre o que ficou incompleto;
* histórico de commits mostrando evolução real.

Ao final das 6 horas, envie o repositório no estado em que estiver.

---

# O que queremos avaliar

Queremos entender:

* como você estrutura um produto full stack;
* como integra WhatsApp de forma prática;
* como usa IA real em um fluxo de atendimento;
* como lida com texto e áudio;
* como implementa tempo real entre backend e frontend;
* como organiza código sob pressão;
* como usa ferramentas de IA no desenvolvimento;
* como documenta decisões e trade-offs;
* como evolui o projeto via commits.

O uso de IA no desenvolvimento é permitido e esperado.

---

# Stack e tecnologias

## Integração WhatsApp

Use **uma** das bibliotecas abaixo:

* Baileys: `https://github.com/WhiskeySockets/Baileys`
* whatsmeow: `https://github.com/tulir/whatsmeow`

Não use automação de navegador/Puppeteer para controlar WhatsApp.

## Backend

Livre escolha, mas esperamos algo adequado ao problema.

Sugestões:

* Node.js / TypeScript;
* Go;
* Python / FastAPI;
* ou outra stack que você domine.

## Frontend

Obrigatório ter frontend web.

Sugestões:

* React;
* Next.js;
* Vue;
* outro framework equivalente.

## Banco de dados

Pode usar:

* SQLite;
* PostgreSQL;
* MongoDB;
* Supabase;
* outro banco simples.

## Tempo real

Obrigatório usar:

* WebSocket;
* Socket.IO;
* ou SSE.

Polling não substitui tempo real.

## IA

Obrigatório usar integração real com um modelo de IA.

Pode usar:

* OpenAI;
* Anthropic;
* Gemini;
* Groq;
* OpenRouter;
* outro provider.

## STT / transcrição de áudio

Para áudio recebido, use STT real.

Pode usar:

* Whisper;
* Groq Whisper;
* OpenAI;
* Deepgram;
* Google Speech;
* AssemblyAI;
* outro serviço/modelo.

## TTS / resposta em áudio

Para áudio enviado, use TTS real.

Pode usar:

* OpenAI TTS;
* ElevenLabs;
* Google TTS;
* Azure TTS;
* Amazon Polly;
* outro serviço/modelo.

---

# Execução com Docker

A entrega deve conter um `docker-compose.yml`.

O avaliador deve conseguir rodar o projeto com algo próximo de:

```bash
cp .env.example .env
docker compose up --build
```

O Docker Compose deve subir, quando aplicável:

* backend;
* frontend;
* banco de dados;
* Redis/RabbitMQ, se utilizados;
* serviços auxiliares necessários.

A sessão do WhatsApp deve ser persistida em volume local, para evitar pareamento novo a cada restart.

O README deve explicar:

* como subir o projeto;
* como configurar `.env`;
* onde a sessão do WhatsApp fica armazenada;
* como resetar a sessão;
* como visualizar logs;
* qual URL acessar no navegador.

Não precisa usar Kubernetes, Nginx, TLS ou deploy em cloud.

---

# Segurança obrigatória

Não commitar:

* `.env`;
* chaves de API;
* sessão do WhatsApp;
* tokens;
* credenciais;
* arquivos sensíveis.

Obrigatório incluir:

```text
.env.example
.gitignore
```

O `.env.example` deve conter as variáveis necessárias sem valores reais.

Exemplo:

```env
AI_PROVIDER=
AI_MODEL=
AI_API_KEY=

STT_PROVIDER=
STT_API_KEY=

TTS_PROVIDER=
TTS_MODEL=
TTS_API_KEY=

DATABASE_URL=
WHATSAPP_SESSION_PATH=
```

---

# Priorização esperada

Como o prazo é de **6 horas corridas**, esperamos que você priorize.

## Prioridade 1 — obrigatório para considerar válido

Entregue primeiro:

* Docker Compose;
* conexão WhatsApp com Baileys ou whatsmeow;
* recebimento de texto;
* envio de texto como reply;
* reaction/curtida;
* IA real respondendo;
* frontend simples;
* WebSocket/SSE;
* persistência mínima;
* README;
* commits progressivos.

## Prioridade 2 — alta pontuação

Depois:

* recebimento de áudio;
* transcrição STT real;
* resposta com TTS real;
* envio de áudio no WhatsApp;
* dados do lead no frontend;
* intenção/status do lead.

## Prioridade 3 — diferencial

Se sobrar tempo:

* fila;
* retries;
* idempotência;
* RAG melhor;
* testes;
* multi-conversa;
* UI mais organizada.

Se não conseguir concluir tudo, priorize um fluxo ponta a ponta funcionando em vez de várias partes incompletas.

---

# Requisitos funcionais

## 1. Conexão com WhatsApp

O sistema deve permitir conectar uma conta de WhatsApp usando Baileys ou whatsmeow.

Deve ser possível:

* gerar QR Code ou pairing code;
* autenticar uma conta;
* manter sessão local;
* reconectar quando possível;
* receber mensagens;
* enviar mensagens.

O QR Code pode aparecer:

* no terminal;
* no frontend;
* ou em ambos.

---

## 2. Receber mensagens de texto

Ao receber uma mensagem de texto no WhatsApp, o sistema deve:

1. salvar a mensagem recebida;
2. exibir a mensagem no frontend em tempo real;
3. reagir à mensagem recebida;
4. enviar a mensagem para o fluxo de IA;
5. classificar intenção;
6. atualizar dados do lead;
7. gerar resposta;
8. enviar resposta no WhatsApp;
9. atualizar o frontend com a resposta.

---

## 3. Receber mensagens de áudio

Ao receber uma mensagem de áudio no WhatsApp, o sistema deve:

1. identificar que a mensagem é áudio;
2. baixar a mídia;
3. transcrever o áudio usando STT real;
4. salvar a transcrição;
5. exibir no frontend:

   * que a mensagem original era áudio;
   * a transcrição;
6. usar a transcrição como entrada para a IA;
7. gerar resposta.

---

## 4. Enviar resposta em texto

O bot deve conseguir enviar respostas em texto.

Obrigatório:

* enviar mensagem de texto pelo WhatsApp;
* responder como **reply** à mensagem original sempre que possível;
* salvar a resposta no histórico;
* emitir evento para o frontend.

---

## 5. Enviar resposta em áudio

O bot deve conseguir enviar áudio gerado por TTS.

Regra mínima:

* se o lead enviar áudio, o bot deve responder com áudio;
* se o lead enviar texto, pode responder em texto.

Fluxo esperado:

1. IA gera resposta em texto;
2. TTS gera áudio;
3. bot envia áudio pelo WhatsApp;
4. sistema salva:

   * texto da resposta;
   * metadados do áudio;
   * status de envio.

---

## 6. Reagir / curtir mensagem

O bot deve reagir a mensagens recebidas.

Exemplos:

* 👍 para mensagem recebida com sucesso;
* ✅ para lead qualificado;
* 👌 para opt-out;
* ⚠️ em caso de erro, se fizer sentido.

O objetivo é demonstrar domínio além de “enviar texto”.

---

# Frontend obrigatório

Criar uma interface web simples para acompanhar o atendimento.

A interface deve mostrar:

* status da conexão com WhatsApp;
* QR Code ou instrução de pareamento;
* lista de conversas ou conversa ativa;
* histórico de mensagens;
* mensagens recebidas e enviadas;
* distinção visual entre usuário e bot;
* indicação de texto ou áudio;
* transcrição de áudio recebido;
* status “IA pensando”;
* dados extraídos do lead;
* intenção detectada;
* status do lead.

Não precisa ser visualmente refinado.
Precisa ser funcional e claro.

---

# Tempo real entre backend e frontend

O frontend deve ser atualizado em tempo real usando WebSocket, Socket.IO ou SSE.

Eventos sugeridos:

```text
wa.connection.update
wa.message.received
wa.audio.received
audio.transcribed
ai.thinking
ai.response.generated
wa.message.sent
wa.audio.sent
wa.reaction.sent
lead.updated
conversation.status_changed
error
```

Não é obrigatório usar exatamente esses nomes, mas o fluxo de tempo real deve existir.

---

# Base de conhecimento da Contact Pro

O bot deve conhecer minimamente os serviços da Contact Pro. Não precisa necessariamente seguir preços ou qualquer coisa do gênero, não é isso que estamos avaliando.

Use como referência:

```text
https://www.contactpro.com.br
```

Você pode estruturar a base como:

* `knowledge-base.md`;
* JSON;
* seed no banco;
* prompt estruturado;
* RAG simples;
* ou outra abordagem documentada.

Não é obrigatório implementar crawler.
Pode montar uma base manual mínima.

## Serviços que o bot deve conhecer

### Contact Z

Plataforma relacionada a atendimento, automação e campanhas via WhatsApp, com uso de IA e canais digitais.

### Contact Tel

Plataforma de agentes de voz/URA reversa, capaz de fazer e receber ligações, automatizar abordagens, registrar interações e apoiar operações comerciais, cobrança, pesquisa ou atendimento.

### Captação / fornecimento de mailings

Serviço para fornecimento de listas segmentadas de contatos para campanhas, vendas, marketing, cobrança ou pesquisa.

### Enriquecimento e higienização de dados

Serviço para melhorar, atualizar, enriquecer ou validar bases de contatos existentes.

### Atendimento e vendas com IA

Soluções de agentes inteligentes para atendimento, qualificação, automação comercial e integração com canais de comunicação.

---

# Comportamento esperado do chatbot

O bot deve atuar como **assistente comercial da Contact Pro**.

Ele deve:

* responder de forma objetiva, cordial e profissional;
* explicar serviços da Contact Pro;
* identificar qual solução faz mais sentido para o lead;
* fazer perguntas de qualificação;
* capturar dados básicos;
* não inventar preços;
* quando perguntarem preço, qualificar antes;
* quando faltar informação, perguntar;
* quando o lead pedir atendimento humano, marcar como `needs_human`;
* quando o lead demonstrar desinteresse, marcar como `opt_out`;
* quando o lead demonstrar fit comercial, marcar como `qualified`.

---

# Intenções obrigatórias

O sistema deve classificar a intenção da conversa ou da mensagem em uma das categorias:

```text
contact_z
contact_tel
mailing
data_enrichment
pricing
human_handoff
opt_out
support
general_question
```

A intenção deve ser:

* salva no banco;
* exibida no frontend;
* usada para atualizar o status do lead.

---

# Qualificação do lead

O bot deve tentar extrair e salvar os seguintes dados:

```json
{
  "name": "string | null",
  "company": "string | null",
  "phone": "string | null",
  "service_interest": "contact_z | contact_tel | mailing | data_enrichment | unknown",
  "lead_goal": "string | null",
  "estimated_volume": "string | null",
  "status": "new | qualified | needs_human | opt_out"
}
```

Exemplos de perguntas úteis:

```text
Você pretende automatizar atendimento via WhatsApp, fazer ligações automáticas, contratar mailing ou enriquecer uma base que já possui?

Você já tem uma base de contatos ou precisa que a Contact Pro forneça os dados?

Qual é o volume aproximado da sua campanha ou operação?

Você representa uma empresa? Qual segmento?

O atendimento seria para vendas, suporte, cobrança ou pesquisa?
```

---

# Persistência

Salvar minimamente:

* leads;
* conversas;
* mensagens recebidas;
* mensagens enviadas;
* tipo da mensagem:

  * texto;
  * áudio;
* transcrição de áudio;
* resposta textual gerada pela IA;
* intenção;
* status do lead;
* timestamps;
* IDs do WhatsApp, quando disponíveis;
* status de envio.

O histórico deve continuar disponível ao recarregar a página.

---

# Histórico de commits

O repositório deve ter commits reais mostrando evolução.

Esperado:

```text
8 a 15 commits pequenos/médios
```

Exemplos bons:

```text
chore: setup project structure
chore: add docker compose and env example
feat: add whatsapp connection
feat: receive whatsapp text messages
feat: persist leads and messages
feat: add realtime frontend inbox
feat: integrate llm response generation
feat: add contact pro knowledge base
feat: add audio transcription flow
feat: add tts audio reply
feat: add whatsapp reply and reaction support
docs: add setup instructions and ai usage report
```

Evite:

```text
initial commit
final
update
fix
all project
```

Commit único com tudo pronto pesa contra.

O uso de IA é permitido, mas queremos ver evolução de raciocínio e implementação.

---

# Uso de IA no desenvolvimento

O uso de IA é permitido e esperado.

Queremos avaliar **como** você usa IA, não se você usa.

O README deve conter obrigatoriamente uma seção:

```md
## AI Usage Report

### Ferramentas usadas
Ex: Claude, ChatGPT, Cursor, Codex, Copilot etc.

### Onde usei IA
Ex: estrutura inicial, integração WhatsApp, frontend, prompt, TTS/STT, Docker, documentação.

### Onde revisei manualmente
Ex: arquitetura, segurança, persistência, tratamento de erros, sessão WhatsApp, prompt e chamadas de API.

### Uma sugestão da IA que rejeitei ou alterei
Explique brevemente.

### Como validei a entrega
Explique como testou manualmente ou com testes automatizados.

### Tempo aproximado de execução
Informe o tempo real aproximado gasto.
```

---

# README obrigatório

O README deve conter:

* visão geral do projeto;
* stack escolhida;
* como rodar com Docker;
* como configurar `.env`;
* como conectar o WhatsApp;
* onde a sessão é armazenada;
* como resetar sessão;
* como testar texto;
* como testar áudio;
* provider/modelo de IA usado;
* provider de STT usado;
* provider de TTS usado;
* arquitetura geral;
* decisões e trade-offs;
* limitações conhecidas;
* o que faria com mais tempo;
* AI Usage Report.

---

# Entrega

Ao final das 6 horas corridas, enviar:

* link do repositório GitHub;
* instruções para rodar;
* `.env.example`;
* observações relevantes;
* lista clara do que ficou completo;
* lista clara do que ficou incompleto;
* prints ou vídeo curto opcional.

---

# O que é obrigatório para considerar válido

Para não ser eliminado tecnicamente, o projeto precisa demonstrar:

* conexão WhatsApp com Baileys ou whatsmeow;
* recebimento de texto;
* envio de texto;
* envio como reply;
* reaction/curtida;
* frontend funcional;
* WebSocket/SSE;
* IA real respondendo;
* persistência mínima;
* Docker Compose;
* README;
* commits progressivos.

---

# O que diferencia uma entrega forte

Entrega forte inclui:

* recebimento real de áudio;
* transcrição real com STT;
* resposta em áudio com TTS;
* qualificação de lead funcional;
* base Contact Pro bem estruturada;
* intenção/status visíveis no frontend;
* bom tratamento de erros;
* sessão WhatsApp bem documentada;
* código simples, legível e modular;
* uso honesto e maduro de IA no desenvolvimento.

---

# O que pode ficar incompleto, desde que documentado

Por ser um desafio de 6 horas, aceitamos limitações documentadas, por exemplo:

* frontend simples;
* design básico;
* apenas uma conversa ativa;
* STT/TTS parcialmente integrado;
* persistência simplificada;
* ausência de autenticação;
* ausência de testes automatizados;
* fila assíncrona não implementada;
* RAG substituído por knowledge base estática;
* multi-conversa incompleto.

Mas o candidato deve explicar claramente o que ficou incompleto e como evoluiria.