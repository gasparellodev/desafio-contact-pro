/**
 * Mutation: humano envia mensagem manual via UI.
 *
 * `POST /api/conversations/{id}/messages` no backend persiste Message OUT
 * + chama Evolution send_text + emite `wa.message.sent` no Socket.IO.
 * O SocketProvider já mescla esse evento no cache de mensagens, então
 * esse hook só precisa disparar a mutation — UI atualiza automaticamente
 * via Socket.IO.
 *
 * Não fazemos optimistic update aqui porque o backend valida o conteúdo
 * e o WhatsApp pode falhar; mostrar a mensagem antes da confirmação
 * causaria flicker. Spinner no botão durante isLoading é suficiente.
 */

import { useMutation } from '@tanstack/react-query'

import { sendManualMessage, type ManualMessageInput } from '@/lib/api'

export function useSendManualMessage() {
  return useMutation({
    mutationFn: (input: ManualMessageInput) => sendManualMessage(input),
  })
}
