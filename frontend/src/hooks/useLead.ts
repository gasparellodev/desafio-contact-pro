/**
 * Detalhe completo do Lead (extracted fields, status, timestamps). O
 * SocketProvider escuta `lead.updated` e atualiza o cache via setQueryData.
 */

import { useQuery } from '@tanstack/react-query'

import { fetchLead } from '@/lib/api'
import { leadKeys } from '@/lib/queryKeys'

export function useLead(leadId: string | null | undefined) {
  return useQuery({
    queryKey: leadId ? leadKeys.detail(leadId) : leadKeys.detail('disabled'),
    queryFn: () => fetchLead(leadId as string),
    enabled: Boolean(leadId),
  })
}
