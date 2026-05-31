import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { getAppVersion } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useUpdateStore } from '@/store/use-update-store'

export function AboutSettings() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [appVersion, setAppVersion] = useState<string>('')
  const {
    checkForUpdate,
    downloadAndInstall,
    restart,
    status: updateStatus,
    currentVersion,
    availableVersion,
    error,
    progress,
    lastChecked,
  } = useUpdateStore()

  useEffect(() => {
    void getAppVersion().then(setAppVersion)
  }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">{t('settings.about')}</h2>
        <p className="text-xs text-muted-foreground">Informations sur l'application</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">{t('settings.version')}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p>{t('settings.versionTooltip')}</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-xs font-mono font-medium">{currentVersion ?? appVersion}</span>
        </div>
        {availableVersion ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{t('settings.availableVersion')}</span>
            <span className="text-xs font-mono font-medium">{availableVersion}</span>
          </div>
        ) : null}
        
        {lastChecked && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{t('settings.lastCheck')}</span>
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(lastChecked)}
            </span>
          </div>
        )}
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={async () => {
                const info = await checkForUpdate()
                
                if (info?.available) {
                  toast({
                    title: t('settings.updateAvailable'),
                    description: t('settings.updateAvailableDesc'),
                  })
                } else if (!info) {
                  toast({
                    title: t('common.error'),
                    description: t('settings.updateError'),
                    variant: 'destructive',
                  })
                } else {
                  toast({
                    title: t('settings.noUpdate'),
                    description: t('settings.noUpdateDesc'),
                  })
                }
              }}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading' || updateStatus === 'installing'}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', updateStatus === 'checking' && 'animate-spin')} />
              {updateStatus === 'checking' ? t('settings.checking') : t('settings.checkForUpdates')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p>{t('settings.checkForUpdatesTooltip')}</p>
          </TooltipContent>
        </Tooltip>

        {updateStatus === 'available' ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              void downloadAndInstall()
            }}
          >
            {t('update.install')}
          </Button>
        ) : null}

        {updateStatus === 'downloading' || updateStatus === 'installing' ? (
          <p className="text-xs text-muted-foreground">
            {updateStatus === 'downloading'
              ? t('update.downloadingDesc', { version: availableVersion, progress: progress.toFixed(0) })
              : t('update.installing')}
          </p>
        ) : null}

        {updateStatus === 'downloaded' ? (
          <Button
            type="button"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              void restart()
            }}
          >
            {t('update.restart')}
          </Button>
        ) : null}

        {updateStatus === 'error' && error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
