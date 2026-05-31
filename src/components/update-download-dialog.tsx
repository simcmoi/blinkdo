import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, CheckCircle2, AlertCircle, RotateCcw, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useUpdateStore } from '@/store/use-update-store'

type UpdateDownloadDialogProps = {
  version: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpdateDownloadDialog({ version, open, onOpenChange }: UpdateDownloadDialogProps) {
  const { t } = useTranslation()
  const { status, progress, downloadedBytes, totalBytes, error, restart } = useUpdateStore()
  const isDownloading = status === 'downloading'
  const isInstalling = status === 'installing'
  const isDownloaded = status === 'downloaded'
  const isError = status === 'error'
  const visibleStatus = isDownloaded ? 'downloaded' : isInstalling ? 'installing' : isError ? 'error' : 'downloading'
  
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }, [])

  const canClose = isError || isDownloaded

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !canClose) {
      // Empêcher la fermeture
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => !canClose && e.preventDefault()} 
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {visibleStatus === 'downloading' && <Download className="h-5 w-5 animate-bounce" />}
            {visibleStatus === 'installing' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {visibleStatus === 'downloaded' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {visibleStatus === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            {t(`update.status.${visibleStatus}`)}
          </DialogTitle>
          <DialogDescription>
            {visibleStatus === 'downloading' && t('update.downloadingVersion', { version })}
            {visibleStatus === 'installing' && t('update.installingVersion', { version })}
            {visibleStatus === 'downloaded' && t('update.downloadedVersion', { version })}
            {visibleStatus === 'error' && t('update.errorVersion', { version })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          {!isError && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          {/* Download info */}
          {isDownloading && totalBytes > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
              </span>
            </div>
          )}

          {/* Status messages */}
          <div className={`rounded-md p-3 text-sm ${isError ? 'bg-red-50 dark:bg-red-950' : 'bg-muted'}`}>
            {visibleStatus === 'downloading' && (
              <p className="text-muted-foreground">
                {t('update.downloadingMessage')}
              </p>
            )}
            {visibleStatus === 'installing' && (
              <p className="text-muted-foreground">
                {t('update.installingMessage')}
              </p>
            )}
            {visibleStatus === 'downloaded' && (
              <p className="text-muted-foreground">
                {t('update.downloadedMessage')}
              </p>
            )}
            {visibleStatus === 'error' && (
              <div className="space-y-2">
                <p className="font-medium text-red-700 dark:text-red-400">
                  {t('update.errorMessage')}
                </p>
                {error && (
                  <p className="text-xs text-red-600/80 dark:text-red-400/80">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>

          {(isError || isDownloaded) && (
            <div className="flex justify-end gap-2">
              {isDownloaded ? (
                <Button
                  size="sm"
                  onClick={() => {
                    void restart()
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('update.restart')}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="mr-2 h-4 w-4" />
                {t('common.close')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
