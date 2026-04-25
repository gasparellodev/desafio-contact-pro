/**
 * Sheet dedicado ao status global da instância WhatsApp.
 *
 * Acionado pelo badge `wa: <state>` clicável no header (`routes/root.tsx`).
 * Substituiu a junção anterior em `LeadSheet`, que misturava status global
 * com dados per-conversa e confundia o usuário (vide issue #59).
 *
 * Em desktop (lg+) este Sheet não é necessário — `QRCodePanel` aparece
 * direto na sidebar direita das rotas.
 */

import type { ReactNode } from 'react'

import { QRCodePanel } from '@/components/connection/QRCodePanel'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { ConnectionState } from '@/types/domain'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: ConnectionState
  qrcode: string | null
  trigger?: ReactNode
}

export function WhatsAppStatusSheet({ open, onOpenChange, state, qrcode }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm uppercase tracking-wide">
            Status WhatsApp
          </SheetTitle>
          <SheetDescription>
            Estado global da instância. Pareie aqui caso a conexão tenha caído.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <QRCodePanel state={state} qrcode={qrcode} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
