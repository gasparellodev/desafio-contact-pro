/**
 * Lista de conversas via REST. SocketProvider mantém o cache vivo invalidando
 * a query quando chega `wa.message.received` / `wa.message.sent`.
 */

import { useQuery } from '@tanstack/react-query'

import { fetchConversations, type ListConversationsParams } from '@/lib/api'
import { conversationKeys } from '@/lib/queryKeys'

export function useConversationsQuery(params: ListConversationsParams = {}) {
  return useQuery({
    queryKey: conversationKeys.list(params),
    queryFn: () => fetchConversations(params),
  })
}
