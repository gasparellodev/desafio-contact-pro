export function AIThinkingIndicator() {
  return (
    <div role="status" aria-live="polite" className="flex justify-start">
      <div className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs">
        <span className="bg-foreground/60 size-1.5 animate-bounce rounded-full" style={{ animationDelay: '0ms' }} />
        <span className="bg-foreground/60 size-1.5 animate-bounce rounded-full" style={{ animationDelay: '150ms' }} />
        <span className="bg-foreground/60 size-1.5 animate-bounce rounded-full" style={{ animationDelay: '300ms' }} />
        <span className="ml-2">IA pensando…</span>
      </div>
    </div>
  )
}
