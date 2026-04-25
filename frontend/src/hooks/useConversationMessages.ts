/**
 * Mensagens de uma conversa via REST. Default: 50 mais recentes.
 *
 * SocketProvider faz `setQueryData` apenas quando o cache *já existe* (i.e.,
 * a conversa está aberta na tela). Conversas fechadas continuam frias até
 * usuário abrir, evitando inflar memória.
 *
 * Phase 4 vai trocar por `useInfiniteQuery` + `before/before_id` cursor pra
 * scroll-up infinito; aqui mantemos simples (uma página).
 */

import { useQuery } from '@tanstack/react-query'

import { fetchMessages } from '@/lib/api'
import { conversationKeys } from '@/lib/queryKeys'

export function useConversationMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: conversationId
      ? conversationKeys.messages(conversationId)
      : conversationKeys.messages('disabled'),
    queryFn: () => fetchMessages(conversationId as string),
    enabled: Boolean(conversationId),
  })
}
