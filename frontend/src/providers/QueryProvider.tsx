/**
 * QueryProvider — wrapper de TanStack Query.
 *
 * Devtools só são montadas em dev (Vite injeta `import.meta.env.DEV`).
 * O `QueryClient` é construído por `makeQueryClient` em `lib/query-client.ts`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ReactNode, useState } from 'react'

import { makeQueryClient } from '@/lib/query-client'

// Dynamic import: bundle de produção não carrega devtools (~50KB).
// `Suspense` mantém UI renderizada enquanto o chunk lazy carrega em dev.
const ReactQueryDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({
    default: m.ReactQueryDevtools,
  }))
)

interface QueryProviderProps {
  children: ReactNode
  // Opcional: cliente pré-construído. Útil em testes para isolar caches.
  client?: QueryClient
}

export function QueryProvider({ children, client }: QueryProviderProps) {
  // useState pra garantir 1 client por mount (evita cache global compartilhado
  // entre re-renders e entre testes).
  const [queryClient] = useState(() => client ?? makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  )
}
