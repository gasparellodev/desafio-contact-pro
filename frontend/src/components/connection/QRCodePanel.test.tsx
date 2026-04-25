/**
 * Garante que o componente NÃO chama setState após desmontar — o
 * AbortController introduzido neste componente cancela fetches em voo.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QRCodePanel } from './QRCodePanel'

describe('QRCodePanel', () => {
  beforeEach(() => {
    // fetch que NUNCA resolve — simula request em voo durante o unmount.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(() => {
            /* nunca resolve */
          })
      )
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('não dispara warning de setState ao desmontar com fetch em voo', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { unmount } = render(<QRCodePanel state="close" qrcode={null} />)

    fireEvent.click(screen.getByRole('button', { name: /Inicializar instância/i }))
    // Desmonta com o fetch em voo — AbortController deve cancelar e evitar
    // "Cannot perform a React state update on an unmounted component".
    unmount()

    // Pequena janela de microtask pra qualquer microtask pendente reagir.
    await Promise.resolve()

    const warnedAboutUnmount = consoleErrorSpy.mock.calls.some((args) =>
      String(args[0] ?? '').includes('unmounted component')
    )
    expect(warnedAboutUnmount).toBe(false)

    consoleErrorSpy.mockRestore()
  })

  it('mostra mensagem de pareado quando state=open', () => {
    render(<QRCodePanel state="open" qrcode={null} />)
    expect(screen.getByText(/Conta pareada/i)).toBeInTheDocument()
  })

  it('renderiza imagem QR quando qrcode é provido', () => {
    render(<QRCodePanel state="connecting" qrcode="iVBORw0KGgo=" />)
    const img = screen.getByAltText('QR Code WhatsApp') as HTMLImageElement
    expect(img.src).toContain('data:image/png;base64,iVBORw0KGgo=')
  })
})
