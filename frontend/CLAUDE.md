# frontend/CLAUDE.md

> Regras do frontend React. Leia antes de qualquer alteração aqui.

## Propósito

Inbox web em tempo real para acompanhar conversas do chatbot WhatsApp. Lista de conversas, histórico de mensagens (texto/áudio/imagem com transcrição inline), painel do lead (campos extraídos + intenção + status), QR Code para pareamento.

## Stack

- Vite 8 + React 19.2 + TypeScript 6 (strict)
- Tailwind v4 via `@tailwindcss/vite` (sem postcss.config.js)
- shadcn/ui (style new-york, base color neutral, OKLCH tokens)
- socket.io-client 4.x (compatível com python-socketio 5.x)
- React Router 7 — URL é fonte da verdade do `activeId` (deep-linkable, sobrevive a reload)
- TanStack Query 5 — cache de REST + merge de deltas Socket.IO via `queryClient.setQueryData()`
- lucide-react para ícones
- Vitest 2 + Testing Library 16 + jsdom 25 para unit/component tests
- axe-core para checagens a11y em testes
- Path alias `@/*` → `src/*`

## Princípios não-negociáveis

1. **shadcn-only para UI primitives.** Nunca crie um `<button>` cru, sempre `Button`. Mesma regra para Card, Badge, ScrollArea, etc. Se faltar primitive, copie do shadcn registry para `src/components/ui/`.
2. **Strict TypeScript.** Sem `any`, sem `@ts-ignore`. Tipos compartilhados de eventos Socket.IO e schemas REST em `src/types/`.
3. **Singleton do Socket.IO.** Cliente vive **fora de qualquer componente** (em `src/lib/socket.ts`) com `autoConnect: false`. Apenas o `SocketProvider` chama `socket.connect()` (no mount). Componentes/hooks consomem estado via `useSocketContext()` ou via cache TanStack Query.
4. **TanStack Query é a fonte da verdade dos dados de servidor.** `fetch` direto em componente é proibido. Hooks de domínio (`useConversationsQuery`, `useConversationMessages`, `useLead`) usam `useQuery`; eventos Socket.IO chamam `queryClient.setQueryData(...)` para mesclar deltas (no `SocketProvider`, não nos hooks).
5. **URL é a fonte da verdade do `activeId`.** A rota `/conversations/:id` reflete a conversa aberta. Reload preserva. Navegação via `useNavigate()`, leitura via `useParams()`.
6. **Acessibilidade.** `aria-*` em botões só com ícone, `role="status"` em indicadores temporários, foco gerenciado em rotas. Phase 4 vai validar com `axe-core` em testes (zero violations).

## Estrutura

```
src/
  main.tsx                      # entry: StrictMode > QueryProvider > SocketProvider > RouterProvider
  components/
    ui/                         # shadcn primitives (button, card, badge, scroll-area, separator, avatar)
    chat/                       # ConversationList, MessageList, MessageBubble, AudioMessage, ImageMessage, AIThinkingIndicator
    lead/                       # LeadPanel
    connection/                 # QRCodePanel, ConnectionStatus
  hooks/
    useConnectionStatus.ts      # merge query+context — {state, qrcode, isLoading}
    useWhatsAppConnection.ts    # useQuery(/api/whatsapp/connection) com polling 60s
    useConversationsQuery.ts    # useQuery(['conversations', 'list', filters])
    useConversationMessages.ts  # useQuery(['conversations', 'detail', id, 'messages'])
    useLead.ts                  # useQuery(['leads', 'detail', id])
  providers/
    QueryProvider.tsx           # QueryClientProvider (devtools lazy só em DEV)
    SocketProvider.tsx          # singleton socket + handlers escrevem em queryClient
    socket-context.ts           # Context + useSocketContext() (separado para react-refresh)
  lib/
    api.ts                      # fetch wrapper + typed fetchers (fetchConversations, etc.)
    queryKeys.ts                # factory de query keys do TanStack
    query-client.ts             # makeQueryClient() (defaults: staleTime 60s, retry 1)
    socket.ts                   # singleton Socket.IO (autoConnect: false)
    utils.ts                    # cn()
  routes/
    index.tsx                   # createBrowserRouter + React.lazy code-splitting + Suspense fallback
    root.tsx                    # layout shell (header sticky + sistema-pulse + Outlet)
    conversations.tsx           # rota /conversations(/:id) — lista responsiva + skeleton
    conversation.tsx            # ConversationView (centro + lead) reusada em /:id
    not-found.tsx               # 404
  test/
    setup.ts                    # jest-dom + cleanup
    test-utils.tsx              # renderWithProviders + makeTestQueryClient + runAxe (axe-core wrapper)
  types/                        # tipos compartilhados (Message, Lead, eventos socket, REST envelopes)
  index.css                     # @import tailwindcss + theme tokens (OKLCH)
```

## Comandos

