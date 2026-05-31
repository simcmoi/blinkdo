import { Keyboard } from 'lucide-react'

type AppFooterProps = {
  error: string | null
  globalShortcut: string
  sortModeLabel: string
}

export function AppFooter({ error, globalShortcut, sortModeLabel }: AppFooterProps) {
  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2 text-[11px]">
        <p className="text-destructive">Erreur: {error}</p>
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Keyboard className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">{globalShortcut}</span>
          <span className="text-muted-foreground/60">·</span>
          <span className="truncate">Enter ajoute/édite · Espace termine · Esc ferme</span>
        </div>
        <span className="hidden shrink-0 sm:inline">Tri: {sortModeLabel}</span>
      </div>
    </div>
  )
}
