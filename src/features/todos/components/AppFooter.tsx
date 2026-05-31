import { open } from '@tauri-apps/plugin-shell'
import { Star } from 'lucide-react'

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
    <div className="border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-medium">{globalShortcut}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>Tri: {sortModeLabel}</span>
        </div>
        <button
          onClick={() => void open('https://github.com/simcmoi/blinkdo')}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Star className="h-3 w-3" />
          <span>Star on GitHub</span>
        </button>
      </div>
    </div>
  )
}
