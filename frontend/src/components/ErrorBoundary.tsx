/**
 * ErrorBoundary global. Envolve o RouterProvider em main.tsx; qualquer erro
 * lançado durante render de qualquer rota cai aqui em vez de quebrar a app.
 *
 * React 19 ainda exige class component para Error Boundary (não há hook).
 */

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Em produção, isto vai pra um logger (Sentry, etc.). Por enquanto só console.
    console.error('ErrorBoundary caught', error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="bg-background text-foreground flex h-dvh items-center justify-center p-6"
        >
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wide">
                Algo deu errado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                O frontend lançou um erro inesperado. Tente recarregar; se o problema
                persistir, verifique o backend e o estado da conexão.
              </p>
              <pre className="bg-muted text-muted-foreground max-h-40 overflow-auto rounded p-3 font-mono text-xs">
                {this.state.error.message}
              </pre>
              <Button size="sm" onClick={this.reset}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }
    return this.props.children
  }
}
