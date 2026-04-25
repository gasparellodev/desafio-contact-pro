import { useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeTestQueryClient } from '@/test/test-utils'

import { QueryProvider } from './QueryProvider'

function Sentinel() {
  const q = useQuery({
    queryKey: ['ping'],
    queryFn: async () => 'pong',
  })
  return <div data-testid="value">{q.data ?? '...'}</div>
}

describe('QueryProvider', () => {
  it('expõe um QueryClient para os filhos', async () => {
    const client = makeTestQueryClient()
    render(
      <QueryProvider client={client}>
        <Sentinel />
      </QueryProvider>
    )

    expect(await screen.findByText('pong')).toBeInTheDocument()
  })
})
