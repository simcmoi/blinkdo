import { create } from 'zustand'
import {
  clearCompletedInList as clearCompletedInListCommand,
  clearHistory as clearHistoryCommand,
  createList as createListCommand,
  createTodo as createTodoCommand,
  deleteTodo as deleteTodoCommand,
  moveTodoToList as moveTodoToListCommand,
  reorderTodos as reorderTodosCommand,
  renameList as renameListCommand,
  setListIcon as setListIconCommand,
  setActiveList as setActiveListCommand,
  setAutostartEnabled as setAutostartEnabledCommand,
  setTodoCompleted as setTodoCompletedCommand,
  setTodoLabel as setTodoLabelCommand,
  setTodoPriority as setTodoPriorityCommand,
  setTodoStarred as setTodoStarredCommand,
  setGlobalShortcut as setGlobalShortcutCommand,
  updateTodo as updateTodoCommand,
  updateSettings as updateSettingsCommand,
} from '@/lib/tauri'
import { createStorageProvider, type StorageProvider, type StorageMode, type SyncStatus } from '@/lib/storage'
import type { Settings, Todo, TodoPriority, ViewMode } from '@/types/todo'
import { ENABLE_CLOUD_FEATURES } from '@/config/features'

type TodoStore = {
  hydrated: boolean
  loading: boolean
  error: string | null
  todos: Todo[]
  settings: Settings
  view: ViewMode
  // Storage management
  storageMode: StorageMode
  syncStatus: SyncStatus
  storageProvider: StorageProvider | null
  setStorageMode: (mode: StorageMode) => Promise<void>
  // Auth (cloud mode)
  isAuthenticated: () => boolean
  getCurrentUserEmail: () => string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  // Data operations
  hydrate: () => Promise<void>
  setView: (view: ViewMode) => void
  createTodo: (payload: {
    title: string
    details?: string
    reminderAt?: number
    parentId?: string
    listId?: string
  }) => Promise<void>
  updateTodo: (payload: {
    id: string
    title: string
    details?: string
    reminderAt?: number
  }) => Promise<void>
  setTodoCompleted: (id: string, completed: boolean) => Promise<void>
  setTodoStarred: (id: string, starred: boolean) => Promise<void>
  setTodoPriority: (id: string, priority: TodoPriority) => Promise<void>
  setTodoLabel: (id: string, labelId?: string) => Promise<void>
  reorderTodos: (payload: {
    listId: string
    parentId?: string
    completed: boolean
    orderedIds: string[]
  }) => Promise<void>
  createList: (name: string) => Promise<void>
  renameList: (id: string, name: string) => Promise<void>
  setListIcon: (id: string, icon: string | undefined) => Promise<void>
  setActiveList: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  clearCompletedInList: (listId: string) => Promise<void>
  moveTodoToList: (id: string, listId: string) => Promise<void>
  updateSettings: (partial: Partial<Settings>) => Promise<void>
  setGlobalShortcut: (shortcut: string) => Promise<void>
  setAutostartEnabled: (enabled: boolean) => Promise<void>
}

const defaultSettings: Settings = {
  sortMode: 'manual',
  sortOrder: 'desc',
  autoCloseOnBlur: true,
  globalShortcut: 'Shift+Space',
  themeMode: 'system',
  activeListId: 'default',
  lists: [{ id: 'default', name: 'Mes tâches', createdAt: 0 }],
  labels: [{ id: 'general', name: 'Général', color: 'slate' }],
  enableAutostart: true,
  enableSoundEffects: true, // Deprecated - kept for backward compatibility
  soundSettings: {
    enabled: true,
    onCreate: true,
    onComplete: true,
    onDelete: true,
  },
  language: 'auto',
}

// Récupérer le mode de stockage depuis localStorage (par défaut: local)
const getStoredStorageMode = (): StorageMode => {
  // Si les fonctionnalités cloud sont désactivées, forcer le mode local
  if (!ENABLE_CLOUD_FEATURES) {
    return 'local'
  }

  try {
    const stored = localStorage.getItem('blinkdo-storage-mode')
    return (stored === 'cloud' ? 'cloud' : 'local') as StorageMode
  } catch {
    return 'local'
  }
}

