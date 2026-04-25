import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ManualMessageInput } from '@/components/chat/ManualMessageInput'
import { renderWithProviders } from '@/test/test-utils'

describe('ManualMessageInput', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 'm1',
              conversation_id: 'conv-1',
              whatsapp_message_id: 'WA-1',
              direction: 'out',
              type: 'text',
              content: 'olá',
              transcription: null,
              media_url: null,
              media_mime: null,
              intent: null,
              status: 'sent',
              quoted_message_id: null,
              error_reason: null,
              created_at: '2026-04-25T15:30:00Z',
            }),
            { status: 201 }
          )
      )
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renderiza textarea + botão Enviar', () => {
    renderWithProviders(<ManualMessageInput conversationId="conv-1" />)
    expect(
      screen.getByRole('textbox', { name: 'Mensagem para o lead' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Enviar/i })).toBeInTheDocument()
  })

  it('botão fica disabled quando textarea vazio', () => {
    renderWithProviders(<ManualMessageInput conversationId="conv-1" />)
    expect(screen.getByRole('button', { name: /Enviar/i })).toBeDisabled()
  })

  it('envia, limpa o input após sucesso', async () => {
    renderWithProviders(<ManualMessageInput conversationId="conv-1" />)

    const textarea = screen.getByRole('textbox', {
      name: 'Mensagem para o lead',
    }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'olá manual' } })
    expect(textarea.value).toBe('olá manual')

    fireEvent.click(screen.getByRole('button', { name: /Enviar/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toMatch(/\/api\/conversations\/conv-1\/messages$/)
    })
    await waitFor(() => expect(textarea.value).toBe(''))
  })
})
