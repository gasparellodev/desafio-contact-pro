# frontend/src/components/CLAUDE.md

> Convenção de componentes. Leia antes de adicionar.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `ui/` | Primitives shadcn (button, card, badge, scroll-area, separator, avatar). |
| `chat/` | ConversationList, MessageList, MessageBubble, AIThinkingIndicator, AudioMessage, ImageMessage. |
| `lead/` | LeadPanel. |
| `connection/` | QRCodePanel, ConnectionStatus. |

## Regras

1. **Props 100% tipadas.** Sem `any`. Domínio em `src/types/domain.ts`.
2. **Componentes puros.** Renderizam props; estado e chamadas vêm de hooks (`useConversations`, `useConnectionStatus`).
3. **shadcn obrigatório para primitives.** Nunca renderizar `<button>` cru, sempre `<Button>`. Mesma regra para Card/Badge/etc.
4. **Acessibilidade básica.** `aria-label` em ícones, `role="status"` no AIThinkingIndicator, alt text em imagens.
5. **Sem CSS solto.** Tudo via classes Tailwind v4 + tokens OKLCH do shadcn.
6. **Naming**: PascalCase para componentes. `SomeComponent.tsx` exporta `SomeComponent` nomeado (sem default).

## Não fazer

- Importar de `node_modules/@shadcn/ui` (não existe — copiamos para `src/components/ui/`).
- Misturar lógica de fetch/socket dentro do componente.
- Estilizar com `style={{}}` quando dá para usar classe Tailwind.
- Esquecer key estável em listas (use `id` da entidade, nunca índice quando há add/remove).

## Links

- `chat/MessageBubble.tsx` — render de mensagem (TEXT/AUDIO com transcrição inline/IMAGE)
- `chat/MessageList.tsx` — auto scroll
- `lead/LeadPanel.tsx` — campos extraídos
- `connection/QRCodePanel.tsx` — bootstrap da instância e QR
