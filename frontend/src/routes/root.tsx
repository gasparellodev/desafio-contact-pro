/**
 * Layout shell. Header + grid 3-6-3 + Outlet.
 *
 * Phase 2 mantém o layout desktop tal como era em App.tsx — responsividade
 * mobile-first vai entrar na Phase 3 (com `frontend-design`).
 *
 * Os filhos (rotas) usam `useOutletContext` para receber a lista de conversas
 * já carregada. Dessa forma, list e detail compartilham o mesmo cache sem
 * duplicar useQuery.
 */

import { Outlet } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useSocketContext } from '@/providers/socket-context'

export function RootLayout() {
  const { connected } = useSocketContext()
  const { state } = useConnectionStatus()

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">Contact Pro · Inbox</span>
            <Badge variant="outline" className="text-[10px]">
              v0.2
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={connected ? 'success' : 'secondary'}>
              socket: {connected ? 'on' : 'off'}
            </Badge>
            <Badge
              variant={
                state === 'open' ? 'success' : state === 'connecting' ? 'warning' : 'secondary'
              }
            >
              wa: {state}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-12 gap-4 overflow-hidden p-4">
        <Outlet />
      </main>
    </div>
  )
}
