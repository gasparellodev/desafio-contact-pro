import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AllProviders, makeTestQueryClient } from '@/test/test-utils'
import type { MessagePageResponse } from '@/types/domain'

import { useConversationMessages } from './useConversationMessages'

const samplePage: MessagePageResponse = {
  items: [
    {
      id: 'msg-1',
      conversation_id: 'conv-1',
      whatsapp_message_id: 'wa-1',
      direction: 'in',
      type: 'text',
      content: 'oi',
      transcription: null,
      media_url: null,
      media_mime: null,
      intent: null,
      status: 'received',
      quoted_message_id: null,
      error_reason: null,
      created_at: '2026-04-25T15:00:00Z',
    },
  ],
  next_before: null,
  next_before_id: null,
  limit: 50,
}

describe('useConversationMessages', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(samplePage), { status: 200 }))
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('não chama fetch quando conversationId é null', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useConversationMessages(null), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.isFetching).toBe(false)
  })

  it('chama /api/conversations/:id/messages quando id é válido', async () => {
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useConversationMessages('conv-1'), {
      wrapper: ({ children }) => <AllProviders client={client}>{children}</AllProviders>,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(samplePage)
    const calledUrl = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toMatch(/\/api\/conversations\/conv-1\/messages$/)
  })
})
