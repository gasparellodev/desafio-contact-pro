import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConversationList } from '@/components/chat/ConversationList'
import { MessageList } from '@/components/chat/MessageList'
import { LeadPanel } from '@/components/lead/LeadPanel'
import { QRCodePanel } from '@/components/connection/QRCodePanel'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useConversations } from '@/hooks/useConversations'
import { useSocket } from '@/hooks/useSocket'

function App() {
  const { connected } = useSocket()
  const { state, qrcode } = useConnectionStatus()
  const { conversations, active, activeId, setActiveId, thinkingActive } = useConversations()

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">Contact Pro · Inbox</span>
            <Badge variant="outline" className="text-[10px]">
              v0.1
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={connected ? 'success' : 'secondary'}>
              socket: {connected ? 'on' : 'off'}
            </Badge>
            <Badge variant={state === 'open' ? 'success' : state === 'connecting' ? 'warning' : 'secondary'}>
              wa: {state}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
        <aside className="col-span-3 flex flex-col">
          <Card className="flex-1 overflow-hidden p-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Conversas</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ConversationList
                items={conversations}
                activeId={activeId}
                onSelect={setActiveId}
              />
            </CardContent>
          </Card>
        </aside>

        <section className="col-span-6 flex flex-col">
          <Card className="flex flex-1 flex-col overflow-hidden p-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">
                {active?.lead.name || active?.lead.whatsapp_jid?.replace(/@.*/, '') || 'Selecione uma conversa'}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              {active ? (
                <MessageList messages={active.messages} thinking={thinkingActive} />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                  Aguardando primeira mensagem…
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="col-span-3 flex flex-col gap-4 overflow-y-auto">
          <QRCodePanel state={state} qrcode={qrcode} />
          <LeadPanel lead={active?.lead ?? null} />
        </aside>
      </main>
    </div>
  )
}

export default App
