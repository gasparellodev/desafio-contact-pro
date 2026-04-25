import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { ConnectionState } from '@/types/domain'

interface Props {
  state: ConnectionState
  qrcode: string | null
}

const stateBadge: Record<ConnectionState, { variant: 'default' | 'success' | 'warning' | 'secondary'; label: string }> = {
  open: { variant: 'success', label: 'Conectado' },
  connecting: { variant: 'warning', label: 'Conectando…' },
  close: { variant: 'secondary', label: 'Desconectado' },
  unknown: { variant: 'secondary', label: 'Status desconhecido' },
}

export function QRCodePanel({ state, qrcode }: Props) {
  const [bootstrapping, setBootstrapping] = useState(false)
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null)
  const [pulledQr, setPulledQr] = useState<string | null>(null)

  useEffect(() => {
    if (qrcode) setPulledQr(null)
  }, [qrcode])

  async function bootstrap() {
    setBootstrapping(true)
    setBootstrapMsg(null)
    try {
      await api('/api/whatsapp/instance', { method: 'POST' })
      await api('/api/whatsapp/webhook', { method: 'POST' })
      const qr = await api<{ base64?: string; code?: string }>('/api/whatsapp/qrcode', { method: 'GET' })
      setPulledQr(qr.base64 ?? null)
      setBootstrapMsg('Pareie escaneando o QR abaixo.')
    } catch (err) {
      setBootstrapMsg((err as Error).message)
    } finally {
      setBootstrapping(false)
    }
  }

  const display = qrcode ?? pulledQr
  const meta = stateBadge[state]

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle>WhatsApp</CardTitle>
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
            {bootstrapMsg && (
              <p className="text-muted-foreground text-xs">{bootstrapMsg}</p>
            )}
            {display && (
              <div className="bg-card flex justify-center rounded-md border p-3">
                <img
                  src={display.startsWith('data:') ? display : `data:image/png;base64,${display}`}
                  alt="QR Code WhatsApp"
                  className="h-48 w-48"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
