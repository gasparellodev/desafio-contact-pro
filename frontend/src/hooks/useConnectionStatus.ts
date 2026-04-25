import { useEffect, useState } from 'react'

import { socket } from '@/lib/socket'
import type { ConnectionState } from '@/types/domain'

interface ConnectionInfo {
  state: ConnectionState
  qrcode: string | null
}

/**
 * Acompanha o estado da conexão WhatsApp e o QR Code emitido pelo backend.
 * Usa eventos `wa.connection.update` e `wa.qrcode.updated`.
 */
export function useConnectionStatus(): ConnectionInfo {
  const [state, setState] = useState<ConnectionState>('unknown')
  const [qrcode, setQrcode] = useState<string | null>(null)

  useEffect(() => {
    const onConnection = (data: { state: ConnectionState }) => {
      setState(data.state)
      if (data.state === 'open') setQrcode(null)
    }
    const onQr = (data: { qrcode: string | null }) => setQrcode(data.qrcode)

    socket.on('wa.connection.update', onConnection)
    socket.on('wa.qrcode.updated', onQr)
    return () => {
      socket.off('wa.connection.update', onConnection)
      socket.off('wa.qrcode.updated', onQr)
    }
  }, [])

  return { state, qrcode }
}
