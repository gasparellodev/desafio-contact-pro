/**
 * Re-export das infos de conexão a partir do SocketProvider.
 *
 * Antes da Phase 2, este hook fazia `socket.on(...)` direto. Agora o
 * SocketProvider centraliza handlers e expõe via Context — evita N
 * subscribers para o mesmo evento.
 */

import { useSocketContext } from '@/providers/socket-context'
import type { ConnectionState } from '@/types/domain'

interface ConnectionInfo {
  state: ConnectionState
  qrcode: string | null
}

export function useConnectionStatus(): ConnectionInfo {
  const { waState, qrcode } = useSocketContext()
  return { state: waState, qrcode }
}
