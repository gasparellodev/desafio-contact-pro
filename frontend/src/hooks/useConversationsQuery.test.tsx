/**
 * Testa que o hook chama o endpoint REST correto e disponibiliza os dados via
 * TanStack Query. Mocka `fetch` global pra evitar depender da rede real.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AllProviders, makeTestQueryClient } from '@/test/test-utils'
import type { ConversationListResponse } from '@/types/domain'

import { useConversationsQuery } from './useConversationsQuery'

const sample: ConversationListResponse = {
  items: [
    {
      id: 'conv-1',
      lead: {
        id: 'lead-1',
        whatsapp_jid: '5511999990001@s.whatsapp.net',
        name: 'Cliente Um',
        phone: '+5511999990001',
        service_interest: 'unknown',
        status: 'new',
      },
      last_intent: null,
      last_message_at: '2026-04-25T15:00:00Z',
      created_at: '2026-04-25T14:00:00Z',
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
}

describe('useConversationsQuery', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(sample), { status: 200 }))
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('chama /api/conversations e devolve a página', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useConversationsQuery(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(sample)
    expect(fetch).toHaveBeenCalledTimes(1)
    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toMatch(/\/api\/conversations$/)
  })

  it('passa filtros de status e q como query string', async () => {
    const client = makeTestQueryClient()
    renderHook(() => useConversationsQuery({ status: 'qualified', q: 'maria', limit: 10 }), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })

    await waitFor(() =>
      expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
    )
    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('status=qualified')
    expect(calledUrl).toContain('q=maria')
    expect(calledUrl).toContain('limit=10')
  })
})
