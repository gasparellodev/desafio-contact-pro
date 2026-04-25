/**
 * Helpers de teste reusáveis. Importar via `@/test/test-utils` nos testes
 * que precisam de QueryClientProvider e/ou MemoryRouter.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { type ReactElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'

export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
}

interface AllProvidersProps {
  children: ReactNode
  initialEntries?: string[]
  client?: QueryClient
}

export function AllProviders({ children, initialEntries = ['/'], client }: AllProvidersProps) {
  const queryClient = client ?? makeTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
  client?: QueryClient
}

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries, client, ...options }: CustomRenderOptions = {}
): RenderResult & { client: QueryClient } {
  const testClient = client ?? makeTestQueryClient()
  const result = render(ui, {
    wrapper: ({ children }) => (
      <AllProviders client={testClient} initialEntries={initialEntries}>
        {children}
      </AllProviders>
    ),
    ...options,
  })
  return { ...result, client: testClient }
}
