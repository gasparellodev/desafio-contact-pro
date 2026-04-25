import { useEffect, useRef } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { Message } from '@/types/domain'

import { AIThinkingIndicator } from './AIThinkingIndicator'
import { MessageBubble } from './MessageBubble'

interface Props {
  messages: Message[]
  thinking: boolean
}

export function MessageList({ messages, thinking }: Props) {
  // Radix ScrollArea expõe o viewport via `[data-slot="scroll-area-viewport"]`.
  // `scrollIntoView` falha silenciosamente em mobile dentro de Radix porque o
  // viewport é um div com overflow customizado. Selecionamos o viewport e
  // mexemos no scrollTop direto — funciona em todos os browsers/devices.
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = scrollAreaRef.current
    if (!root) return
    const viewport = root.querySelector(
      '[data-slot="scroll-area-viewport"]'
    ) as HTMLElement | null
    if (!viewport) return
    // Defer to next frame para garantir que a nova bolha já está no DOM.
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
    })
  }, [messages.length, thinking])

  if (messages.length === 0 && !thinking) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Sem mensagens ainda. As mensagens chegarão aqui em tempo real.
      </div>
    )
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full px-3 sm:px-4" role="log" aria-live="polite">
      <div className="flex flex-col gap-3 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        {thinking && <AIThinkingIndicator />}
      </div>
    </ScrollArea>
  )
}
