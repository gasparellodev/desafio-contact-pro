/**
 * Testa que o SocketProvider:
 * - mescla `wa.message.received` no cache de mensagens via setQueryData;
 * - patche transcription via `audio.transcribed`;
 * - atualiza Lead via `lead.updated`;
 * - expõe waState/qrcode/connected via Context;
 *
 * Para isso, mocka o módulo `@/lib/socket` com um EventEmitter-like fake.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { conversationKeys, leadKeys, whatsappKeys } from '@/lib/queryKeys'
import { useSocketContext } from '@/providers/socket-context'
import { makeTestQueryClient } from '@/test/test-utils'
import type {
  ConversationListResponse,
  Lead,
  Message,
  MessagePageResponse,
} from '@/types/domain'

import { SocketProvider } from './SocketProvider'

// `vi.hoisted` roda ANTES dos imports, então o módulo `@/lib/socket` mockado
// abaixo já tem o `fakeSocket` disponível.
const { fakeSocket, handlers } = vi.hoisted(() => {
  const h = new Map<string, Set<(data: unknown) => void>>()
  const s = {
    connected: false,
    on(event: string, handler: (data: unknown) => void) {
      if (!h.has(event)) h.set(event, new Set())
      h.get(event)!.add(handler)
    },
    off(event: string, handler: (data: unknown) => void) {
      h.get(event)?.delete(handler)
    },
    connect: vi.fn(() => {
      s.connected = true
    }),
    emit: (event: string, data: unknown) => {
      h.get(event)?.forEach((handler) => handler(data))
    },
  }
  return { fakeSocket: s, handlers: h }
})

vi.mock('@/lib/socket', () => ({ socket: fakeSocket }))

beforeEach(() => {
  handlers.clear()
  fakeSocket.connected = false
  fakeSocket.connect.mockClear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

function withProviders(client = makeTestQueryClient()) {
  return {
    client,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <SocketProvider>{children}</SocketProvider>
      </QueryClientProvider>
    ),
  }
}

const baseMessage: Message = {
  id: 'msg-new',
  conversation_id: 'conv-1',
  whatsapp_message_id: 'wa-new',
  direction: 'in',
  type: 'text',
  content: 'novo',
  transcription: null,
  media_url: null,
  media_mime: null,
  intent: null,
  status: 'received',
  quoted_message_id: null,
  error_reason: null,
  created_at: '2026-04-25T15:30:00Z',
}

describe('SocketProvider', () => {
  it('chama socket.connect ao montar', () => {
    const { wrapper } = withProviders()
    render(<div />, { wrapper })
    expect(fakeSocket.connect).toHaveBeenCalled()
  })

  it('mescla wa.message.received no cache quando já existe página em cache', () => {
    const { client, wrapper } = withProviders()
    const initial: MessagePageResponse = {
      items: [],
      next_before: null,
      next_before_id: null,
      limit: 50,
    }
    client.setQueryData(conversationKeys.messages('conv-1'), initial)

    render(<div />, { wrapper })

    act(() => {
      fakeSocket.emit('wa.message.received', baseMessage)
    })

    const updated = client.getQueryData<MessagePageResponse>(
      conversationKeys.messages('conv-1')
    )
    expect(updated?.items).toHaveLength(1)
    expect(updated?.items[0]?.id).toBe('msg-new')
  })

  it('não duplica quando o mesmo wa.message.received chega duas vezes (idempotência por id)', () => {
    const { client, wrapper } = withProviders()
    client.setQueryData(conversationKeys.messages('conv-1'), {
      items: [],
      next_before: null,
      next_before_id: null,
      limit: 50,
    } satisfies MessagePageResponse)
    render(<div />, { wrapper })

    act(() => {
      fakeSocket.emit('wa.message.received', baseMessage)
      fakeSocket.emit('wa.message.received', baseMessage)
    })

    const updated = client.getQueryData<MessagePageResponse>(
      conversationKeys.messages('conv-1')
    )
    expect(updated?.items).toHaveLength(1)
  })

  it('patches transcription via audio.transcribed', () => {
    const { client, wrapper } = withProviders()
    client.setQueryData(conversationKeys.messages('conv-1'), {
      items: [{ ...baseMessage, type: 'audio', transcription: null }],
      next_before: null,
      next_before_id: null,
      limit: 50,
    } satisfies MessagePageResponse)
    render(<div />, { wrapper })

    act(() => {
      fakeSocket.emit('audio.transcribed', { messageId: 'msg-new', transcription: 'oi' })
    })

    const updated = client.getQueryData<MessagePageResponse>(
      conversationKeys.messages('conv-1')
    )
    expect(updated?.items[0]?.transcription).toBe('oi')
  })

  it('atualiza Lead via lead.updated', () => {
    const { client, wrapper } = withProviders()
    render(<div />, { wrapper })

    const lead: Lead = {
      id: 'lead-1',
      whatsapp_jid: '5511999990001@s.whatsapp.net',
      name: 'Atualizado',
      company: null,
      phone: '+5511999990001',
      service_interest: 'contact_z',
      lead_goal: null,
      estimated_volume: null,
      status: 'qualified',
      created_at: '2026-04-25T14:00:00Z',
      updated_at: '2026-04-25T15:30:00Z',
    }

    act(() => {
      fakeSocket.emit('lead.updated', lead)
    })

    expect(client.getQueryData(leadKeys.detail('lead-1'))).toEqual(lead)
  })

  it('atualiza LeadSummary embutido na lista de conversas', () => {
    const { client, wrapper } = withProviders()
    const initialList: ConversationListResponse = {
      items: [
        {
          id: 'conv-1',
          lead: {
            id: 'lead-1',
            whatsapp_jid: '5511999990001@s.whatsapp.net',
            name: 'Antigo',
            phone: null,
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
    client.setQueryData(conversationKeys.list({}), initialList)
    render(<div />, { wrapper })

    const lead: Lead = {
      id: 'lead-1',
      whatsapp_jid: '5511999990001@s.whatsapp.net',
      name: 'Novo Nome',
      company: null,
      phone: '+5511988887777',
      service_interest: 'pricing' as never,
      lead_goal: null,
      estimated_volume: null,
      status: 'qualified',
      created_at: '2026-04-25T14:00:00Z',
      updated_at: '2026-04-25T15:30:00Z',
    }

    act(() => {
      fakeSocket.emit('lead.updated', lead)
    })

    const list = client.getQueryData<ConversationListResponse>(conversationKeys.list({}))
    expect(list?.items[0]?.lead.name).toBe('Novo Nome')
    expect(list?.items[0]?.lead.status).toBe('qualified')
  })

  it('expõe estado via useSocketContext', () => {
    const { wrapper } = withProviders()
    const { result } = renderHook(() => useSocketContext(), { wrapper })

    expect(result.current.connected).toBe(false)
    expect(result.current.waState).toBe('unknown')
    expect(result.current.qrcode).toBeNull()

    act(() => {
      fakeSocket.emit('wa.qrcode.updated', { qrcode: 'data:base64,abc' })
      fakeSocket.emit('wa.connection.update', { state: 'open' })
    })

    expect(result.current.waState).toBe('open')
    // qrcode deve ser limpo quando state é 'open'
    expect(result.current.qrcode).toBeNull()
  })

  it('wa.connection.update escreve {state} no cache de whatsappKeys.connection', () => {
    const { client, wrapper } = withProviders()
    render(<div />, { wrapper })

    act(() => {
      fakeSocket.emit('wa.connection.update', { state: 'open' })
    })

    expect(client.getQueryData(whatsappKeys.connection())).toEqual({ state: 'open' })

    act(() => {
      fakeSocket.emit('wa.connection.update', { state: 'close' })
    })
    expect(client.getQueryData(whatsappKeys.connection())).toEqual({ state: 'close' })
  })
})
