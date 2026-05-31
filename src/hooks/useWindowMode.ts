import { useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'

export type WindowMode = 'main' | 'overlay'

function getWindowMode(): WindowMode {
  try {
    const window = getCurrentWindow()
    return window.label === 'overlay' ? 'overlay' : 'main'
  } catch {
    return 'main'
  }
}

export function useWindowMode(): WindowMode {
  const [mode] = useState<WindowMode>(getWindowMode)
  return mode
}
