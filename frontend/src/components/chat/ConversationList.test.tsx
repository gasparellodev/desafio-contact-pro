import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Conversation, Lead } from '@/types/domain'

import { ConversationList } from './ConversationList'

function makeItem(overrides: Partial<Lead> = {}, conv: Partial<Conversation> = {}) {
  const lead: Lead = {
    id: 'l1',
    whatsapp_jid: '5511999990001@s.whatsapp.net',
    name: 'Cliente Teste',
    company: null,
    phone: null,
    service_interest: 'unknown',
    lead_goal: null,
    estimated_volume: null,
    status: 'new',
    created_at: '2026-04-25T14:00:00Z',
    updated_at: '2026-04-25T15:00:00Z',
    ...overrides,
  }
  const conversation: Conversation = {
    id: 'c1',
    lead_id: lead.id,
    last_intent: null,
    last_message_at: '2026-04-25T15:00:00Z',
    created_at: '2026-04-25T14:00:00Z',
    ...conv,
  }
  return { conversation, lead }
}

describe('ConversationList', () => {
  it('mostra placeholder quando vazio', () => {
    render(<ConversationList items={[]} activeId={null} onSelect={() => {}} />)
    expect(screen.getByText(/Nenhuma conversa ainda/i)).toBeInTheDocument()
  })

  it('renderiza item com nome, status badge e dot de status', () => {
    const items = [makeItem({ status: 'qualified', name: 'Maria' })]
    render(<ConversationList items={items} activeId={null} onSelect={() => {}} />)
    expect(screen.getByText('Maria')).toBeInTheDocument()
    expect(screen.getByLabelText(/Status do lead: Qualificado/i)).toBeInTheDocument()
    expect(screen.getByText('Qualificado')).toBeInTheDocument()
  })

  it('chama onSelect quando o item é clicado', () => {
    const onSelect = vi.fn()
    const items = [makeItem({}, { id: 'conv-X' })]
    render(<ConversationList items={items} activeId={null} onSelect={onSelect} />)
    screen.getByRole('button').click()
    expect(onSelect).toHaveBeenCalledWith('conv-X')
  })

  it('marca item ativo com aria-current=true', () => {
    const items = [makeItem({}, { id: 'conv-X' })]
    render(<ConversationList items={items} activeId="conv-X" onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'true')
  })
})
