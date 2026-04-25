/**
 * Header da conversa: título + ações (voltar mobile, Lead detalhes, status).
 *
 * Quando `lead.bot_paused = true`, mostra badge âmbar "PAUSADO" + botão
 * "Retomar bot" que dispara `useResumeBot`. Sem isso, admin não tem como
 * saber que o bot foi pausado por handoff (silêncio sem feedback).
 */

import { PlayCircle } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { useResumeBot } from '@/hooks/useResumeBot'
import { cn } from '@/lib/utils'
import type { Lead } from '@/types/domain'

interface Props {
  title: string
  lead: Lead | null
  mobileBackButton?: ReactNode
  rightSlot?: ReactNode
}

export function ConversationHeader({ title, lead, mobileBackButton, rightSlot }: Props) {
  const resumeBot = useResumeBot()
  const paused = lead?.bot_paused === true

  return (
    <CardHeader
      className={cn(
        'flex flex-row items-center justify-between border-b py-2.5',
        paused && 'bg-status-needs-human/10 border-status-needs-human/30'
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {mobileBackButton}
        <CardTitle className="truncate text-sm">{title}</CardTitle>
        {paused && (
          <Badge variant="warning" className="font-mono text-[10px] uppercase tracking-wider">
            Pausado · humano
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {paused && lead && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resumeBot.mutate(lead.id)}
            disabled={resumeBot.isPending}
            aria-label="Retomar bot"
          >
            <PlayCircle className="mr-1 size-4" />
            {resumeBot.isPending ? 'Retomando…' : 'Retomar bot'}
          </Button>
        )}
        {rightSlot}
      </div>
    </CardHeader>
  )
}
