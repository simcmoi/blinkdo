import { createStorageProvider } from '@/lib/storage'
import { ENABLE_CLOUD_FEATURES } from '@/config/features'
import type { StorageMode, StorageProvider } from '@/lib/storage'
import type { Settings, Todo } from '@/types/todo'

type Set = (state: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
type Get = () => Record<string, unknown>

export function createStorageSlice(set: Set, get: Get) {
  return {
    setStorageMode: async (mode: StorageMode) => {
      const targetMode = !ENABLE_CLOUD_FEATURES ? 'local' : mode
      const currentProvider = (get() as { storageProvider: StorageProvider | null }).storageProvider

      if (currentProvider) currentProvider.destroy()
      const newProvider = createStorageProvider(targetMode)
      await newProvider.initialize()

      set({ storageMode: targetMode, storageProvider: newProvider, syncStatus: newProvider.getSyncStatus() })

      try { localStorage.setItem('blinkdo-storage-mode', targetMode) } catch (e) { console.error('Failed to persist storage mode:', e) }

      await (get() as { hydrate: () => Promise<void> }).hydrate()
    },

    hydrate: async () => {
      set({ loading: true, error: null })
      try {
        let provider: StorageProvider | null = (get() as { storageProvider: StorageProvider | null }).storageProvider
        if (!provider) {
          const mode = (get() as { storageMode: string }).storageMode as StorageMode
          provider = createStorageProvider(mode)
          await provider.initialize()
          set({ storageProvider: provider })
        }

        const data = await provider.load()

        const settings = {
          ...data.settings,
          soundSettings: data.settings.soundSettings ?? {
            enabled: data.settings.enableSoundEffects ?? true,
            onCreate: true,
            onComplete: true,
            onDelete: true,
          },
          labels: data.settings.labels.map((label) => ({
            ...label,
            color: (label.color as string) === 'amber' ? 'orange' : label.color,
          })) as typeof data.settings.labels,
        }

        set({ hydrated: true, loading: false, todos: data.todos, settings, syncStatus: provider.getSyncStatus() })

        if (provider.mode === 'cloud' && provider.isAuthenticated()) {
          provider.subscribe((updatedData: unknown) => {
            set({
              todos: (updatedData as { todos: Todo[] }).todos,
              settings: (updatedData as { settings: Settings }).settings,
              syncStatus: provider.getSyncStatus(),
            })
          })
        }
      } catch (error) {
        set({ hydrated: true, loading: false, error: error instanceof Error ? error.message : 'Failed to load todos' })
      }
    },

    setView: (view: string) => set({ view }),
  }
}
