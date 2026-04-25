import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { runAxe } from '@/test/test-utils'
import type { Lead } from '@/types/domain'

import { LeadPanel } from './LeadPanel'

const lead: Lead = {
  id: 'l1',
  whatsapp_jid: '5511999990001@s.whatsapp.net',
  name: 'Maria Souza',
  company: 'Acme',
  phone: '+5511999990001',
  service_interest: 'contact_z',
  lead_goal: 'aumentar conversão',
  estimated_volume: '10k leads/mês',
  status: 'qualified',
  created_at: '2026-04-25T14:00:00Z',
  updated_at: '2026-04-25T15:00:00Z',
}

describe('LeadPanel', () => {
  it('renderiza placeholder quando lead é null', () => {
    render(<LeadPanel lead={null} />)
    expect(screen.getByText(/Selecione uma conversa/i)).toBeInTheDocument()
  })

  it('renderiza nome, status e campos extraídos', () => {
    render(<LeadPanel lead={lead} />)
    expect(screen.getByText('Maria Souza')).toBeInTheDocument()
    expect(screen.getByText('Qualificado')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('contact z')).toBeInTheDocument()
    expect(screen.getByText('aumentar conversão')).toBeInTheDocument()
  })

  it('passa axe sem violations (lead preenchido)', async () => {
    const { container } = render(<LeadPanel lead={lead} />)
    const result = await runAxe(container)
    expect(result.violations).toEqual([])
  })

  it('passa axe sem violations (placeholder)', async () => {
    const { container } = render(<LeadPanel lead={null} />)
    const result = await runAxe(container)
    expect(result.violations).toEqual([])
  })
})
