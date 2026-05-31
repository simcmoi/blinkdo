import { createContext } from 'react'

export type ShortcutHintsContextValue = {
  modifierLabel: string
  showHints: boolean
}

export const ShortcutHintsContext = createContext<ShortcutHintsContextValue>({
  modifierLabel: 'Ctrl',
  showHints: false,
})
