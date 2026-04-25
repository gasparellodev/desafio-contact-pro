# frontend/src/components/CLAUDE.md

> Convenção de componentes. Leia antes de adicionar.

## Pastas

| Pasta | Conteúdo |
|---|---|
| `ui/` | Primitives shadcn (button, card, badge, scroll-area, separator, avatar, **sheet**). |
| `chat/` | ConversationList, MessageList, MessageBubble, AIThinkingIndicator, **ConversationHeader** (badge PAUSADO + botão Retomar), **ManualMessageInput** (envio humano quando paused). |
| `lead/` | LeadPanel, **LeadSheet** (wrapper Sheet pra mobile/tablet). |
| `connection/` | QRCodePanel. |

## Regras

1. **Props 100% tipadas.** Sem `any`. Domínio em `src/types/domain.ts`.
2. **Componentes puros.** Renderizam props; estado e chamadas vêm de hooks (`useConversationsQuery`, `useLead`, `useConnectionStatus`, `useSocketContext`).
3. **shadcn obrigatório para primitives.** Nunca renderizar `<button>` cru, sempre `<Button>`. Mesma regra para Card/Badge/Sheet/etc. **Importar de `@/components/ui/<nome>`**, nunca de `@radix-ui/*` direto fora desse diretório.
4. **Responsividade**: layout padrão é mobile-first; usar breakpoints Tailwind `sm:` (≥640px), `md:` (≥768px), `lg:` (≥1024px). Para painéis que viram drawer em mobile, criar wrapper `XSheet` em vez de duplicar conteúdo.
5. **Acessibilidade obrigatória** (Phase 3+):
   - `aria-label` em botões só com ícone (ex: voltar, abrir Sheet).
   - `role="log"` + `aria-live="polite"` em listas de mensagens.
   - `aria-current="true"` no item de lista selecionado.
   - `role="list"` + `<li>` em listas semânticas onde fizer sentido.
   - Foco gerenciado: ao abrir Sheet o foco vai pro primeiro foco; ao fechar, volta ao trigger (Radix faz automaticamente).
6. **Sem CSS solto.** Tudo via classes Tailwind v4 + tokens OKLCH em `index.css`. Status do lead usa `bg-status-{new|qualified|needs-human|opt-out}`.
7. **Animação**: classes nomeadas em `index.css` (`animate-message-enter`, `animate-status-pulse`). Evitar Motion lib pra não inflar bundle; CSS é suficiente.
8. **Naming**: PascalCase para componentes. `SomeComponent.tsx` exporta `SomeComponent` nomeado (sem default). Testes co-located: `SomeComponent.test.tsx`.

## Não fazer

- Importar de `node_modules/@shadcn/ui` (não existe — copiamos para `src/components/ui/`).
- Importar `@radix-ui/react-*` direto fora de `src/components/ui/` — sempre via primitive shadcn local.
- Misturar lógica de fetch/socket dentro do componente. Use hooks ou consuma do `SocketProvider`.
- Estilizar com `style={{}}` quando dá para usar classe Tailwind.
- Esquecer key estável em listas (use `id` da entidade, nunca índice quando há add/remove).
- Esquecer `aria-label` em botão só com ícone — leitor de tela fica mudo.
- Substituir `MessageList` scroll por `scrollIntoView` — usar `viewport.scrollTop = scrollHeight` (Radix ScrollArea expõe via `[data-slot="scroll-area-viewport"]`).
- Fazer fetch sem AbortController em componente que pode desmontar — vide `QRCodePanel.tsx`.

## Links

- `chat/MessageBubble.tsx` — render de mensagem (TEXT/AUDIO com transcrição inline/IMAGE) + `animate-message-enter`
- `chat/MessageList.tsx` — auto scroll via Radix ScrollArea viewport
- `lead/LeadPanel.tsx` — campos extraídos do lead
- `lead/LeadSheet.tsx` — wrapper Sheet com Lead+QR pra mobile/tablet
- `connection/QRCodePanel.tsx` — bootstrap da instância (com AbortController) + QR responsivo
