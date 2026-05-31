import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, CheckCircle2, AlertCircle, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

type UpdateDownloadDialogProps = {
  version: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ProgressPayload = {
  progress: number
  chunkLength: number
  contentLength: number
}

type Status = 'downloading' | 'installing' | 'restarting' | 'error'

export function UpdateDownloadDialog({ version, open, onOpenChange }: UpdateDownloadDialogProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [downloadedBytes, setDownloadedBytes] = useState(0)
  const [totalBytes, setTotalBytes] = useState(0)
  const [status, setStatus] = useState<Status>('downloading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  
  // Utiliser des refs pour le tracking du download speed
  const speedTrackingRef = useRef({
    lastUpdate: 0,
    lastBytes: 0
  })

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }, [])

  const formatSpeed = useCallback((bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }, [formatBytes])

  const formatETA = useCallback((speed: number, remaining: number): string => {
    if (speed <= 0 || remaining <= 0) return '—'
    const seconds = Math.round(remaining / speed)
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}min`
    return `${Math.round(seconds / 3600)}h`
  }, [])

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(0)
      setDownloadSpeed(0)
      setDownloadedBytes(0)
      setTotalBytes(0)
      setStatus('downloading')
      setErrorMessage('')
      return
    }

    speedTrackingRef.current = {
      lastUpdate: Date.now(),
      lastBytes: 0
    }

    let mounted = true
    let unlistenProgress: UnlistenFn | null = null
    let unlistenStatus: UnlistenFn | null = null
    let unlistenError: UnlistenFn | null = null

    const setupListeners = async () => {
      // Listen to download progress events
      if (!mounted) return
      unlistenProgress = await listen<ProgressPayload>('update-download-progress', (event) => {
        if (!mounted) return
        const { progress: progressPercent, chunkLength, contentLength } = event.payload
        setProgress(progressPercent)
        
        // Set total bytes
        if (contentLength > 0) {
          setTotalBytes(contentLength)
        }
        
        // Calculate download speed
        const now = Date.now()
        const timeDiff = (now - speedTrackingRef.current.lastUpdate) / 1000 // seconds
        
        if (timeDiff > 0.5) {
          const bytesDiff = chunkLength - speedTrackingRef.current.lastBytes
          const speed = bytesDiff / timeDiff // bytes per second
          
          // Only update if speed is positive
          if (speed > 0) {
            setDownloadSpeed(speed)
          }
          setDownloadedBytes(chunkLength)
          speedTrackingRef.current.lastUpdate = now
          speedTrackingRef.current.lastBytes = chunkLength
        }
      })

      if (!mounted) {
        if (unlistenProgress) unlistenProgress()
        return
      }

      // Listen to status change events
      unlistenStatus = await listen<string>('update-progress', (event) => {
        if (!mounted) return
        const newStatus = event.payload as Status
        setStatus(newStatus)
        
        if (newStatus === 'installing') {
          setProgress(100)
        }
      })

      if (!mounted) {
        if (unlistenProgress) unlistenProgress()
        if (unlistenStatus) unlistenStatus()
        return
      }

      // Listen to error events
      unlistenError = await listen<string>('update-error', (event) => {
        if (!mounted) return
        setStatus('error')
        setErrorMessage(event.payload)
      })
    }

    void setupListeners()

    return () => {
      mounted = false
      if (unlistenProgress) unlistenProgress()
      if (unlistenStatus) unlistenStatus()
      if (unlistenError) unlistenError()
    }
  }, [open])

  // Empêcher la fermeture pendant le téléchargement ou l'installation
  const canClose = status === 'error' || status === 'restarting'

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
            {status === 'downloading' && <Download className="h-5 w-5 animate-bounce" />}
            {status === 'installing' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {status === 'restarting' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            {t(`update.status.${status}`)}
          </DialogTitle>
          <DialogDescription>
            {status === 'downloading' && t('update.downloadingVersion', { version })}
            {status === 'installing' && t('update.installingVersion', { version })}
            {status === 'restarting' && t('update.restartingVersion', { version })}
            {status === 'error' && t('update.errorVersion', { version })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          {status !== 'error' && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.toFixed(1)}%
                </span>
                {status === 'downloading' && downloadSpeed > 0 && (
                  <span className="font-mono text-muted-foreground">
                    {formatSpeed(downloadSpeed)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Download info */}
          {status === 'downloading' && totalBytes > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
              </span>
              {downloadSpeed > 0 && (
                <span>
                  ETA: {formatETA(downloadSpeed, totalBytes - downloadedBytes)}
                </span>
              )}
            </div>
          )}

          {/* Status messages */}
          <div className={`rounded-md p-3 text-sm ${status === 'error' ? 'bg-red-50 dark:bg-red-950' : 'bg-muted'}`}>
            {status === 'downloading' && (
              <p className="text-muted-foreground">
                {t('update.downloadingMessage')}
              </p>
            )}
            {status === 'installing' && (
              <p className="text-muted-foreground">
                {t('update.installingMessage')}
              </p>
            )}
            {status === 'restarting' && (
              <p className="text-muted-foreground">
                {t('update.restartingMessage')}
              </p>
            )}
            {status === 'error' && (
              <div className="space-y-2">
                <p className="font-medium text-red-700 dark:text-red-400">
                  {t('update.errorMessage')}
                </p>
                {errorMessage && (
                  <p className="text-xs text-red-600/80 dark:text-red-400/80">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Close button for error state */}
          {status === 'error' && (
            <div className="flex justify-end">
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
