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

const statusBadgeVariant: Record<Lead['status'], 'default' | 'success' | 'warning' | 'secondary'> = {
  new: 'secondary',
  qualified: 'success',
  needs_human: 'warning',
  opt_out: 'secondary',
}

const statusDotClass: Record<Lead['status'], string> = {
  new: 'bg-status-new',
  qualified: 'bg-status-qualified',
  needs_human: 'bg-status-needs-human',
  opt_out: 'bg-status-opt-out',
}

const statusLabel: Record<Lead['status'], string> = {
  new: 'Novo',
  qualified: 'Qualificado',
  needs_human: 'Precisa humano',
  opt_out: 'Opt-out',
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
      <ul className="flex flex-col" role="list">
        {items.map(({ conversation, lead }, idx) => (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              aria-current={activeId === conversation.id ? 'true' : undefined}
              className={cn(
                'hover:bg-accent focus-visible:bg-accent focus-visible:outline-ring/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2',
                activeId === conversation.id && 'bg-accent'
              )}
            >
              <div className="relative">
                <Avatar>
                  <AvatarFallback className="font-mono text-xs">
                    {initials(lead.name, lead.whatsapp_jid)}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'border-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2',
                    statusDotClass[lead.status]
                  )}
                  aria-label={`Status do lead: ${statusLabel[lead.status]}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">
                    {lead.name || lead.whatsapp_jid.replace(/@.*/, '') || 'Lead'}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {relativeTime(conversation.last_message_at)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {conversation.last_intent && (
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] uppercase tracking-wider"
                    >
                      {conversation.last_intent.replaceAll('_', ' ')}
                    </Badge>
                  )}
                  <Badge variant={statusBadgeVariant[lead.status]} className="text-[10px]">
                    {statusLabel[lead.status]}
                  </Badge>
                  {lead.bot_paused && (
                    <Badge
                      variant="warning"
                      className="font-mono text-[9px] uppercase tracking-wider"
                      aria-label="Bot pausado — aguardando humano"
                    >
                      ⚑ pausado
                    </Badge>
                  )}
                </div>
              </div>
            </button>
            {idx < items.length - 1 && <Separator />}
          </li>
        ))}
      </ul>
    </ScrollArea>
  )
}
