import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AllProviders, makeTestQueryClient } from '@/test/test-utils'
import type { Message } from '@/types/domain'

import { useSendManualMessage } from './useSendManualMessage'

const responseMessage: Message = {
  id: 'msg-out-1',
  conversation_id: 'conv-1',
  whatsapp_message_id: 'WA-123',
  direction: 'out',
  type: 'text',
  content: 'oi humano',
  transcription: null,
  media_url: null,
  media_mime: null,
  intent: null,
  status: 'sent',
  quoted_message_id: null,
  error_reason: null,
  created_at: '2026-04-25T15:30:00Z',
}

describe('useSendManualMessage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responseMessage), { status: 201 }))
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('chama POST /api/conversations/{id}/messages com body correto', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useSendManualMessage(), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })
    result.current.mutate({ conversationId: 'conv-1', content: 'oi humano' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    const calledInit = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    expect(calledUrl).toMatch(/\/api\/conversations\/conv-1\/messages$/)
    expect(calledInit.method).toBe('POST')
    expect(JSON.parse(calledInit.body as string)).toEqual({ content: 'oi humano' })
    expect(result.current.data).toEqual(responseMessage)
  })
})
