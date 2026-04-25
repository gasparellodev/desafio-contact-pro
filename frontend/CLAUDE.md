# frontend/CLAUDE.md

> Regras do frontend React. Leia antes de qualquer alteração aqui.

## Propósito

Inbox web em tempo real para acompanhar conversas do chatbot WhatsApp. Lista de conversas, histórico de mensagens (texto/áudio/imagem com transcrição inline), painel do lead (campos extraídos + intenção + status), QR Code para pareamento.

## Stack

- Vite 8 + React 19.2 + TypeScript 6 (strict)
- Tailwind v4 via `@tailwindcss/vite` (sem postcss.config.js)
- shadcn/ui (style new-york, base color neutral, OKLCH tokens)
- socket.io-client 4.x (compatível com python-socketio 5.x)
- lucide-react para ícones
- Path alias `@/*` → `src/*`

## Princípios não-negociáveis

1. **shadcn-only para UI primitives.** Nunca crie um `<button>` cru, sempre `Button`. Mesma regra para Card, Badge, ScrollArea, etc. Se faltar primitive, copie do shadcn registry para `src/components/ui/`.
2. **Strict TypeScript.** Sem `any`, sem `@ts-ignore`. Tipos compartilhados de eventos Socket.IO em `src/types/`.
3. **Singleton do Socket.IO.** Cliente vive **fora de qualquer componente** (em `src/lib/socket.ts`) com `autoConnect: false`. Hooks chamam `socket.connect()` no mount e `socket.disconnect()` no cleanup do `useEffect`. Sem isso, StrictMode duplica conexão em dev.
4. **API sem fetch dentro de componente.** Use hooks (`useConversations`, `useLead`, etc.) em `src/hooks/`. Componente só consome estado.
5. **Acessibilidade básica.** `aria-*` em botões só com ícone, `role="status"` no indicador "IA pensando".

## Estrutura

```
src/
  main.tsx
  App.tsx
  components/
    ui/                    # shadcn primitives (button, card, badge, scroll-area, separator, avatar)
    chat/                  # ConversationList, MessageList, MessageBubble, AudioMessage, ImageMessage, AIThinkingIndicator
    lead/                  # LeadPanel
    connection/            # QRCodePanel, ConnectionStatus
  hooks/
    useSocket.ts
    useConversations.ts
    useConnectionStatus.ts
  lib/
    api.ts                 # wrapper fetch para REST
    socket.ts              # singleton Socket.IO
    utils.ts               # cn()
  types/                   # tipos compartilhados (Message, Lead, eventos socket)
  index.css                # @import tailwindcss + theme tokens (OKLCH)
```

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173 (host: true para Docker)
npm run build      # tsc -b && vite build
npm run preview    # serve a build em :5173
npm run lint       # eslint
```

## Como adicionar um componente shadcn novo

1. `npx shadcn@latest add <componente>` (preferido)
2. ou copiar de https://ui.shadcn.com/docs/components/<componente> para `src/components/ui/<componente>.tsx`
3. Sempre revisar imports (`cn` de `@/lib/utils`)

## Como adicionar um event listener Socket.IO

1. Tipar o evento em `src/types/socket.ts` (se ainda não estiver)
2. No hook (`useConversations`, etc.), usar:
   ```ts
   useEffect(() => {
     const handler = (data: T) => setState(...)
     socket.on('event.name', handler)
     return () => { socket.off('event.name', handler) }
   }, [])
   ```
3. Nunca `.on()` sem `.off()` — vaza memória e dispara handler N vezes em StrictMode.

## Tailwind v4 vs v3

- **NÃO** existe `postcss.config.js` neste projeto.
- `tailwind.config.ts` **não** é usado — toda config vai para `@theme inline { ... }` no `src/index.css`.
- Plugin oficial: `@tailwindcss/vite` no `vite.config.ts`.
- Tokens em **OKLCH**, não HSL (decisão dos defaults v4 do shadcn).

## Não fazer

- Importar componente shadcn de `node_modules` — a cópia local em `src/components/ui/` é o source of truth.
- Usar `useEffect` com array de deps vazio para fazer fetch dentro do componente — extraia para hook.
- Tocar em `src/index.css` para customizar tema fora de `@theme inline` (vira inconsistente).
- Adicionar Storybook, react-query, redux ou outro framework heavy — fora do escopo do desafio.

## Links

- `src/lib/socket.ts` — singleton (a ser criado no PR #7)
- `src/hooks/useConversations.ts` — estado da inbox (a ser criado no PR #10)
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
