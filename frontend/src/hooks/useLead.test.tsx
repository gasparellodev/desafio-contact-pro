import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AllProviders, makeTestQueryClient } from '@/test/test-utils'
import type { Lead } from '@/types/domain'

import { useLead } from './useLead'

const sample: Lead = {
  id: 'lead-1',
  whatsapp_jid: '5511999990001@s.whatsapp.net',
  name: 'Cliente',
  company: null,
  phone: '+5511999990001',
  service_interest: 'contact_z',
  lead_goal: null,
  estimated_volume: null,
  status: 'qualified',
  created_at: '2026-04-25T14:00:00Z',
  updated_at: '2026-04-25T15:00:00Z',
}

describe('useLead', () => {
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

  it('é desabilitado quando id é null', () => {
    const client = makeTestQueryClient()
    renderHook(() => useLead(null), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('chama /api/leads/:id quando id válido', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useLead('lead-1'), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(sample)
    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toMatch(/\/api\/leads\/lead-1$/)
  })
})
