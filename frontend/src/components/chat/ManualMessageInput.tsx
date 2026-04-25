/**
 * Input de envio manual: humano responde via UI quando bot está pausado.
 *
 * Renderizado SÓ quando `lead.bot_paused = true` (escondido com bot ativo
 * pra não confundir — não dá pra ter humano e bot respondendo ao mesmo
 * tempo). Backend persiste como Message OUT, dispara Evolution send_text,
 * emite `wa.message.sent` no Socket.IO. SocketProvider mescla no cache,
 * UI atualiza automaticamente — sem optimistic update aqui.
 */

import { Send } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useSendManualMessage } from '@/hooks/useSendManualMessage'

interface Props {
  conversationId: string
}

const MAX_LENGTH = 4096 // limite WhatsApp (também validado no backend)

export function ManualMessageInput({ conversationId }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const sendMutation = useSendManualMessage()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    sendMutation.mutate(
      { conversationId, content: trimmed },
      {
        onSuccess: () => setText(''),
        onError: (err) => setError((err as Error).message),
      }
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-status-needs-human/30 bg-status-needs-human/5 flex items-end gap-2 border-t p-3"
      aria-label="Envio manual (humano)"
    >
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Responda como humano… (bot está pausado)"
          rows={2}
          maxLength={MAX_LENGTH}
          disabled={sendMutation.isPending}
          className="bg-background border-input text-foreground focus-visible:outline-ring/60 w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:outline-2 disabled:opacity-60"
          aria-label="Mensagem para o lead"
        />
        {error && (
          <p role="alert" className="text-destructive mt-1 text-xs">
            {error}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={sendMutation.isPending || text.trim().length === 0}
        aria-label="Enviar mensagem como humano"
      >
        <Send className="mr-1 size-4" />
        {sendMutation.isPending ? 'Enviando…' : 'Enviar'}
      </Button>
    </form>
  )
}
