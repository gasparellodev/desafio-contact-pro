/**
 * Layout shell. Header sticky com sistema-pulse + área principal flex-1.
 *
 * Layout responsivo é resolvido pelas próprias rotas (`conversations.tsx`),
 * não aqui — esta camada cuida só do header e do container.
 */

import { Outlet } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { useSocketContext } from '@/providers/socket-context'
import { cn } from '@/lib/utils'

export function RootLayout() {
  const { connected } = useSocketContext()
  const { state } = useConnectionStatus()

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col">
      <header className="bg-card/80 supports-[backdrop-filter]:bg-card/60 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'inline-block size-2 rounded-full',
                connected ? 'bg-status-qualified animate-status-pulse' : 'bg-muted-foreground/40'
              )}
              aria-hidden
            />
            <span className="font-mono text-sm font-semibold tracking-tight sm:text-base">
              Contact Pro · Inbox
            </span>
            <Badge variant="outline" className="hidden font-mono text-[10px] sm:inline-flex">
              v0.3
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider sm:gap-2 sm:text-xs">
            <Badge variant={connected ? 'success' : 'secondary'}>
              <span className="hidden sm:inline">socket: </span>
              {connected ? 'on' : 'off'}
            </Badge>
            <Badge
              variant={
                state === 'open' ? 'success' : state === 'connecting' ? 'warning' : 'secondary'
              }
            >
              <span className="hidden sm:inline">wa: </span>
              {state}
            </Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
