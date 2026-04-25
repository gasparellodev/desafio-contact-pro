# Frontend — Contact Pro Inbox

Inbox web em tempo real para acompanhar conversas do chatbot WhatsApp + IA. **Responsivo mobile-first**, com **rotas deep-linkáveis** (F5 mantém a conversa aberta), suíte Vitest co-located e a11y validada com axe-core.

> Para visão geral do projeto, comandos Docker e setup completo, leia o [`README.md` da raiz](../README.md).
> Para convenções (componentes, hooks, providers, testes), leia [`CLAUDE.md`](./CLAUDE.md), [`src/components/CLAUDE.md`](./src/components/CLAUDE.md), [`src/hooks/CLAUDE.md`](./src/hooks/CLAUDE.md).

## Stack

- **Vite 8** + **React 19.2** + **TypeScript 6** strict.
- **Tailwind v4** via plugin oficial `@tailwindcss/vite` (sem `postcss.config.js`); tokens em **OKLCH** no `src/index.css`.
- **shadcn/ui** style `new-york`, primitives copiadas em `src/components/ui/`.
- **React Router 7** (`createBrowserRouter`, lazy routes).
- **TanStack Query 5** (`useQuery`, cache merge via `setQueryData` quando chega evento Socket.IO).
- **socket.io-client 4.8.x** (singleton em `src/lib/socket.ts`, `autoConnect: false`).
- **Vitest 4** + **Testing Library 16** + **jsdom 29** + **axe-core 4**.

## Scripts

```bash
npm install
npm run dev            # http://localhost:5173 (host: true)
npm run build          # tsc -b && vite build (initial gzip ~125KB)
npm run preview        # serve dist em :5173
npm run lint           # eslint, zero erros esperados
npm run typecheck      # tsc -b --noEmit (separado do build)
npm run test           # vitest run (49 testes em ~4s)
npm run test:watch     # vitest interativo
npm run test:ui        # @vitest/ui no browser
npm run test:coverage  # 85% statements / 67% branches / 87% functions / 91% lines
```

## Como rodar localmente sem Docker

Útil para iterar rápido em UI:

```bash
# Backend precisa estar rodando em http://localhost:8000.
# Se não tiver, sobe só backend+db+redis+evolution:
docker compose up -d backend

# Em outro terminal:
cd frontend
npm install
npm run dev
# Browser http://localhost:5173
```

`VITE_API_URL` (default `http://localhost:8000`) e `VITE_ADMIN_TOKEN` (mesmo valor de `ADMIN_API_TOKEN` do backend) podem ser sobrescritos via `.env.local` se precisar.

## Arquitetura local

```
src/
  main.tsx                # ErrorBoundary > QueryProvider > SocketProvider > RouterProvider
  routes/                 # createBrowserRouter + React.lazy code splitting
  providers/              # QueryProvider, SocketProvider (escreve no cache TanStack ao receber evento)
  hooks/                  # useConversationsQuery, useConversationMessages, useLead, useWhatsAppConnection
  components/             # ConversationList, MessageList, MessageBubble, LeadPanel, LeadSheet, QRCodePanel, ErrorBoundary, Skeletons
  lib/                    # api.ts (typed fetchers), queryKeys.ts, query-client.ts, socket.ts
  types/                  # contratos Socket.IO + schemas REST
  test/                   # setup.ts (jest-dom + cleanup), test-utils.tsx (renderWithProviders + runAxe)
```

## Convenção de testes

- **Co-located**: `Component.test.tsx` ao lado de `Component.tsx`.
- **Mock de fetch**: `vi.stubGlobal('fetch', vi.fn(...))` no `beforeEach` + `vi.unstubAllGlobals` no `afterEach`.
- **Mock do socket**: `vi.hoisted(() => ({ fakeSocket }))` antes de `vi.mock('@/lib/socket', () => ({ socket: fakeSocket }))`.
- **A11y**: `await runAxe(container)` + `expect(result.violations).toEqual([])` em componentes críticos.
- **Coverage thresholds** em `vitest.config.ts`: 80% statements / 60% branches / 80% functions / 80% lines (rotas excluídas — E2E Spec C cuida).

Mais detalhes em [`CLAUDE.md`](./CLAUDE.md).
