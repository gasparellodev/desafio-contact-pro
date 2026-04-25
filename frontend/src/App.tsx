import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">Contact Pro · Inbox</span>
            <Badge variant="outline">v0.1 · scaffold</Badge>
          </div>
          <Badge variant="warning">connecting…</Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 md:grid-cols-12">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Conversas</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Sem conversas ainda. Pareie o WhatsApp para começar.
          </CardContent>
        </Card>

        <Card className="md:col-span-6">
          <CardHeader>
            <CardTitle>Mensagens</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            O histórico aparecerá aqui em tempo real.
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Lead</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Dados extraídos pela IA serão exibidos aqui.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default App