```bash
npm install
npm run dev            # http://localhost:5173 (host: true para Docker)
npm run build          # tsc -b && vite build
npm run preview        # serve a build em :5173
npm run lint           # eslint
npm run typecheck      # tsc -b --noEmit (não gera bundle)
npm run test           # vitest run (uma vez)
npm run test:watch     # vitest interativo
npm run test:ui        # @vitest/ui no browser
npm run test:coverage  # vitest run --coverage (relatório v8)
```

## Como adicionar um componente shadcn novo

1. `npx shadcn@latest add <componente>` (preferido)
2. ou copiar de https://ui.shadcn.com/docs/components/<componente> para `src/components/ui/<componente>.tsx`
3. Sempre revisar imports (`cn` de `@/lib/utils`)

## Como adicionar um event listener Socket.IO

1. Tipar o evento em `src/types/socket.ts` (se ainda não estiver).
2. **Não** crie um novo `.on(...)` em hook ou componente. Adicione o handler dentro do `SocketProvider` em `src/providers/SocketProvider.tsx`:
   - Se o evento atualiza dados de servidor, chame `queryClient.setQueryData(...)` ou `queryClient.invalidateQueries(...)` com a query key apropriada de `lib/queryKeys.ts`.
   - Se for estado efêmero da UI (ex: indicador "IA pensando"), atualize o `useState` interno do provider e exponha via `useSocketContext()`.
3. Adicione o `.off(handler)` correspondente no cleanup do mesmo `useEffect`. Nunca `.on()` sem `.off()` — vaza memória e duplica handler em StrictMode.

## Como adicionar um endpoint REST

1. Adicionar typed fetcher em `src/lib/api.ts` (`fetchFoo(...)`).
2. Adicionar key factory em `src/lib/queryKeys.ts` (`fooKeys.detail(id)`).
3. Criar hook em `src/hooks/useFoo.ts` que chama `useQuery({ queryKey, queryFn })`.
4. Atualizar tipos em `src/types/domain.ts` (response payload).
5. Co-locar teste `useFoo.test.tsx` mockando `fetch` global via `vi.stubGlobal`.

## Como adicionar uma rota

1. Criar `src/routes/<nome>.tsx` exportando o componente da página.
2. Registrar em `src/routes/index.tsx` no array de `createBrowserRouter`.
3. Usar `useParams()` para ler segmentos dinâmicos, `useNavigate()` para mudar de rota.
4. Layout compartilhado (`<Outlet />`) está em `routes/root.tsx`.

## Tailwind v4 vs v3

- **NÃO** existe `postcss.config.js` neste projeto.
- `tailwind.config.ts` **não** é usado — toda config vai para `@theme inline { ... }` no `src/index.css`.
- Plugin oficial: `@tailwindcss/vite` no `vite.config.ts`.
- Tokens em **OKLCH**, não HSL (decisão dos defaults v4 do shadcn).

## Convenção de testes (Vitest)

- Testes co-located: `Component.test.tsx` ao lado de `Component.tsx`. Hooks: `useFoo.test.ts` ao lado de `useFoo.ts`.
- Setup global em `src/test/setup.ts` (jest-dom matchers + cleanup pós-teste).
- Config em `vitest.config.ts` reusa o `vite.config.ts` via `mergeConfig`.
- Provider stack: usar `renderWithProviders(...)` ou `AllProviders` de `src/test/test-utils.tsx` que envolve em `QueryClientProvider` + `MemoryRouter`. Sempre usar `makeTestQueryClient()` por teste (cache isolado).
- A11y: usar `runAxe(container)` de `src/test/test-utils.tsx` (wrapper sobre `axe-core` com `color-contrast` desligado em jsdom). Asserir `expect(result.violations).toEqual([])`. Zero violations no que está auditado.
- Mock de fetch: `vi.stubGlobal('fetch', vi.fn(...))` no `beforeEach` + `vi.unstubAllGlobals` no `afterEach`.
- Mock do socket: `vi.hoisted` factory que constrói um EventEmitter fake, depois `vi.mock('@/lib/socket', () => ({ socket: fakeSocket }))`.
- Coverage atual (Phase 4 fechado): **statements ≥80% / branches ≥60% / functions ≥80% / lines ≥80%**. Rotas excluídas (E2E Playwright cuida no Spec C). Thresholds em `vitest.config.ts` — qualquer PR que regrida quebra o gate.

## Não fazer

- Importar componente shadcn de `node_modules` — a cópia local em `src/components/ui/` é o source of truth.
- Usar `useEffect` com array de deps vazio para fazer fetch dentro do componente — extraia para hook (preferir `useQuery` do TanStack Query).
- Tocar em `src/index.css` para customizar tema fora de `@theme inline` (vira inconsistente).
- Storybook, redux, jotai — fora do escopo. (TanStack Query e React Router agora são parte da stack — ver Spec A do plano em `/Users/gasparellodev/.claude/plans/precisamos-criar-um-plano-abstract-wombat.md`.)
- `socket.connect()` num `useEffect` sem `socket.disconnect()` no cleanup — leak garantido em StrictMode.

## Links

- `src/lib/socket.ts` — singleton (a ser criado no PR #7)
- `src/hooks/useConversations.ts` — estado da inbox (a ser criado no PR #10)
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
