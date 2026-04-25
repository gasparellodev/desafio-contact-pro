# app/services/vision/CLAUDE.md

> Vision (descrição de imagem para o pipeline de texto).

## Provider atual

Usa o mesmo `AIProvider` ativo (`get_ai_provider()`) — `describe_image` em OpenAI e Anthropic.

- OpenAI: `chat.completions.create` com `image_url` data URL.
- Anthropic: `messages.create` com `{type: image, source: base64}`.

## Limites

- ~4 MB de bytes brutos (~3 MB em base64). Anthropic recusa imagens maiores. OpenAI aguenta um pouco mais.
- Imagens muito grandes podem ser redimensionadas com PIL (não implementado neste PR de 6h).

## Como integra ao orchestrator

Quando `parsed.message_type == IMAGE`:
1. download base64 (já vem ou via `getBase64FromMediaMessage`)
2. `describe_image(image_bytes, mime_type, hint=parsed.text)` retorna descrição em PT
3. orchestrator alimenta `ai_input_text = "[imagem] {description}\nLegenda: {parsed.text}"`

## Não fazer

- Logar a imagem em base64 (estourar log).
- Aceitar mime fora de `image/jpeg|png|webp|gif` (Anthropic recusa outros).
- Esquecer de checar tamanho — provider rejeita mas custo de banda já foi.

## Links

- `multimodal.py` — wrapper simples
- `services/ai/{openai,anthropic}_provider.py:describe_image`
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
