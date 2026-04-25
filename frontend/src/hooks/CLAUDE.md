# frontend/src/hooks/CLAUDE.md

> Convenção de hooks customizados. Leia antes de adicionar um novo.

## Regras

1. **TanStack Query é a porta para REST.** Toda leitura de dados de servidor passa por `useQuery`/`useInfiniteQuery` consumindo `lib/api.ts`. Nada de `fetch` direto em componente nem em hook fora de `lib/api.ts`.
2. **Socket.IO entra via `SocketProvider`, não via hook custom.** `socket.on(...)` só pode aparecer dentro de `providers/SocketProvider.tsx`. Hooks que precisam reagir a evento real-time consomem o cache (`useQuery`) ou o context (`useSocketContext()`).
3. **Sem fetch em componente.** Componentes consomem hooks; hooks consomem `lib/`.
4. **Estado mínimo.** Cada hook expõe só o que o componente precisa. Estado UI efêmero pode usar `useState` local; cache de servidor SEMPRE TanStack Query.
5. **Cleanup obrigatório quando há subscriber externo.** Todo `addEventListener`, `setInterval`, etc. precisa ser desfeito no return do `useEffect`.
6. **Param opcional → `enabled`.** Hooks que dependem de id devem aceitar `null/undefined` e usar `useQuery({ enabled: Boolean(id) })`.

## Hooks atuais

| Hook | Responsabilidade |
|---|---|
| `useConversationsQuery(filters?)` | Lista de conversas via REST. SocketProvider invalida quando chega mensagem (reordenar por last_message_at). |
| `useConversationMessages(id?)` | Página de mensagens de uma conversa via REST. SocketProvider mescla mensagens novas via `setQueryData`. |
| `useLead(id?)` | Detalhe completo do Lead via REST. SocketProvider atualiza via `lead.updated`. |
| `useWhatsAppConnection()` | Estado da conexão WhatsApp via REST (`/api/whatsapp/connection`) com polling backup de 60s. SocketProvider faz `setQueryData` quando chega `wa.connection.update` para resposta imediata. |
| `useConnectionStatus()` | Merge: `state` vem do `useWhatsAppConnection()` query (REST + socket), `qrcode` vem do `useSocketContext()` (evento puro). Retorna `{state, qrcode, isLoading}`. |

## Não fazer

- `useEffect(() => { fetch(...) })` num hook — use `useQuery` com `queryFn` apontando para `lib/api.ts`.
- `socket.on(...)` num hook — adicione no `SocketProvider`.
- Setar estado local pra cachear resposta de REST — TanStack Query já faz cache + dedup.
- Inventar query key fora de `lib/queryKeys.ts` — quebra invalidação.

## Como adicionar um hook

1. Adicionar typed fetcher em `lib/api.ts` se ainda não existe.
2. Adicionar key factory em `lib/queryKeys.ts` (`xKeys.detail(id)`).
3. Criar `useX(id?)` em `hooks/useX.ts` chamando `useQuery({ queryKey: xKeys.detail(id), queryFn: () => fetchX(id), enabled: Boolean(id) })`.
4. Co-locar teste `useX.test.tsx` mockando `fetch` global via `vi.stubGlobal`.

## Links

- `lib/socket.ts` — singleton Socket.IO
- `lib/api.ts` — typed fetchers
- `lib/queryKeys.ts` — factory de query keys
- `providers/SocketProvider.tsx` — único ponto de assinatura de eventos socket
- `providers/socket-context.ts` — Context + `useSocketContext`
- `types/socket.ts` — contratos de eventos
- `types/domain.ts` — schemas REST + enums
