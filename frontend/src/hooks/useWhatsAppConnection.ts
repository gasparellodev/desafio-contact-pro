/**
 * Estado atual da conexão WhatsApp via REST.
 *
 * Por que existe: o evento Socket.IO `wa.connection.update` só dispara em
 * MUDANÇA de estado. Quando a página carrega depois da instância já estar
 * pareada, sem fetch inicial o frontend ficaria travado em `unknown`. O
 * polling de 60s é backup contra eventos perdidos (socket reconnect, server
 * restart, etc.) — atualizações em tempo real continuam vindo do socket via
 * `setQueryData` no `SocketProvider`.
 */

import { useQuery } from '@tanstack/react-query'

import { fetchWhatsAppConnection } from '@/lib/api'
import { whatsappKeys } from '@/lib/queryKeys'

export function useWhatsAppConnection() {
  return useQuery({
    queryKey: whatsappKeys.connection(),
    queryFn: fetchWhatsAppConnection,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}
