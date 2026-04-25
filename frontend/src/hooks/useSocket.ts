import { useEffect, useState } from 'react'

import { socket } from '@/lib/socket'

/**
 * Conecta o singleton Socket.IO ao montar e desconecta ao desmontar.
 *
 * Em StrictMode (dev), o componente monta → desmonta → monta. Como o singleton
 * existe fora do componente, `socket.connect()` é chamado idempotentemente; o
 * cleanup chama `socket.disconnect()` apenas se não houver outro consumer.
 *
 * Use `useSocket()` no componente raiz (App). Componentes filhos usam outros
 * hooks específicos (useConversations, useConnectionStatus) para reagir a
 * eventos.
 */
export function useSocket() {
  const [connected, setConnected] = useState(socket.connected)

  useEffect(() => {
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    if (!socket.connected) socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      // Não desconectamos no cleanup do Provider raiz — manter a conexão
      // viva entre re-mounts do StrictMode.
    }
  }, [])

  return { socket, connected }
}
