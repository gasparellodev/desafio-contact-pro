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
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, thinking])

  if (messages.length === 0 && !thinking) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Sem mensagens ainda. As mensagens chegarão aqui em tempo real.
      </div>
    )
  }

  return (
    <ScrollArea className="h-full px-4">
      <div className="flex flex-col gap-3 py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        {thinking && <AIThinkingIndicator />}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  )
}
