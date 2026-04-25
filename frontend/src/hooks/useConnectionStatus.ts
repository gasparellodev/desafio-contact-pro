/**
 * Estado da conexão WhatsApp + QR Code para a UI.
 *
 * `state` vem do TanStack Query (REST + atualizações Socket.IO mescladas no
 * cache pelo `SocketProvider`). Enquanto a primeira request está em voo,
 * devolve `unknown` + `isLoading: true` — UX prefere placeholder a flicker.
 *
 * `qrcode` continua vindo do `useSocketContext()` (é evento puro, sem
 * cache REST).
 */

import { useSocketContext } from '@/providers/socket-context'
import type { ConnectionState } from '@/types/domain'

import { useWhatsAppConnection } from './useWhatsAppConnection'

interface ConnectionInfo {
  state: ConnectionState
  qrcode: string | null
  isLoading: boolean
}

export function useConnectionStatus(): ConnectionInfo {
  const { qrcode } = useSocketContext()
  const { data, isLoading } = useWhatsAppConnection()
  return {
    state: data?.state ?? 'unknown',
    qrcode,
    isLoading,
  }
}
