/**
 * Mutation: libera o bot de um lead pausado por handoff humano.
 *
 * Backend `POST /api/leads/{id}/resume-bot` é idempotente. Em sucesso,
 * invalida `leadKeys.detail(id)` + `conversationKeys.lists()` (lista
 * mostra indicador de pausa, precisa atualizar).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { resumeBot } from '@/lib/api'
import { conversationKeys, leadKeys } from '@/lib/queryKeys'

export function useResumeBot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (leadId: string) => resumeBot(leadId),
    onSuccess: (lead) => {
      queryClient.setQueryData(leadKeys.detail(lead.id), lead)
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() })
    },
  })
}
