import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { conversationKeys, leadKeys } from '@/lib/queryKeys'
import { AllProviders, makeTestQueryClient } from '@/test/test-utils'
import type { Lead } from '@/types/domain'

import { useResumeBot } from './useResumeBot'

const responseLead: Lead = {
  id: 'lead-1',
  whatsapp_jid: '5511999990001@s.whatsapp.net',
  name: 'Cliente',
  company: null,
  phone: '+5511999990001',
  service_interest: 'contact_z',
  lead_goal: null,
  estimated_volume: null,
  status: 'qualified',
  bot_paused: false,
  created_at: '2026-04-25T14:00:00Z',
  updated_at: '2026-04-25T15:30:00Z',
}

describe('useResumeBot', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responseLead), { status: 200 }))
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('chama POST /api/leads/{id}/resume-bot e atualiza cache do lead', async () => {
    const client = makeTestQueryClient()
    // Pré-cache do lead pausado pra confirmar que o sucesso atualiza
    client.setQueryData(leadKeys.detail('lead-1'), { ...responseLead, bot_paused: true })

    const { result } = renderHook(() => useResumeBot(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    result.current.mutate('lead-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const calledInit = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(calledUrl).toMatch(/\/api\/leads\/lead-1\/resume-bot$/)
    expect(calledInit.method).toBe('POST')

    expect(client.getQueryData(leadKeys.detail('lead-1'))).toEqual(responseLead)
  })

  it('invalida lista de conversas no sucesso', async () => {
    const client = makeTestQueryClient()
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useResumeBot(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    result.current.mutate('lead-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: conversationKeys.lists() })
  })
})
