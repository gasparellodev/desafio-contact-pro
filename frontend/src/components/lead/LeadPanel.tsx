import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { Lead } from '@/types/domain'

interface Props {
  lead: Lead | null
}

const statusLabel: Record<Lead['status'], string> = {
  new: 'Novo',
  qualified: 'Qualificado',
  needs_human: 'Precisa de humano',
  opt_out: 'Opt-out',
}

const statusVariant: Record<Lead['status'], 'default' | 'success' | 'warning' | 'secondary'> = {
  new: 'secondary',
  qualified: 'success',
  needs_human: 'warning',
  opt_out: 'secondary',
}

export function LeadPanel({ lead }: Props) {
  if (!lead) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Selecione uma conversa para ver os dados extraídos.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle>{lead.name ?? 'Lead sem nome'}</CardTitle>
          <Badge variant={statusVariant[lead.status]}>{statusLabel[lead.status]}</Badge>
        </div>
        <p className="text-muted-foreground text-xs">{lead.whatsapp_jid}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Field label="Empresa" value={lead.company} />
        <Field label="Telefone" value={lead.phone} />
        <Separator />
        <Field
          label="Interesse"
          value={lead.service_interest === 'unknown' ? null : lead.service_interest?.replaceAll('_', ' ')}
        />
        <Field label="Objetivo" value={lead.lead_goal} />
        <Field label="Volume estimado" value={lead.estimated_volume} />
      </CardContent>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs uppercase tracking-wide">{label}</div>
      <div className={value ? 'font-medium' : 'text-muted-foreground italic'}>
        {value ?? '—'}
      </div>
    </div>
  )
}
