import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { Conversation, Lead } from '@/types/domain'

interface Item {
  conversation: Conversation
  lead: Lead
}

interface Props {
  items: Item[]
  activeId: string | null
  onSelect(id: string): void
}

const statusVariant: Record<Lead['status'], 'default' | 'success' | 'warning' | 'secondary'> = {
  new: 'secondary',
  qualified: 'success',
  needs_human: 'warning',
  opt_out: 'secondary',
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}min`
  if (sec < 86400) return `${Math.round(sec / 3600)}h`
  return `${Math.round(sec / 86400)}d`
}

function initials(name: string | null, jid: string): string {
  const base = name?.trim() || jid.replace(/@.*/, '')
  return base
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function ConversationList({ items, activeId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
        Nenhuma conversa ainda. Pareie o WhatsApp para receber mensagens.
      </div>
    )
  }
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col">
        {items.map(({ conversation, lead }, idx) => (
          <div key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'hover:bg-accent flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                activeId === conversation.id && 'bg-accent',
              )}
            >
              <Avatar>
                <AvatarFallback>{initials(lead.name, lead.whatsapp_jid)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {lead.name || lead.whatsapp_jid.replace(/@.*/, '') || 'Lead'}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {relativeTime(conversation.last_message_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {conversation.last_intent && (
                    <Badge variant="outline" className="text-[10px]">
                      {conversation.last_intent.replaceAll('_', ' ')}
                    </Badge>
                  )}
                  <Badge variant={statusVariant[lead.status]} className="text-[10px]">
                    {lead.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
              </div>
            </button>
            {idx < items.length - 1 && <Separator />}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
