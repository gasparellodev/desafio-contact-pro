/**
 * Garante que o hook chama o endpoint REST correto, normaliza o response
 * nested do Evolution e degrada graciosamente em 502.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AllProviders, makeTestQueryClient } from '@/test/test-utils'

import { useWhatsAppConnection } from './useWhatsAppConnection'

function mockFetchOnce(response: Response | (() => Response)) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => (typeof response === 'function' ? response() : response))
  )
}

describe('useWhatsAppConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('chama /api/whatsapp/connection e devolve {state} achatado', async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ instance: { instanceName: 'contactpro', state: 'open' } }), {
        status: 200,
      })
    )
    const client = makeTestQueryClient()

    const { result } = renderHook(() => useWhatsAppConnection(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ state: 'open' })
    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toMatch(/\/api\/whatsapp\/connection$/)
  })

  it('aceita state no topo do payload (caso o backend mude futuramente)', async () => {
    mockFetchOnce(new Response(JSON.stringify({ state: 'connecting' }), { status: 200 }))
    const client = makeTestQueryClient()

    const { result } = renderHook(() => useWhatsAppConnection(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ state: 'connecting' })
  })

  it('502 do proxy degrada para {state: unknown} sem propagar erro', async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ detail: 'evolution unreachable' }), { status: 502 })
    )
    const client = makeTestQueryClient()

    const { result } = renderHook(() => useWhatsAppConnection(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    expect(result.current.data).toEqual({ state: 'unknown' })
    expect(result.current.error).toBeNull()
  })

  it('valor desconhecido vindo do backend cai em {state: unknown}', async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ instance: { state: 'banana' } }), { status: 200 })
    )
    const client = makeTestQueryClient()

    const { result } = renderHook(() => useWhatsAppConnection(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ state: 'unknown' })
  })
})
