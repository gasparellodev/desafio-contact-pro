# app/services/ai/CLAUDE.md

> Contrato dos providers de IA. Leia antes de adicionar/alterar.

## Princípios

1. **Output sempre estruturado.** O orchestrator depende de `AIResponse{reply, intent, lead_extracted, status_suggestion}`. Cada provider faz o que for preciso para garantir esse shape.
2. **OpenAI**: `client.chat.completions.parse(response_format=AIResponse)`. Não usar `response_format={type: json_schema, ...}` cru (mais frágil em 2026).
3. **Anthropic**: `tool_choice={"type":"tool","name":"emit_response"}` forçado, com `input_schema` explícito (espelha o `AIResponse`). System prompt em **block list** com `cache_control: ephemeral` para reduzir custo do KB Contact Pro em ~90% após a 1ª chamada.
4. **Não usar `extended_thinking`** no Anthropic provider — incompatível com tool_choice forçado.
5. **Vision** vive no mesmo provider (mesma API key); orchestrator descreve a imagem em texto e alimenta o pipeline de conversa.

## Como adicionar um novo provider (Gemini, Groq, OpenRouter)

1. Criar arquivo `app/services/ai/<nome>_provider.py`.
2. Implementar a interface `AIProvider` (Protocol em `base.py`): `name`, `model`, `generate_response`, `describe_image`.
3. Adicionar branch no `factory.py`.
4. Adicionar option em `core/config.py:Settings.ai_provider`.
5. Smoke test ambos os métodos com chave real e marcar no DEVELOPMENT_LOG.

## Provider switch

```env
AI_PROVIDER=openai            # ou anthropic
AI_MODEL=gpt-4o-mini          # ou claude-sonnet-4-6
AI_API_KEY=...                # fallback
OPENAI_API_KEY=...            # explícito (também usado por STT/TTS/vision)
ANTHROPIC_API_KEY=...         # explícito
```

`active_ai_api_key` em `Settings` resolve a chave certa: prefere a explícita do provider, cai para `AI_API_KEY` como fallback.

## Não fazer

- Importar `OpenAIProvider`/`AnthropicProvider` direto em outros módulos — use `get_ai_provider()`.
- Inserir `temperature=0` no provider Anthropic — devolve respostas robóticas. Default `0.4`.
- Modificar `EMIT_TOOL_SCHEMA` sem refletir em `AIResponse` (test break imediato).
- Usar `print` para logar respostas — `logger.info({...})` estruturado.
- Hard-code de prompt em outro lugar — único lugar é `prompts.py:build_system_prompt`.

## Links

- `base.py` — Protocol + `AIResponse` (contrato)
- `prompts.py:build_system_prompt` — concat de regras + KB
- `app/knowledge_base/contact_pro.md` — KB
- `factory.py` — switch
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
