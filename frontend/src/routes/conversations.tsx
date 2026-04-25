/**
 * Rota /conversations — vista padrão. Mostra lista à esquerda; centro pede
 * pra selecionar uma conversa; direita mostra QR + status (sem lead).
 */

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ConversationList } from '@/components/chat/ConversationList'
import { QRCodePanel } from '@/components/connection/QRCodePanel'
import { LeadPanel } from '@/components/lead/LeadPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConversationsQuery } from '@/hooks/useConversationsQuery'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'

import { ConversationView } from './conversation'

/**
 * Adapta um `ConversationListItem` (REST) para o shape antigo `{conversation,
 * lead}` consumido por `<ConversationList />`. Evita refator de componentes
 * nesta phase (eles serão tocados de novo na Phase 3).
 */
function adaptListItem(items: ReturnType<typeof useConversationsQuery>['data']) {
  if (!items) return []
  return items.items.map((it) => ({
    conversation: {
      id: it.id,
      lead_id: it.lead.id,
      last_intent: it.last_intent,
      last_message_at: it.last_message_at,
      created_at: it.created_at,
    },
    lead: {
      id: it.lead.id,
      whatsapp_jid: it.lead.whatsapp_jid,
      name: it.lead.name,
      company: null,
      phone: it.lead.phone,
      service_interest: it.lead.service_interest,
      lead_goal: null,
      estimated_volume: null,
      status: it.lead.status,
      created_at: it.created_at,
      updated_at: it.last_message_at,
    },
    messages: [],
  }))
}

export function ConversationsPage() {
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const activeId = params.id ?? null
  const { data, isLoading, error } = useConversationsQuery()
  const { state, qrcode } = useConnectionStatus()

  // Memo evita reconstruir items[] a cada re-render do parent ou do socket.
  const items = useMemo(() => adaptListItem(data), [data])

  return (
    <>
      <aside className="col-span-3 flex flex-col">
        <Card className="flex-1 overflow-hidden p-0">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">Conversas</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {isLoading ? (
              <div className="text-muted-foreground p-4 text-xs">Carregando…</div>
            ) : error ? (
              <div className="text-destructive p-4 text-xs">
                Erro ao carregar conversas. {(error as Error).message}
              </div>
            ) : (
              <ConversationList
                items={items}
                activeId={activeId}
                onSelect={(id) => navigate(`/conversations/${id}`)}
              />
            )}
          </CardContent>
        </Card>
      </aside>

      {activeId ? (
        <ConversationView conversationId={activeId} listItems={items} />
      ) : (
        <>
          <section className="col-span-6 flex flex-col">
            <Card className="flex flex-1 flex-col overflow-hidden p-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">Selecione uma conversa</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Aguardando primeira mensagem…
                </div>
              </CardContent>
            </Card>
          </section>
          <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto">
            <QRCodePanel state={state} qrcode={qrcode} />
            <LeadPanel lead={null} />
          </aside>
        </>
      )}
    </>
  )
}
