/**
 * Verifica o merge de state (TanStack Query) + qrcode (SocketContext) que o
 * `useConnectionStatus` faz para o header e demais consumidores da UI.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { whatsappKeys } from '@/lib/queryKeys'
import { SocketContext, type SocketContextValue } from '@/providers/socket-context'
import { makeTestQueryClient } from '@/test/test-utils'

import { useConnectionStatus } from './useConnectionStatus'

function withProviders(client: QueryClient, socketValue: SocketContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <SocketContext.Provider value={socketValue}>{children}</SocketContext.Provider>
      </QueryClientProvider>
    )
  }
}

const baseSocket: SocketContextValue = {
  connected: false,
  waState: 'unknown',
  qrcode: null,
  thinking: {},
}

describe('useConnectionStatus', () => {
  beforeEach(() => {
    // Mock vazio — o hook é loading-only enquanto não respondemos.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('retorna {state: unknown, isLoading: true} antes do fetch resolver', () => {
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useConnectionStatus(), {
      wrapper: withProviders(client, baseSocket),
    })
    expect(result.current.state).toBe('unknown')
    expect(result.current.isLoading).toBe(true)
    expect(result.current.qrcode).toBeNull()
  })

  it('usa o state cacheado quando o query resolver', () => {
    const client = makeTestQueryClient()
    client.setQueryData(whatsappKeys.connection(), { state: 'open' })

    const { result } = renderHook(() => useConnectionStatus(), {
      wrapper: withProviders(client, baseSocket),
    })
    expect(result.current.state).toBe('open')
    expect(result.current.isLoading).toBe(false)
  })

  it('reage a updates do cache em tempo real (simula evento Socket.IO)', async () => {
    const client = makeTestQueryClient()
    client.setQueryData(whatsappKeys.connection(), { state: 'connecting' })

    const { result } = renderHook(() => useConnectionStatus(), {
      wrapper: withProviders(client, baseSocket),
    })
    expect(result.current.state).toBe('connecting')

    // SocketProvider faz isto quando chega `wa.connection.update`.
    client.setQueryData(whatsappKeys.connection(), { state: 'open' })

    await waitFor(() => expect(result.current.state).toBe('open'))
  })

  it('qrcode vem do SocketContext, não do query', () => {
    const client = makeTestQueryClient()
    client.setQueryData(whatsappKeys.connection(), { state: 'connecting' })
    const socket = { ...baseSocket, qrcode: 'data:image/png;base64,iVBOR' }

    const { result } = renderHook(() => useConnectionStatus(), {
      wrapper: withProviders(client, socket),
    })
    expect(result.current.qrcode).toBe('data:image/png;base64,iVBOR')
  })
})
