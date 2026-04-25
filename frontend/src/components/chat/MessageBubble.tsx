import { Mic, Image as ImageIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/domain'

interface Props {
  msg: Message
}

const statusVariant: Record<Message['status'], 'default' | 'success' | 'warning' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  sent: 'default',
  delivered: 'default',
  read: 'success',
  failed: 'destructive',
  received: 'outline',
}

export function MessageBubble({ msg }: Props) {
  const isOut = msg.direction === 'out'
  const showTranscription = msg.type === 'audio' && msg.transcription
  return (
    <div className={cn('flex w-full', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm',
          isOut ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
          {msg.type === 'audio' && (
            <span className="inline-flex items-center gap-1">
              <Mic className="size-3" /> Áudio
            </span>
          )}
          {msg.type === 'image' && (
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="size-3" /> Imagem
            </span>
          )}
          {msg.intent && (
            <Badge variant="outline" className="bg-background/40 text-[9px]">
              {msg.intent.replaceAll('_', ' ')}
            </Badge>
          )}
        </div>
        <div className="whitespace-pre-wrap break-words">
          {msg.type === 'audio' && !msg.transcription
            ? '🎙️ áudio recebido (transcrevendo...)'
            : msg.content || '(sem texto)'}
        </div>
        {showTranscription && (
          <div className="mt-2 border-t border-foreground/10 pt-2 text-xs opacity-90">
            <strong>Transcrição:</strong> {msg.transcription}
          </div>
        )}
        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70')}>
          <span>{new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          {isOut && (
            <Badge variant={statusVariant[msg.status]} className="px-1 text-[9px]">
              {msg.status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
