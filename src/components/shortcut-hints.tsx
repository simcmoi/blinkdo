import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { ShortcutHintsContext } from '@/components/shortcut-hints-context'
import { useShortcutHints } from '@/hooks/use-shortcut-hints'

export function ShortcutHintsProvider({ children }: { children: ReactNode }) {
  const modifierLabel = useMemo(() => (
    navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl'
  ), [])
  const [showHints, setShowHints] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        setShowHints(true)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        setShowHints(false)
      }
    }

    const onBlur = () => setShowHints(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return (
    <ShortcutHintsContext.Provider value={{ modifierLabel, showHints }}>
      {children}
    </ShortcutHintsContext.Provider>
  )
}

export function Kbd({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-background px-1.5 font-mono text-[10px] font-semibold leading-none text-muted-foreground shadow-sm',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export function ShortcutHint({
  shortcut,
  always = false,
  className,
}: {
  shortcut: string
  always?: boolean
  className?: string
}) {
  const { showHints } = useShortcutHints()

  if (!always && !showHints) return null

  return (
    <Kbd
      className={cn(
        'pointer-events-none border-primary/25 bg-primary/10 text-primary animate-in fade-in zoom-in-95 duration-100',
        className,
      )}
    >
      {shortcut}
    </Kbd>
  )
}
