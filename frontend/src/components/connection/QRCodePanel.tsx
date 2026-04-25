import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { ConnectionState } from '@/types/domain'

interface Props {
  state: ConnectionState
  qrcode: string | null
}

const stateBadge: Record<
  ConnectionState,
  { variant: 'default' | 'success' | 'warning' | 'secondary'; label: string }
> = {
  open: { variant: 'success', label: 'Conectado' },
  connecting: { variant: 'warning', label: 'Conectando…' },
  close: { variant: 'secondary', label: 'Desconectado' },
  unknown: { variant: 'secondary', label: 'Status desconhecido' },
}

export function QRCodePanel({ state, qrcode }: Props) {
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null)
  const [pulledQr, setPulledQr] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cancela qualquer fetch em voo se o componente desmontar — evita warning
  // "setState on unmounted component" e libera a conexão TCP rapidamente.
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  async function bootstrap() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBootstrapping(true)
    setBootstrapMsg(null)
    try {
      await api('/api/whatsapp/instance', { method: 'POST', signal: controller.signal })
      await api('/api/whatsapp/webhook', { method: 'POST', signal: controller.signal })
      const qr = await api<{ base64?: string; code?: string }>('/api/whatsapp/qrcode', {
        method: 'GET',
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setPulledQr(qr.base64 ?? null)
      setBootstrapMsg('Pareie escaneando o QR abaixo.')
    } catch (err) {
      if (controller.signal.aborted) return
      setBootstrapMsg((err as Error).message)
    } finally {
      if (!controller.signal.aborted) setBootstrapping(false)
    }
  }

  // `qrcode` (vindo do socket) tem prioridade; `pulledQr` é fallback
  // do bootstrap manual quando ainda não chegou nada via Socket.IO.
  const display = qrcode ?? pulledQr
  const meta = stateBadge[state]

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-mono text-sm uppercase tracking-wide">WhatsApp</CardTitle>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === 'open' ? (
          <p className="text-muted-foreground text-sm">
            Conta pareada. Mensagens serão recebidas automaticamente.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Crie a instância e escaneie o QR Code com o WhatsApp do celular.
            </p>
            <Button size="sm" onClick={bootstrap} disabled={bootstrapping}>
              {bootstrapping ? 'Iniciando…' : 'Inicializar instância'}
            </Button>
            {bootstrapMsg && <p className="text-muted-foreground text-xs">{bootstrapMsg}</p>}
            {display && (
              <div className="bg-card mx-auto flex aspect-square w-full max-w-xs justify-center rounded-md border p-3">
                <img
                  src={
                    display.startsWith('data:') ? display : `data:image/png;base64,${display}`
                  }
                  alt="QR Code WhatsApp"
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
