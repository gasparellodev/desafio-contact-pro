import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function NotFoundPage() {
  return (
    <div className="bg-background text-foreground flex h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Rota não encontrada</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-3 text-sm">
          <p>O endereço acessado não existe.</p>
          <Link to="/conversations" className="text-primary underline">
            Voltar para a lista de conversas
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
