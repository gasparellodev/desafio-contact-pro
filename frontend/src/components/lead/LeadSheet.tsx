/**
 * Wrapper que apresenta `LeadPanel` + `QRCodePanel` num Sheet shadcn.
 *
 * Em mobile (< md) e tablet (md), os 2 painéis lado a lado não cabem; viram
 * um Sheet aberto via botão no header da rota. Em desktop (lg+), a coluna
 * direita renderiza eles diretamente — esse wrapper é só para os breakpoints
 * pequenos.
 */

import { Info } from 'lucide-react'
import { useState } from 'react'

import { QRCodePanel } from '@/components/connection/QRCodePanel'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { ConnectionState, Lead } from '@/types/domain'

import { LeadPanel } from './LeadPanel'

interface Props {
  lead: Lead | null
  state: ConnectionState
  qrcode: string | null
  triggerLabel?: string
}

export function LeadSheet({ lead, state, qrcode, triggerLabel = 'Detalhes' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Abrir detalhes do lead e QR Code">
          <Info className="mr-2 size-4" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm uppercase tracking-wide">
            Detalhes da conversa
          </SheetTitle>
          <SheetDescription>
            Lead extraído pela IA e estado da conexão WhatsApp.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <LeadPanel lead={lead} />
          <QRCodePanel state={state} qrcode={qrcode} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
