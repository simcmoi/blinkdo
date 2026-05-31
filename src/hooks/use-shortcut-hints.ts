import { useContext } from 'react'
import { ShortcutHintsContext } from '@/components/shortcut-hints-context'

export function useShortcutHints() {
  return useContext(ShortcutHintsContext)
}
