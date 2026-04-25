/**
 * Smoke do tooling de testes (Phase 1):
 * - Vitest roda;
 * - jsdom + render funcionam;
 * - matchers do jest-dom estão registrados via setup.ts;
 * - imports de @/* (alias) resolvem.
 *
 * Pode ser apagado quando os primeiros testes reais (Phase 2) estiverem no ar.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

describe('vitest tooling sanity', () => {
  it('renders a JSX tree into jsdom', () => {
    render(<button type="button">Clique aqui</button>)
    expect(screen.getByRole('button', { name: 'Clique aqui' })).toBeInTheDocument()
  })

  it('exposes jest-dom matchers via setup.ts', () => {
    render(
      <div>
        <span data-testid="badge" hidden>
          oculto
        </span>
      </div>
    )
    expect(screen.getByTestId('badge')).not.toBeVisible()
  })

  it('resolves the @/* alias from vite.config.ts', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })
})
