/**
 * Wrapper que apresenta o `LeadPanel` num Sheet shadcn (mobile/tablet).
 *
 * Em mobile (< md) e tablet (md), o painel do Lead não cabe ao lado do chat;
 * vira um Sheet aberto via botão "Detalhes" no header da rota. Em desktop
 * (lg+), a coluna direita renderiza o painel diretamente.
 *
 * Status da instância WhatsApp NÃO entra aqui — é estado global (uma
 * instância pra todo o app), exposto via badge clicável no header
 * (`WhatsAppStatusSheet`). Misturar lead (per-conversa) com status (global)
 * confundia o usuário (vide issue #59).
 */

import { Info } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { Lead } from '@/types/domain'

import { LeadPanel } from './LeadPanel'

interface Props {
  lead: Lead | null
  triggerLabel?: string
}

export function LeadSheet({ lead, triggerLabel = 'Detalhes' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" aria-label="Abrir detalhes do lead">
          <Info className="mr-2 size-4" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm uppercase tracking-wide">
            Detalhes do lead
          </SheetTitle>
          <SheetDescription>Dados extraídos pela IA durante a conversa.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <LeadPanel lead={lead} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
