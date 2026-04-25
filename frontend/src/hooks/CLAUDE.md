# frontend/src/hooks/CLAUDE.md

> Convenção de hooks customizados. Leia antes de adicionar um novo.

## Regras

1. **Cleanup obrigatório.** Todo `socket.on(...)` precisa ter um `socket.off(...)` no return do `useEffect`. Sem isso, em StrictMode (dev) o handler é registrado 2× e dispara duplicado.
2. **Sem fetch dentro de componente.** Componentes consomem hooks. Hooks consomem `lib/api.ts` e `lib/socket.ts`.
3. **Estado mínimo.** Cada hook expõe só o que o componente precisa renderizar. Para 6h, `useState` + `useReducer` é o suficiente — sem react-query/zustand.
4. **Sem deps externas inferidas.** Se um hook depende de outro estado, receber via parâmetro (não pegar de contexto sem necessidade).
5. **Ordem dos efeitos.** Sempre fazer `socket.on(...)` antes do trigger de fetch — evita race em que o evento chega antes do listener.

## Hooks atuais

| Hook | Responsabilidade |
|---|---|
| `useSocket` | Conecta/desconecta o singleton. Usar uma vez no `App`. |
| `useConnectionStatus` | Estado WhatsApp (open/connecting/close) + QR Code via Socket.IO. |
| `useConversations` (PR #10) | Lista de conversas + reducers de eventos. |

## Não fazer

- Conectar o socket dentro de componente que pode desmontar (use o singleton em `lib/socket.ts`).
- Usar `useState` para guardar derivações de outro estado (use `useMemo`).
- Setar estado depois de unmount sem checar (`AbortController` em fetches assíncronos).
- Misturar lógica de UI e de domínio no mesmo hook.

## Links

- `lib/socket.ts` — singleton Socket.IO
- `types/socket.ts` — contratos de eventos
- Plano: `/Users/gasparellodev/.claude/plans/o-seu-papel-crystalline-lantern.md`
