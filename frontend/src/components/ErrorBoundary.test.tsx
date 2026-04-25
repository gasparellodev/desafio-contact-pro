import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from './ErrorBoundary'

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('boom')
  return <p>conteúdo seguro</p>
}

describe('ErrorBoundary', () => {
  it('renderiza filhos quando não há erro', () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('conteúdo seguro')).toBeInTheDocument()
  })

  it('captura erro e mostra UI de fallback com botão de reset', () => {
    // Suprime o ruído do console.error que React loga em dev pra erros capturados.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb explode={true} />
      </ErrorBoundary>
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Algo deu errado/i)).toBeInTheDocument()
    expect(screen.getByText(/boom/)).toBeInTheDocument()
    // Botão de reset existe (interação completa exige rerender com children
    // não-explosivo; testar isso é problemático com fireEvent porque o reset
    // re-renderiza children EXISTENTES, que ainda jogam. UI presente é o que
    // importa pro contrato).
    expect(
      screen.getByRole('button', { name: /Tentar novamente/i })
    ).toBeInTheDocument()

    consoleErrorSpy.mockRestore()
  })
})
