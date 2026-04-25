/**
 * `ConversationView` — componente extraído pra ser reusado pela rota
 * /conversations/:id (vide `routes/conversations.tsx`). Renderiza centro
 * (mensagens) + direita (QR + lead).
 */

import { MessageList } from '@/components/chat/MessageList'
import { QRCodePanel } from '@/components/connection/QRCodePanel'
import { LeadPanel } from '@/components/lead/LeadPanel'
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
}

export function ConversationView({ conversationId, listItems }: ConversationViewProps) {
  const { state, qrcode } = useConnectionStatus()
  const { thinking } = useSocketContext()
  const messages = useConversationMessages(conversationId)
  const listEntry = listItems.find((it) => it.conversation.id === conversationId)
  const leadId = listEntry?.conversation.lead_id ?? null
  const leadQuery = useLead(leadId)

  const headerLabel =
    listEntry?.lead.name ||
    listEntry?.lead.whatsapp_jid?.replace(/@.*/, '') ||
    'Conversa'

  return (
    <>
      <section className="col-span-6 flex flex-col">
        <Card className="flex flex-1 flex-col overflow-hidden p-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">{headerLabel}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {messages.isLoading ? (
              <div className="text-muted-foreground p-4 text-xs">Carregando mensagens…</div>
            ) : messages.error ? (
              <div className="text-destructive p-4 text-xs">
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
      </section>

      <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto">
        <QRCodePanel state={state} qrcode={qrcode} />
        <LeadPanel lead={leadQuery.data ?? null} />
      </aside>
    </>
  )
}