const setStoredStorageMode = (mode: StorageMode) => {
  try {
    localStorage.setItem('blinkdo-storage-mode', mode)
  } catch (error) {
    console.error('Failed to store storage mode:', error)
  }
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  hydrated: false,
  loading: false,
  error: null,
  todos: [],
  settings: defaultSettings,
  view: 'active',
  storageMode: getStoredStorageMode(),
  syncStatus: 'idle',
  storageProvider: null,

  // Storage management
  setStorageMode: async (mode: StorageMode) => {
    // Si les fonctionnalités cloud sont désactivées, forcer le mode local
    const targetMode = !ENABLE_CLOUD_FEATURES ? 'local' : mode

    const currentProvider = get().storageProvider

    // Cleanup old provider
    if (currentProvider) {
      currentProvider.destroy()
    }

    // Create and initialize new provider
    const newProvider = createStorageProvider(targetMode)
    await newProvider.initialize()

    // Update state
    set({
      storageMode: targetMode,
      storageProvider: newProvider,
      syncStatus: newProvider.getSyncStatus(),
    })

    // Persist mode
    setStoredStorageMode(targetMode)

    // Reload data with new provider
    await get().hydrate()
  },

  // Auth methods
  isAuthenticated: () => {
    const provider = get().storageProvider
    return provider?.isAuthenticated() ?? false
  },

  getCurrentUserEmail: () => {
    const provider = get().storageProvider
    return provider?.getCurrentUser()?.email ?? null
  },

  signIn: async (email: string, password: string) => {
    const provider = get().storageProvider
    if (!provider) {
      throw new Error('Storage provider not initialized')
    }

    set({ loading: true, error: null })
    try {
      await provider.signIn(email, password)
      set({ loading: false })
      // Reload data after sign in
      await get().hydrate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed'
      set({ loading: false, error: message })
      throw error
    }
  },

  signUp: async (email: string, password: string) => {
    const provider = get().storageProvider
    if (!provider) {
      throw new Error('Storage provider not initialized')
    }

    set({ loading: true, error: null })
    try {
      await provider.signUp(email, password)
      set({ loading: false })
      // Reload data after sign up
      await get().hydrate()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed'
      set({ loading: false, error: message })
      throw error
    }
  },

  signOut: async () => {
    const provider = get().storageProvider
    if (!provider) {
      throw new Error('Storage provider not initialized')
    }

    set({ loading: true, error: null })
    try {
      await provider.signOut()
      set({
        loading: false,
        todos: [],
        settings: defaultSettings,
        hydrated: false,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      set({ loading: false, error: message })
      throw error
    }
  },

  // Data operations
  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      // Initialize storage provider if not already done
      let provider = get().storageProvider
      if (!provider) {
        const mode = get().storageMode
        provider = createStorageProvider(mode)
        await provider.initialize()
        set({ storageProvider: provider })
      }

      // Load data
      const data = await provider.load()
      
      // Migration: ajouter soundSettings si manquant
      const settings = {
        ...data.settings,
        soundSettings: data.settings.soundSettings ?? {
          enabled: data.settings.enableSoundEffects ?? true,
          onCreate: true,
          onComplete: true,
          onDelete: true,
        },
        // Migration: convertir les labels 'amber' en 'orange'
        labels: data.settings.labels.map(label => {
          const color = label.color as string
          return {
            ...label,
            color: color === 'amber' ? 'orange' : label.color
          }
        }) as typeof data.settings.labels
      }
      
      set({
        hydrated: true,
        loading: false,
        todos: data.todos,
        settings,
        syncStatus: provider.getSyncStatus(),
      })

      // Subscribe to realtime updates (cloud mode only)
      if (provider.mode === 'cloud' && provider.isAuthenticated()) {
        provider.subscribe((updatedData) => {
          set({
            todos: updatedData.todos,
            settings: updatedData.settings,
            syncStatus: provider.getSyncStatus(),
          })
        })
      }
    } catch (error) {
      set({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load todos',
      })
    }
  },

  setView: (view) => set({ view }),

  createTodo: async ({ title, details, reminderAt, parentId, listId }) => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }

    const provider = get().storageProvider
    const mode = get().storageMode

    try {
      // En mode local, utiliser les commandes Tauri existantes
      if (mode === 'local') {
        const data = await createTodoCommand(trimmedTitle, details, reminderAt, parentId, listId)
        set({ todos: data.todos, settings: data.settings, error: null })
      } else {
        // En mode cloud, utiliser le provider
        if (!provider) throw new Error('Storage provider not initialized')

        // Créer le todo localement d'abord (optimistic update)
        const newTodo: Todo = {
          id: crypto.randomUUID(),
          title: trimmedTitle,
          details,
          reminderAt,
          parentId,
          listId: listId || get().settings.activeListId,
          createdAt: Date.now(),
          starred: false,
          priority: 'none',
        }

        const currentTodos = get().todos
        set({ todos: [...currentTodos, newTodo], error: null })

        // Sauvegarder dans le cloud avec le state le plus récent
        await provider.save({
          todos: get().todos,
          settings: get().settings,
        })

        set({ syncStatus: provider.getSyncStatus() })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de créer la tâche'
      set({ error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  updateTodo: async ({ id, title, details, reminderAt }) => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }

    const provider = get().storageProvider
    const mode = get().storageMode

    try {
      if (mode === 'local') {
        const data = await updateTodoCommand(id, trimmedTitle, details, reminderAt)
        set({ todos: data.todos, settings: data.settings, error: null })
      } else {
        if (!provider) throw new Error('Storage provider not initialized')

        const currentTodos = get().todos
        const updatedTodos = currentTodos.map((todo) =>
          todo.id === id ? { ...todo, title: trimmedTitle, details, reminderAt } : todo
        )

        set({ todos: updatedTodos, error: null })

        await provider.save({
          todos: updatedTodos,
          settings: get().settings,
        })

        set({ syncStatus: provider.getSyncStatus() })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de mettre à jour la tâche'
      set({ error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  },

  setTodoCompleted: async (id, completed) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setTodoCompletedCommand(id, completed)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.map((todo) =>
        todo.id === id ? { ...todo, completedAt: completed ? Date.now() : undefined } : todo
      )

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  setTodoStarred: async (id, starred) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setTodoStarredCommand(id, starred)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.map((todo) => (todo.id === id ? { ...todo, starred } : todo))

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  setTodoPriority: async (id, priority) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setTodoPriorityCommand(id, priority)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.map((todo) => (todo.id === id ? { ...todo, priority } : todo))

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  setTodoLabel: async (id, labelId) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setTodoLabelCommand(id, labelId)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.map((todo) => (todo.id === id ? { ...todo, labelId } : todo))

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  reorderTodos: async ({ listId, parentId, completed, orderedIds }) => {
    if (orderedIds.length < 2) {
      return
    }

    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await reorderTodosCommand(listId, parentId, completed, orderedIds)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.map((todo) => {
        const index = orderedIds.indexOf(todo.id)
        if (index !== -1) {
          return { ...todo, sortIndex: index }
        }
        return todo
      })

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  createList: async (name) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await createListCommand(name)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const newList = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
      }

      const currentSettings = get().settings
      const updatedSettings = {
        ...currentSettings,
        lists: [...currentSettings.lists, newList],
      }

      set({ settings: updatedSettings, error: null })

      await provider.save({
        todos: get().todos,
        settings: updatedSettings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  renameList: async (id, name) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await renameListCommand(id, name)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentSettings = get().settings
      const updatedSettings = {
        ...currentSettings,
        lists: currentSettings.lists.map((list) => (list.id === id ? { ...list, name } : list)),
      }

      set({ settings: updatedSettings, error: null })

      await provider.save({
        todos: get().todos,
        settings: updatedSettings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  setListIcon: async (id, icon) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setListIconCommand(id, icon)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentSettings = get().settings
      const updatedSettings = {
        ...currentSettings,
        lists: currentSettings.lists.map((list) => (list.id === id ? { ...list, icon } : list)),
      }

      set({ settings: updatedSettings, error: null })

      await provider.save({
        todos: get().todos,
        settings: updatedSettings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  setActiveList: async (id) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setActiveListCommand(id)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const updatedSettings = {
        ...get().settings,
        activeListId: id,
      }

      set({ settings: updatedSettings, error: null })

      await provider.save({
        todos: get().todos,
        settings: updatedSettings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  deleteTodo: async (id) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await deleteTodoCommand(id)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.filter((todo) => todo.id !== id)

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  clearHistory: async () => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await clearHistoryCommand()
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.filter((todo) => !todo.completedAt)

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  clearCompletedInList: async (listId) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await clearCompletedInListCommand(listId)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.filter((todo) => todo.listId !== listId || !todo.completedAt)

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  moveTodoToList: async (id, listId) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await moveTodoToListCommand(id, listId)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const currentTodos = get().todos
      const updatedTodos = currentTodos.map((todo) => (todo.id === id ? { ...todo, listId } : todo))

      set({ todos: updatedTodos, error: null })

      await provider.save({
        todos: updatedTodos,
        settings: get().settings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  updateSettings: async (partial) => {
    const { storageProvider, storageMode } = get()

    // Use atomic state update to prevent race conditions
    set((state) => {
      // Deep merge for soundSettings
      const mergedSettings = {
        ...state.settings,
        ...partial,
        soundSettings: partial.soundSettings
          ? { ...state.settings.soundSettings, ...partial.soundSettings }
          : state.settings.soundSettings,
      }
      return { settings: mergedSettings }
    })

    const mergedSettings = get().settings

    if (storageMode === 'local') {
      const data = await updateSettingsCommand(mergedSettings)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!storageProvider) throw new Error('Storage provider not initialized')

      await storageProvider.save({
        todos: get().todos,
        settings: mergedSettings,
      })

      set({ syncStatus: storageProvider.getSyncStatus() })
    }
  },

  setGlobalShortcut: async (shortcut) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setGlobalShortcutCommand(shortcut)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const updatedSettings = {
        ...get().settings,
        globalShortcut: shortcut,
      }

      set({ settings: updatedSettings, error: null })

      await provider.save({
        todos: get().todos,
        settings: updatedSettings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },

  setAutostartEnabled: async (enabled) => {
    const provider = get().storageProvider
    const mode = get().storageMode

    if (mode === 'local') {
      const data = await setAutostartEnabledCommand(enabled)
      set({ todos: data.todos, settings: data.settings, error: null })
    } else {
      if (!provider) throw new Error('Storage provider not initialized')

      const updatedSettings = {
        ...get().settings,
        enableAutostart: enabled,
      }

      set({ settings: updatedSettings, error: null })

      await provider.save({
        todos: get().todos,
        settings: updatedSettings,
      })

      set({ syncStatus: provider.getSyncStatus() })
    }
  },
}))
