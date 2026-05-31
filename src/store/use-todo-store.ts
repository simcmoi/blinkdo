import { create } from 'zustand'
import { type StorageProvider, type StorageMode, type SyncStatus } from '@/lib/storage'
import type { Settings, Todo, TodoPriority, ViewMode } from '@/types/todo'
import { ENABLE_CLOUD_FEATURES } from '@/config/features'
import { createTodoSlice } from './slices/todo-slice'
import { createListSlice } from './slices/list-slice'
import { createSettingsSlice } from './slices/settings-slice'
import { createStorageSlice } from './slices/storage-slice'
import { createAuthSlice } from './slices/auth-slice'

export type TodoStore = {
  hydrated: boolean
  loading: boolean
  error: string | null
  todos: Todo[]
  settings: Settings
  view: ViewMode
  storageMode: StorageMode
  syncStatus: SyncStatus
  storageProvider: StorageProvider | null
  setStorageMode: (mode: StorageMode) => Promise<void>
  isAuthenticated: () => boolean
  getCurrentUserEmail: () => string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hydrate: () => Promise<void>
  setView: (view: ViewMode) => void
  createTodo: (payload: { title: string; details?: string; reminderAt?: number; parentId?: string; listId?: string }) => Promise<void>
  updateTodo: (payload: { id: string; title: string; details?: string; reminderAt?: number }) => Promise<void>
  setTodoCompleted: (id: string, completed: boolean) => Promise<void>
  setTodoStarred: (id: string, starred: boolean) => Promise<void>
  setTodoPriority: (id: string, priority: TodoPriority) => Promise<void>
  setTodoLabel: (id: string, labelId?: string) => Promise<void>
  reorderTodos: (payload: { listId: string; parentId?: string; completed: boolean; orderedIds: string[] }) => Promise<void>
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
  enableSoundEffects: true,
  soundSettings: { enabled: true, onCreate: true, onComplete: true, onDelete: true },
  language: 'auto',
}

function getStoredStorageMode(): StorageMode {
  if (!ENABLE_CLOUD_FEATURES) return 'local'
  try {
    const stored = localStorage.getItem('blinkdo-storage-mode')
    return (stored === 'cloud' ? 'cloud' : 'local') as StorageMode
  } catch {
    return 'local'
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

  ...createTodoSlice(set, get),
  ...createListSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createStorageSlice(set, get),
  ...createAuthSlice(set, get),
}))
