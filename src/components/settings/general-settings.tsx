import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Settings } from '@/types/todo'

type GeneralSettingsProps = {
  settings: Settings
  onUpdateSettings: (partial: Partial<Settings>) => Promise<void>
  onSetAutostartEnabled: (enabled: boolean) => Promise<void>
}

export function GeneralSettings({
  settings,
  onUpdateSettings,
  onSetAutostartEnabled,
}: GeneralSettingsProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">{t('settings.general')}</h2>
        <p className="text-xs text-muted-foreground">Paramètres généraux de l'application</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">{t('settings.autoCloseOnBlur')}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p>{t('settings.autoCloseOnBlurTooltip')}</p>
            </TooltipContent>
          </Tooltip>
          <Switch
            checked={settings.autoCloseOnBlur}
            onCheckedChange={async (checked) => {
              await onUpdateSettings({ autoCloseOnBlur: checked })
            }}
          />
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">{t('settings.enableAutostart')}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p>{t('settings.enableAutostartTooltip')}</p>
            </TooltipContent>
          </Tooltip>
          <Switch
            checked={settings.enableAutostart}
            onCheckedChange={async (checked) => {
              await onSetAutostartEnabled(checked)
            }}
          />
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">{t('settings.enableSoundEffects')}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p>{t('settings.enableSoundEffectsTooltip')}</p>
            </TooltipContent>
          </Tooltip>
          <Switch
            checked={settings.soundSettings.enabled}
            onCheckedChange={async (checked) => {
              await onUpdateSettings({
                soundSettings: {
                  ...settings.soundSettings,
                  enabled: checked,
                }
              })
            }}
          />
        </div>
        
        {/* Sound sub-options */}
        {settings.soundSettings.enabled && (
          <div className="ml-4 space-y-3 border-l-2 border-border/50 pl-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t('settings.soundOnCreate')}</span>
              <Switch
                checked={settings.soundSettings.onCreate}
                onCheckedChange={async (checked) => {
                  await onUpdateSettings({
                    soundSettings: {
                      ...settings.soundSettings,
                      onCreate: checked,
                    }
                  })
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t('settings.soundOnComplete')}</span>
              <Switch
                checked={settings.soundSettings.onComplete}
                onCheckedChange={async (checked) => {
                  await onUpdateSettings({
                    soundSettings: {
                      ...settings.soundSettings,
                      onComplete: checked,
                    }
                  })
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{t('settings.soundOnDelete')}</span>
              <Switch
                checked={settings.soundSettings.onDelete}
                onCheckedChange={async (checked) => {
                  await onUpdateSettings({
                    soundSettings: {
                      ...settings.soundSettings,
                      onDelete: checked,
                    }
                  })
                }}
              />
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">{t('settings.sortMode')}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p>{t('settings.sortModeTooltip')}</p>
            </TooltipContent>
          </Tooltip>
          <Select
            value={settings.sortMode}
            onValueChange={async (value) => {
              await onUpdateSettings({ sortMode: value as typeof settings.sortMode })
            }}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t('settings.sortRecent')}</SelectItem>
              <SelectItem value="oldest">{t('settings.sortOldest')}</SelectItem>
              <SelectItem value="title">{t('settings.sortTitle')}</SelectItem>
              <SelectItem value="dueDate">{t('settings.sortDueDate')}</SelectItem>
              <SelectItem value="manual">{t('settings.sortManual')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
