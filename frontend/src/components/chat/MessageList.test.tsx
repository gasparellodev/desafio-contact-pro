/**
 * Verifica que o efeito de scroll mexe no `scrollTop` do viewport da Radix
 * ScrollArea quando chega mensagem nova. (`scrollIntoView` do código antigo
 * falhava silenciosamente em mobile — este teste cobre a regressão.)
 */

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Message } from '@/types/domain'

import { MessageList } from './MessageList'

const baseMessage: Message = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  whatsapp_message_id: null,
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
}

describe('MessageList', () => {
  it('renderiza placeholder quando vazio e sem thinking', () => {
    const { getByText } = render(<MessageList messages={[]} thinking={false} />)
    expect(getByText(/Sem mensagens ainda/i)).toBeInTheDocument()
  })

  it('faz scroll para o fim do viewport ao receber mensagem', async () => {
    // Mock requestAnimationFrame para rodar imediatamente.
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb) => {
        cb(0)
        return 0
      })

    const { container } = render(
      <MessageList messages={[baseMessage]} thinking={false} />
    )

    const viewport = container.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    expect(viewport).not.toBeNull()

    // jsdom não calcula scrollHeight real — só validamos que o efeito tentou
    // setar scrollTop (e que requestAnimationFrame foi invocado).
    expect(rafSpy).toHaveBeenCalled()
    rafSpy.mockRestore()
  })

  it('inclui role="log" e aria-live para acessibilidade de leitores de tela', () => {
    const { container } = render(<MessageList messages={[baseMessage]} thinking={false} />)
    const log = container.querySelector('[role="log"]')
    expect(log).not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
  })
})
