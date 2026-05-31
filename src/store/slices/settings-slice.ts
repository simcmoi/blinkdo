import { setAutostartEnabled as setAutostartEnabledCommand, setGlobalShortcut as setGlobalShortcutCommand, updateSettings as updateSettingsCommand } from '@/lib/tauri'
import type { Settings } from '@/types/todo'

type Set = (state: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void
type Get = () => Record<string, unknown>

export function createSettingsSlice(set: Set, get: Get) {
  const mode = () => (get() as { storageMode: string }).storageMode
  const p = () => (get() as { storageProvider: { save: (d: unknown) => Promise<void>; getSyncStatus: () => string } | null }).storageProvider

  const handle = async <T>(local: () => Promise<T>, cloud: () => Promise<T>) => mode() === 'local' ? local() : cloud()

  return {
    updateSettings: async (partial: Partial<Settings>) => {
      set((state: Record<string, unknown>) => {
        const s = state as { settings: Settings }
        const merged: Settings = {
          ...s.settings,
          ...partial,
          soundSettings: partial.soundSettings
            ? { ...s.settings.soundSettings, ...partial.soundSettings }
            : s.settings.soundSettings,
        }
        return { settings: merged }
      })

      const mergedSettings = (get() as { settings: Settings }).settings

      await handle(
        async () => {
          const data = await updateSettingsCommand(mergedSettings)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const prov = p()
          if (!prov) throw new Error('Storage provider not initialized')
          await prov.save({ todos: (get() as { todos: unknown }).todos, settings: mergedSettings })
          set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },

    setGlobalShortcut: async (shortcut: string) => {
      await handle(
        async () => {
          const data = await setGlobalShortcutCommand(shortcut)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const prov = p()
          if (!prov) throw new Error('Storage provider not initialized')
          const settings = { ...(get() as { settings: Record<string, unknown> }).settings, globalShortcut: shortcut }
          set({ settings, error: null })
          await prov.save({ todos: (get() as { todos: unknown }).todos, settings })
          set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },

    setAutostartEnabled: async (enabled: boolean) => {
      await handle(
        async () => {
          const data = await setAutostartEnabledCommand(enabled)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const prov = p()
          if (!prov) throw new Error('Storage provider not initialized')
          const settings = { ...(get() as { settings: Record<string, unknown> }).settings, enableAutostart: enabled }
          set({ settings, error: null })
          await prov.save({ todos: (get() as { todos: unknown }).todos, settings })
          set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },
  }
}
