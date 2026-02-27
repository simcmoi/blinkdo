import { ExternalLink, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { openAccessibilitySettings } from '@/lib/tauri'
import type { Settings } from '@/types/todo'

function keyFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (/^[a-z]$/i.test(event.key)) {
    return event.key.toUpperCase()
  }
  if (/^\d$/.test(event.key)) {
    return event.key
  }
  if (/^F\d{1,2}$/i.test(event.key)) {
    return event.key.toUpperCase()
  }

  switch (event.key) {
    case ' ':
      return 'Space'
    case 'Enter':
      return 'Enter'
    case 'Tab':
      return 'Tab'
    case 'Escape':
      return 'Escape'
    case 'Backspace':
      return 'Backspace'
    case 'Delete':
      return 'Delete'
    case 'ArrowUp':
      return 'Up'
    case 'ArrowDown':
      return 'Down'
    case 'ArrowLeft':
      return 'Left'
    case 'ArrowRight':
      return 'Right'
    default:
      return null
  }
}

type ShortcutsSettingsProps = {
  settings: Settings
  onSetGlobalShortcut: (shortcut: string) => Promise<void>
}

export function ShortcutsSettings({
  settings,
  onSetGlobalShortcut,
}: ShortcutsSettingsProps) {
  const { t } = useTranslation()
  const [shortcutDraft, setShortcutDraft] = useState(settings.globalShortcut)
  const [shortcutError, setShortcutError] = useState<string | null>(null)
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false)
  const [isSavingShortcut, setIsSavingShortcut] = useState(false)

  useEffect(() => {
    setShortcutDraft(settings.globalShortcut)
  }, [settings.globalShortcut])

  useEffect(() => {
    if (!isCapturingShortcut) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setIsCapturingShortcut(false)
        return
      }

      const key = keyFromKeyboardEvent(event)
      if (!key) {
        setShortcutError(t('settings.unsupportedKey'))
        return
      }

      const modifiers: string[] = []
      if (event.metaKey) {
        modifiers.push('CmdOrCtrl')
      }
      if (event.ctrlKey && !modifiers.includes('CmdOrCtrl')) {
        modifiers.push('Ctrl')
      }
      if (event.altKey) {
        modifiers.push('Alt')
      }
      if (event.shiftKey) {
        modifiers.push('Shift')
      }

      const combo = [...modifiers, key].join('+')
      setShortcutDraft(combo)
      setShortcutError(null)
      setIsCapturingShortcut(false)
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [isCapturingShortcut, t])

  const applyShortcut = async () => {
    setShortcutError(null)
    setIsSavingShortcut(true)
    try {
      await onSetGlobalShortcut(shortcutDraft.trim())
    } catch (error) {
      setShortcutError(error instanceof Error ? error.message : t('settings.invalidShortcut'))
    } finally {
      setIsSavingShortcut(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">{t('settings.globalShortcut')}</h2>
        <p className="text-xs text-muted-foreground">Configurez le raccourci clavier global pour ouvrir l'application</p>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('settings.shortcutExample')}: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">Shift+Space</code> {t('common.or')} <code className="rounded bg-muted px-1 py-0.5 text-[10px]">CmdOrCtrl+Shift+T</code>
        </p>
        
        <div className="flex gap-2">
          <Input
            value={shortcutDraft}
            onChange={(event) => {
              setShortcutDraft(event.currentTarget.value)
              setShortcutError(null)
            }}
            className="h-8 text-xs"
            placeholder="Shift+Space"
            aria-label={t('settings.globalShortcut')}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={isCapturingShortcut ? 'default' : 'outline'}
                className="h-8 px-2 text-xs"
                onClick={() => {
                  setShortcutError(null)
                  setIsCapturingShortcut((current) => !current)
                }}
              >
                {isCapturingShortcut ? t('settings.listening') : t('settings.capture')}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p>{t('settings.captureTooltip')}</p>
            </TooltipContent>
          </Tooltip>
          <Button
            type="button"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              void applyShortcut()
            }}
            disabled={isSavingShortcut}
          >
            {t('settings.apply')}
          </Button>
        </div>
        
        {shortcutError ? <p className="text-xs text-destructive">{shortcutError}</p> : null}
        
        {/* macOS fullscreen limitation info */}
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-orange-custom/30 bg-orange-custom/5 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 text-orange-custom dark:text-orange-light mt-0.5" />
            <div className="flex-1 space-y-1 text-xs">
              <p className="font-medium text-orange-dark dark:text-orange-light">
                {t('settings.fullscreenLimitationTitle')}
              </p>
              <p className="text-muted-foreground">
                {t('settings.fullscreenLimitationDescription')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs border-orange-custom/30 hover:bg-orange-custom/10"
            onClick={() => {
              void openAccessibilitySettings()
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            {t('settings.openAccessibilitySettings')}
          </Button>
        </div>
      </div>
    </div>
  )
}
