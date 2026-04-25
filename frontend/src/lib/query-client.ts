/**
 * Factory do `QueryClient`. Em arquivo separado pra que o `QueryProvider.tsx`
 * exporte só componentes (regra `react-refresh/only-export-components`).
 *
 * Defaults justificados:
 * - `staleTime: 60s` — lista de conversas tolera 1 min sem revalidar; eventos
 *   Socket.IO atualizam o cache via `setQueryData` em tempo real.
 * - `gcTime: 5 min` — cache de conversa fechada some após 5 min de inatividade.
 * - `retry: 1` — falhas transientes recuperam, mas erros estruturais (404, 401)
 *   estouram rápido pra UI mostrar.
 * - `refetchOnWindowFocus: false` — Socket.IO já mantém a UI fresca; o refetch
 *   no foco fica reservado pra mutations explícitas.
 */

import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
