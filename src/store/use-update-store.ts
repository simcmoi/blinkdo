import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { create } from 'zustand'
import { checkForUpdate, installUpdate, isTauriRuntime, restartApp, type UpdateInfo } from '@/lib/tauri'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not_available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

type ProgressPayload = {
  progress: number
  chunkLength: number
  contentLength: number
}

type UpdateStore = {
  status: UpdateStatus
  state: UpdateStatus
  currentVersion: string | null
  availableVersion: string | null
  releaseDate: string | null
  releaseNotes: string | null
  updateInfo: UpdateInfo | null
  error: string | null
  progress: number
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number
  lastChecked: Date | null
  listenersReady: boolean
  checkForUpdate: (options?: { silent?: boolean }) => Promise<UpdateInfo | null>
  downloadAndInstall: () => Promise<void>
  installUpdate: () => Promise<void>
  restart: () => Promise<void>
  reset: () => void
  dismissUpdate: () => void
  ensureListeners: () => Promise<void>
}

let listenersPromise: Promise<void> | null = null
let unlisteners: UnlistenFn[] = []

function setStatus(status: UpdateStatus, patch: Partial<UpdateStore> = {}) {
  useUpdateStore.setState({ status, state: status, ...patch })
}

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: 'idle',
  state: 'idle',
  currentVersion: null,
  availableVersion: null,
  releaseDate: null,
  releaseNotes: null,
  updateInfo: null,
  error: null,
  progress: 0,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  lastChecked: null,
  listenersReady: false,

  ensureListeners: async () => {
    if (!isTauriRuntime()) {
      set({ listenersReady: true })
      return
    }

    if (listenersPromise) {
      await listenersPromise
      return
    }

    listenersPromise = (async () => {
      unlisteners.forEach((unlisten) => unlisten())
      unlisteners = []

      unlisteners.push(await listen<ProgressPayload>('update-download-progress', (event) => {
        const progress = Math.max(0, Math.min(100, event.payload.progress))
        set({
          progress,
          downloadProgress: progress,
          downloadedBytes: event.payload.chunkLength,
          totalBytes: event.payload.contentLength,
        })
      }))

      unlisteners.push(await listen<string>('update-progress', (event) => {
        const status = event.payload
        if (status === 'downloading') {
          setStatus('downloading', { error: null, progress: 0, downloadProgress: 0, downloadedBytes: 0, totalBytes: 0 })
          return
        }
        if (status === 'installing') {
          setStatus('installing', { progress: 100, downloadProgress: 100 })
          return
        }
        if (status === 'downloaded') {
          setStatus('downloaded', { progress: 100, downloadProgress: 100 })
        }
      }))

      unlisteners.push(await listen<string>('update-error', (event) => {
        setStatus('error', { error: event.payload })
      }))

      set({ listenersReady: true })
    })()

    await listenersPromise
  },

  checkForUpdate: async (options) => {
    setStatus('checking', { error: null })

    try {
      const info = await checkForUpdate()
      const now = new Date()
      const next = {
        currentVersion: info.currentVersion,
        availableVersion: info.latestVersion ?? null,
        releaseDate: info.releaseDate ?? null,
        releaseNotes: info.releaseNotes ?? null,
        updateInfo: info,
        lastChecked: now,
      }

      if (info.available) {
        setStatus('available', next)
      } else {
        setStatus(options?.silent ? 'idle' : 'not_available', next)
      }

      return info
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de la vérification des mises à jour'
      setStatus(options?.silent ? 'idle' : 'error', { error: message, lastChecked: new Date() })
      return null
    }
  },

  downloadAndInstall: async () => {
    const { updateInfo, ensureListeners } = get()
    if (!updateInfo?.available) {
      setStatus('error', { error: 'Aucune mise à jour disponible' })
      return
    }

    await ensureListeners()
    setStatus('downloading', {
      progress: 0,
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: null,
    })

    try {
      await installUpdate()
      const current = get()
      if (current.status !== 'error') {
        setStatus('downloaded', { progress: 100, downloadProgress: 100 })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Échec de l’installation de la mise à jour'
      setStatus('error', { error: message })
    }
  },

  installUpdate: async () => {
    await get().downloadAndInstall()
  },

  restart: async () => {
    await restartApp()
  },

  reset: () => {
    setStatus('idle', {
      updateInfo: null,
      error: null,
      progress: 0,
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
    })
  },

  dismissUpdate: () => {
    get().reset()
  },
}))
