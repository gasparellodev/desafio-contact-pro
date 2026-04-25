import { io, type Socket } from 'socket.io-client'

import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket'

// Singleton fora de qualquer componente. Necessário para sobreviver ao
// double-mount do StrictMode em dev sem abrir 2 conexões.
// `autoConnect: false` faz com que `socket.connect()` aconteça explicitamente
// no `useEffect` do hook (e `disconnect()` no cleanup).

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  withCredentials: true,
})
