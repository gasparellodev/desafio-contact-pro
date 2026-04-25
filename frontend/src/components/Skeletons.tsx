/**
 * Skeletons leves usados em fallbacks de Suspense e durante `isLoading` das
 * queries. Pulse vem do utilitário `tw-animate-css` (já importado em index.css).
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function ConversationListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="flex flex-col" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="bg-muted size-9 animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-3 w-3/5 animate-pulse rounded" />
            <div className="bg-muted h-2 w-2/5 animate-pulse rounded" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MessageListSkeleton() {
  const items: Array<{ side: 'l' | 'r'; w: string }> = [
    { side: 'l', w: 'w-3/5' },
    { side: 'r', w: 'w-2/5' },
    { side: 'l', w: 'w-1/2' },
  ]
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-live="polite">
      {items.map((it, i) => (
        <div key={i} className={cn('flex w-full', it.side === 'r' ? 'justify-end' : 'justify-start')}>
          <div className={cn('bg-muted h-10 animate-pulse rounded-lg', it.w)} />
        </div>
      ))}
    </div>
  )
}

export function RouteFallbackSkeleton() {
  return (
    <div className="flex w-full gap-4 p-4">
      <Card className="flex w-[320px] flex-col p-0">
        <CardHeader className="border-b py-3" />
        <CardContent className="p-0">
          <ConversationListSkeleton rows={6} />
        </CardContent>
      </Card>
      <Card className="flex flex-1 p-0">
        <CardHeader className="border-b py-3" />
        <CardContent className="flex-1 p-0">
          <MessageListSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}
