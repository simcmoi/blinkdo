import { createList as createListCommand, renameList as renameListCommand, setListIcon as setListIconCommand, setActiveList as setActiveListCommand } from '@/lib/tauri'

type Set = (state: Record<string, unknown>) => void
type Get = () => Record<string, unknown>

export function createListSlice(set: Set, get: Get) {
  const mode = () => (get() as { storageMode: string }).storageMode
  const p = () => (get() as { storageProvider: { save: (d: unknown) => Promise<void>; getSyncStatus: () => string } | null }).storageProvider

  const handle = async <T>(local: () => Promise<T>, cloud: () => Promise<T>) => mode() === 'local' ? local() : cloud()

  return {
    createList: async (name: string) => {
      await handle(
        async () => { const data = await createListCommand(name); set({ todos: data.todos, settings: data.settings, error: null }) },
        async () => {
          const prov = p(); if (!prov) throw new Error('Storage provider not initialized')
          const lists = [...(get() as { settings: { lists: unknown[] } }).settings.lists, { id: crypto.randomUUID(), name, createdAt: Date.now() }]
          const settings = { ...(get() as { settings: Record<string, unknown> }).settings, lists }
          set({ settings, error: null }); await prov.save({ todos: (get() as { todos: unknown }).todos, settings }); set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },

    renameList: async (id: string, name: string) => {
      await handle(
        async () => { const data = await renameListCommand(id, name); set({ todos: data.todos, settings: data.settings, error: null }) },
        async () => {
          const prov = p(); if (!prov) throw new Error('Storage provider not initialized')
          const s = get() as { settings: { lists: { id: string; name: string }[] } }
          const settings = { ...s.settings, lists: s.settings.lists.map((l) => l.id === id ? { ...l, name } : l) }
          set({ settings, error: null }); await prov.save({ todos: (get() as { todos: unknown }).todos, settings }); set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },

    setListIcon: async (id: string, icon: string | undefined) => {
      await handle(
        async () => { const data = await setListIconCommand(id, icon); set({ todos: data.todos, settings: data.settings, error: null }) },
        async () => {
          const prov = p(); if (!prov) throw new Error('Storage provider not initialized')
          const s = get() as { settings: { lists: { id: string; icon?: string }[] } }
          const settings = { ...s.settings, lists: s.settings.lists.map((l) => l.id === id ? { ...l, icon } : l) }
          set({ settings, error: null }); await prov.save({ todos: (get() as { todos: unknown }).todos, settings }); set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },

    setActiveList: async (id: string) => {
      await handle(
        async () => { const data = await setActiveListCommand(id); set({ todos: data.todos, settings: data.settings, error: null }) },
        async () => {
          const prov = p(); if (!prov) throw new Error('Storage provider not initialized')
          const settings = { ...(get() as { settings: Record<string, unknown> }).settings, activeListId: id }
          set({ settings, error: null }); await prov.save({ todos: (get() as { todos: unknown }).todos, settings }); set({ syncStatus: prov.getSyncStatus() })
        },
      )
    },
  }
}
