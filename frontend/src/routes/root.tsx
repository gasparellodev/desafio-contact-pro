/**
 * Layout shell. Header sticky com sistema-pulse + área principal flex-1.
 *
 * O badge `wa:` é clicável — abre `WhatsAppStatusSheet` com o `QRCodePanel`
 * (estado/parear). Status WhatsApp é GLOBAL, então fica no header em vez de
 * misturar com `LeadSheet` per-conversa (vide issue #59).
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { WhatsAppStatusSheet } from '@/components/connection/WhatsAppStatusSheet'
import { Badge } from '@/components/ui/badge'
import { useConnectionStatus } from '@/hooks/useConnectionStatus'
import { cn } from '@/lib/utils'
import { useSocketContext } from '@/providers/socket-context'

export function RootLayout() {
  const { connected } = useSocketContext()
  const { state, qrcode } = useConnectionStatus()
  const [statusSheetOpen, setStatusSheetOpen] = useState(false)

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
            <button
              type="button"
              onClick={() => setStatusSheetOpen(true)}
              aria-label={`Abrir status do WhatsApp (atual: ${state})`}
              className="rounded-md focus-visible:outline-ring/60 focus-visible:outline-2"
            >
              <Badge
                variant={
                  state === 'open'
                    ? 'success'
                    : state === 'connecting'
                      ? 'warning'
                      : 'secondary'
                }
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <span className="hidden sm:inline">wa: </span>
                {state}
              </Badge>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 overflow-hidden">
        <Outlet />
      </main>

      <WhatsAppStatusSheet
        open={statusSheetOpen}
        onOpenChange={setStatusSheetOpen}
        state={state}
        qrcode={qrcode}
      />
    </div>
  )
}
