/**
 * `ConversationView` — painel central com mensagens. Usado pela rota
 * /conversations/:id, que pode também renderizar lead/QR do lado.
 *
 * Aceita slots opcionais para botão "voltar" (mobile) e ações no header
 * (LeadSheet em mobile/tablet).
 */

import type { ReactNode } from 'react'

import { MessageList } from '@/components/chat/MessageList'
import { LeadSheet } from '@/components/lead/LeadSheet'
import { MessageListSkeleton } from '@/components/Skeletons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
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
  const { state, qrcode } = useConnectionStatus()
  const { thinking } = useSocketContext()
  const messages = useConversationMessages(conversationId)
  const listEntry = listItems.find((it) => it.conversation.id === conversationId)
  const leadQuery = useLead(leadId)

  const headerLabel =
    listEntry?.lead.name || listEntry?.lead.whatsapp_jid?.replace(/@.*/, '') || 'Conversa'

  return (
    <Card className="flex flex-1 flex-col overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between border-b py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {mobileBackButton}
          <CardTitle className="truncate text-sm">{headerLabel}</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <LeadSheet lead={leadQuery.data ?? null} state={state} qrcode={qrcode} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
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
      </CardContent>
    </Card>
  )
}
