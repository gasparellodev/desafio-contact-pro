/**
 * Context + hook do SocketProvider em arquivo separado pra que o componente
 * provider exporte só componentes (regra `react-refresh/only-export-components`).
 */

import { createContext, useContext } from 'react'

import type { ConnectionState } from '@/types/domain'

export interface SocketContextValue {
  connected: boolean
  waState: ConnectionState
  qrcode: string | null
  // conversationId -> está pensando?
  thinking: Record<string, boolean>
}

export const SocketContext = createContext<SocketContextValue | null>(null)

export function useSocketContext(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) {
    throw new Error('useSocketContext deve ser usado dentro de <SocketProvider>')
  }
  return ctx
}
