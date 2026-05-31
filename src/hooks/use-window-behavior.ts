import { type RefObject, useEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { hideOverlay, isTauriRuntime } from '@/lib/tauri'

export function useWindowBehavior(
  autoCloseOnBlur: boolean,
  inputRef: RefObject<HTMLInputElement | null>,
  onWindowOpened?: () => void,
): void {
  const autoCloseRef = useRef(autoCloseOnBlur)

  useEffect(() => {
    autoCloseRef.current = autoCloseOnBlur
  }, [autoCloseOnBlur])

  // Auto-focus input when window becomes visible (Tauri event — single source of truth)
  useEffect(() => {
    if (!isTauriRuntime()) {
      window.dispatchEvent(new CustomEvent('tauri-window-focused'))
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
      return
    }

    let unlistenFocus: (() => void) | undefined
    let lastFocusTime = 0

    const handleFocus = () => {
      const now = Date.now()
      if (now - lastFocusTime < 100) return
      lastFocusTime = now

      window.dispatchEvent(new CustomEvent('tauri-window-focused'))
      onWindowOpened?.()
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    }

    const setupFocusListener = async () => {
      const tauriWindow = getCurrentWindow()
      unlistenFocus = await tauriWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) handleFocus()
      })
    }

    void setupFocusListener()

    return () => {
      unlistenFocus?.()
    }
  }, [inputRef, onWindowOpened])

  useEffect(() => {
    let isEditorOpen = false

    const handleEditorStateChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ isEditing: boolean }>
      isEditorOpen = customEvent.detail.isEditing
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!isEditorOpen) {
        event.preventDefault()
        if (isTauriRuntime()) {
          void hideOverlay()
        }
      }
    }

    const onBlur = () => {
      if (autoCloseRef.current && isTauriRuntime()) {
        void hideOverlay()
      }
    }

    window.addEventListener('todo-editor-state-changed', handleEditorStateChange)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('todo-editor-state-changed', handleEditorStateChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur)
    }
  }, [inputRef, onWindowOpened])
}
