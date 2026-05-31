export type SortOrder = 'asc' | 'desc'
export type SortMode = 'manual' | 'recent' | 'oldest' | 'title' | 'dueDate'
export type ThemeMode = 'system' | 'light' | 'dark'
export type TodoPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type TodoStatus = 'todo' | 'inProgress' | 'waiting' | 'done'

export type TodoLabel = {
  id: string
  name: string
  color: 'slate' | 'blue' | 'green' | 'orange' | 'rose' | 'violet'
}

export type TodoListMeta = {
  id: string
  name: string
  icon?: string
  createdAt: number
}

export type Todo = {
  id: string
  title: string
  details?: string
  parentId?: string
  listId?: string
  starred?: boolean
  priority?: TodoPriority
  status?: TodoStatus
  labelId?: string
  sortIndex?: number
  createdAt: number
  completedAt?: number
  reminderAt?: number
}

export type SoundSettings = {
  enabled: boolean // Master toggle pour tous les sons
  onCreate: boolean // Son lors de la création d'une tâche
  onComplete: boolean // Son lors de la complétion d'une tâche
  onDelete: boolean // Son lors de la suppression d'une tâche
}

export type Settings = {
  sortMode: SortMode
  sortOrder: SortOrder
  autoCloseOnBlur: boolean
  globalShortcut: string
  themeMode: ThemeMode
  activeListId: string
  lists: TodoListMeta[]
  labels: TodoLabel[]
  enableAutostart: boolean
  enableSoundEffects: boolean // Deprecated - kept for backward compatibility
  soundSettings: SoundSettings
  language: string
}

export type AppData = {
  settings: Settings
  todos: Todo[]
}

export type ViewMode = 'active' | 'history'
