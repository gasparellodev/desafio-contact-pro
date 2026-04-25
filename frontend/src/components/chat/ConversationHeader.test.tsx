import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationHeader } from '@/components/chat/ConversationHeader'
import { renderWithProviders } from '@/test/test-utils'
import type { Lead } from '@/types/domain'

const baseLead: Lead = {
  id: 'lead-1',
  whatsapp_jid: '5511999990001@s.whatsapp.net',
  name: 'Cliente',
  company: null,
  phone: '+5511999990001',
  service_interest: 'unknown',
  lead_goal: null,
  estimated_volume: null,
  status: 'new',
  bot_paused: false,
  created_at: '2026-04-25T14:00:00Z',
  updated_at: '2026-04-25T15:00:00Z',
}

describe('ConversationHeader', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ...baseLead, bot_paused: false }), { status: 200 }))
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('mostra título e NÃO mostra badge/botão quando bot está ativo', () => {
    renderWithProviders(<ConversationHeader title="Maria" lead={baseLead} />)
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.queryByText(/Pausado/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retomar/i })).not.toBeInTheDocument()
  })

  it('mostra badge PAUSADO + botão Retomar quando bot_paused', () => {
    renderWithProviders(
      <ConversationHeader title="João" lead={{ ...baseLead, bot_paused: true }} />
    )
    expect(screen.getByText(/Pausado/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retomar/i })).toBeInTheDocument()
  })

  it('clicar em Retomar bot dispara fetch POST /resume-bot', async () => {
    renderWithProviders(
      <ConversationHeader title="João" lead={{ ...baseLead, bot_paused: true }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Retomar/i }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(url).toMatch(/\/api\/leads\/lead-1\/resume-bot$/)
    })
  })
})
