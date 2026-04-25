/**
 * Rota /conversations(/:id) — orquestra o layout responsivo:
 *
 * Mobile (< md):
 *   /conversations         → só lista (full width)
 *   /conversations/:id     → só chat (com header de voltar) + LeadSheet via botão
 *
 * Tablet (md, ≥768px): 2 colunas (lista + chat). Lead via Sheet.
 * Desktop (lg, ≥1024px): 3 colunas (lista + chat + lead/QR direto na sidebar).
 */

import { ChevronLeft } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ConversationList } from '@/components/chat/ConversationList'
import { QRCodePanel } from '@/components/connection/QRCodePanel'
import { LeadPanel } from '@/components/lead/LeadPanel'
import { ConversationListSkeleton } from '@/components/Skeletons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useConversationsQuery } from '@/hooks/useConversationsQuery'
import { useLead } from '@/hooks/useLead'
import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/types/domain'

import { ConversationView } from './conversation'

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
      bot_paused: it.lead.bot_paused,
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

  const items = useMemo(() => adaptListItem(data), [data])

  // Coluna esquerda (lista): visível em md+ sempre; em mobile só quando NÃO há :id.
  const showSidebar = activeId === null
  // Coluna direita (lead+QR como blocos diretos): só visível em lg+.

  const renderListPanel = (
    <Card className="flex h-full flex-1 flex-col overflow-hidden p-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="font-mono text-xs uppercase tracking-wider">
          Conversas
          {data ? (
            <span className="text-muted-foreground ml-1.5">({data.total})</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {isLoading ? (
          <ConversationListSkeleton rows={5} />
        ) : error ? (
          <div role="alert" className="text-destructive p-4 text-xs">
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
  )

  const activeListItem = items.find((it) => it.conversation.id === activeId)
  const leadIdForActive = activeListItem?.conversation.lead_id ?? null

  return (
    <div className="flex w-full gap-4 overflow-hidden p-3 sm:p-4">
      {/* Sidebar (lista) — escondida em mobile quando há conversa ativa. */}
      <aside
        className={cn(
          'flex flex-col',
          // mobile: só aparece quando não há :id (=lista cheia, full width)
          showSidebar ? 'flex-1' : 'hidden',
          // tablet+: sempre visível, largura fixa generosa
          'md:flex md:w-[280px] md:flex-none lg:w-[320px]'
        )}
      >
        {renderListPanel}
      </aside>

      {activeId ? (
        <>
          {/* Chat (centro) — full width em mobile, flex-1 caso contrário */}
          <section className="flex flex-1 flex-col overflow-hidden">
            <ConversationView
              conversationId={activeId}
              listItems={items}
              leadId={leadIdForActive}
              mobileBackButton={
                <Link
                  to="/conversations"
                  className="hover:bg-accent inline-flex items-center justify-center rounded-md p-1 md:hidden"
                  aria-label="Voltar para a lista de conversas"
                >
                  <ChevronLeft className="size-4" />
                </Link>
              }
            />
          </section>

          {/* Coluna direita lead/QR — só desktop (lg+) */}
          <aside className="hidden flex-col gap-4 overflow-y-auto lg:flex lg:w-[320px] lg:flex-none">
            <DesktopLeadAndQr leadId={leadIdForActive} state={state} qrcode={qrcode} />
          </aside>
        </>
      ) : (
        // Sem conversa selecionada: em md+ centro mostra placeholder + direita QR
        <>
          <section className="hidden flex-1 flex-col md:flex">
            <Card className="flex flex-1 flex-col overflow-hidden p-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="font-mono text-xs uppercase tracking-wider">
                  Selecione uma conversa
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-sm">
                  Aguardando primeira mensagem… clique numa conversa para abrir.
                </div>
              </CardContent>
            </Card>
          </section>
          <aside className="hidden flex-col gap-4 overflow-y-auto lg:flex lg:w-[320px] lg:flex-none">
            <QRCodePanel state={state} qrcode={qrcode} />
            <LeadPanel lead={null} />
          </aside>
          {/* Em mobile vazio: nenhum chat visível, só a lista que já está em cima */}
        </>
      )}
    </div>
  )
}

/**
 * Bloco lead+QR para desktop (lg+). Em outras viewports usamos o `LeadSheet`
 * dentro do header da conversa.
 */
function DesktopLeadAndQr({
  leadId,
  state,
  qrcode,
}: {
  leadId: string | null
  state: ConnectionState
  qrcode: string | null
}) {
  const leadQuery = useLead(leadId)
  return (
    <>
      <QRCodePanel state={state} qrcode={qrcode} />
      <LeadPanel lead={leadQuery.data ?? null} />
    </>
  )
}
