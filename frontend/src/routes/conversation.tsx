/**
 * `ConversationView` — painel central com mensagens + header inteligente
 * (badge PAUSADO + botão Retomar quando lead.bot_paused) + input manual
 * embaixo da lista quando bot pausado.
 */

import type { ReactNode } from 'react'

import { ConversationHeader } from '@/components/chat/ConversationHeader'
import { ManualMessageInput } from '@/components/chat/ManualMessageInput'
import { MessageList } from '@/components/chat/MessageList'
import { LeadSheet } from '@/components/lead/LeadSheet'
import { MessageListSkeleton } from '@/components/Skeletons'
import { Card, CardContent } from '@/components/ui/card'
import { useConversationMessages } from '@/hooks/useConversationMessages'
import { useLead } from '@/hooks/useLead'
import { useSocketContext } from '@/providers/socket-context'

interface ConversationViewProps {
  conversationId: string
  listItems: ReadonlyArray<{
    conversation: { id: string; lead_id: string }
    lead: { name: string | null; whatsapp_jid: string }
  }>
  leadId: string | null
  mobileBackButton?: ReactNode
}

export function ConversationView({
  conversationId,
  listItems,
  leadId,
  mobileBackButton,
}: ConversationViewProps) {
  const { thinking } = useSocketContext()
  const messages = useConversationMessages(conversationId)
  const listEntry = listItems.find((it) => it.conversation.id === conversationId)
  const leadQuery = useLead(leadId)
  const lead = leadQuery.data ?? null

  const headerLabel =
    listEntry?.lead.name || listEntry?.lead.whatsapp_jid?.replace(/@.*/, '') || 'Conversa'

  return (
    <Card className="flex flex-1 flex-col overflow-hidden p-0">
      <ConversationHeader
        title={headerLabel}
        lead={lead}
        mobileBackButton={mobileBackButton}
        rightSlot={
          <div className="lg:hidden">
            <LeadSheet lead={lead} />
          </div>
        }
      />
      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="flex-1 overflow-hidden">
          {messages.isLoading ? (
            <MessageListSkeleton />
          ) : messages.error ? (
            <div role="alert" className="text-destructive p-4 text-xs">
              Erro ao carregar mensagens. {(messages.error as Error).message}
            </div>
          ) : (
            <MessageList
              messages={messages.data?.items ?? []}
              thinking={thinking[conversationId] === true}
            />
          )}
        </div>
        {lead?.bot_paused && <ManualMessageInput conversationId={conversationId} />}
      </CardContent>
    </Card>
  )
}
