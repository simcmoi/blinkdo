import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { AppData, Settings, Todo, TodoPriority } from '@/types/todo'

const BROWSER_STATE_KEY = 'blinkdo-browser-dev-state'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

function defaultBrowserData(): AppData {
  return {
    todos: [],
    settings: {
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
    },
  }
}

function readBrowserData(): AppData {
  try {
    const raw = localStorage.getItem(BROWSER_STATE_KEY)
    if (!raw) return defaultBrowserData()
    const parsed = JSON.parse(raw) as AppData
    return {
      todos: parsed.todos ?? [],
      settings: { ...defaultBrowserData().settings, ...parsed.settings },
    }
  } catch {
    return defaultBrowserData()
  }
}

function writeBrowserData(data: AppData): AppData {
  localStorage.setItem(BROWSER_STATE_KEY, JSON.stringify(data))
  return data
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function handleBrowserInvoke<T>(cmd: string, args?: Record<string, unknown>): T {
  const data = readBrowserData()

  switch (cmd) {
    case 'load_state':
      return data as T
    case 'create_todo': {
      const title = asString(args?.title)?.trim()
      if (!title) return data as T
      const todo: Todo = {
        id: crypto.randomUUID(),
        title,
        details: asString(args?.details),
        reminderAt: asNumber(args?.reminderAt),
        parentId: asString(args?.parentId),
        listId: asString(args?.listId) ?? data.settings.activeListId,
        priority: 'none',
        createdAt: Date.now(),
        sortIndex: Date.now(),
      }
      return writeBrowserData({ ...data, todos: [todo, ...data.todos] }) as T
    }
    case 'update_todo': {
      const payload = args?.payload as Record<string, unknown> | undefined
      const id = asString(payload?.id)
      const title = asString(payload?.title)?.trim()
      if (!id || !title) return data as T
      return writeBrowserData({
        ...data,
        todos: data.todos.map((todo) => todo.id === id ? {
          ...todo,
          title,
          details: asString(payload?.details),
          reminderAt: asNumber(payload?.reminderAt),
        } : todo),
      }) as T
    }
    case 'set_todo_completed': {
      const id = asString(args?.id)
      const completed = Boolean(args?.completed)
      return writeBrowserData({
        ...data,
        todos: data.todos.map((todo) => todo.id === id ? {
          ...todo,
          completedAt: completed ? Date.now() : undefined,
        } : todo),
      }) as T
    }
    case 'complete_todo':
      return handleBrowserInvoke<T>('set_todo_completed', { id: args?.id, completed: true })
    case 'set_todo_starred': {
      const id = asString(args?.id)
      return writeBrowserData({
        ...data,
        todos: data.todos.map((todo) => todo.id === id ? { ...todo, starred: Boolean(args?.starred) } : todo),
      }) as T
    }
    case 'set_todo_priority': {
      const id = asString(args?.id)
      const priority = args?.priority as TodoPriority
      return writeBrowserData({
        ...data,
        todos: data.todos.map((todo) => todo.id === id ? { ...todo, priority } : todo),
      }) as T
    }
    case 'set_todo_label': {
      const id = asString(args?.id)
      return writeBrowserData({
        ...data,
        todos: data.todos.map((todo) => todo.id === id ? { ...todo, labelId: asString(args?.labelId) } : todo),
      }) as T
    }
    case 'delete_todo': {
      const id = asString(args?.id)
      return writeBrowserData({ ...data, todos: data.todos.filter((todo) => todo.id !== id && todo.parentId !== id) }) as T
    }
    case 'clear_history':
      return writeBrowserData({ ...data, todos: data.todos.filter((todo) => !todo.completedAt) }) as T
    case 'update_settings':
      return writeBrowserData({ ...data, settings: args?.settings as Settings }) as T
    case 'set_global_shortcut':
      return writeBrowserData({ ...data, settings: { ...data.settings, globalShortcut: asString(args?.shortcut) ?? data.settings.globalShortcut } }) as T
    case 'set_autostart_enabled':
      return writeBrowserData({ ...data, settings: { ...data.settings, enableAutostart: Boolean(args?.enabled) } }) as T
    case 'create_list': {
      const list = { id: crypto.randomUUID(), name: asString(args?.name) ?? 'Nouvelle liste', createdAt: Date.now() }
      return writeBrowserData({ ...data, settings: { ...data.settings, lists: [...data.settings.lists, list], activeListId: list.id } }) as T
    }
    case 'rename_list': {
      const id = asString(args?.id)
      const name = asString(args?.name)
      return writeBrowserData({
        ...data,
        settings: { ...data.settings, lists: data.settings.lists.map((list) => list.id === id && name ? { ...list, name } : list) },
      }) as T
    }
    case 'set_list_icon': {
      const id = asString(args?.id)
      return writeBrowserData({
        ...data,
        settings: { ...data.settings, lists: data.settings.lists.map((list) => list.id === id ? { ...list, icon: asString(args?.icon) } : list) },
      }) as T
    }
    case 'set_active_list':
      return writeBrowserData({ ...data, settings: { ...data.settings, activeListId: asString(args?.id) ?? data.settings.activeListId } }) as T
    case 'move_todo_to_list': {
      const id = asString(args?.id)
      const listId = asString(args?.listId)
      return writeBrowserData({ ...data, todos: data.todos.map((todo) => todo.id === id && listId ? { ...todo, listId } : todo) }) as T
    }
    case 'clear_completed_in_list': {
      const listId = asString(args?.listId)
      return writeBrowserData({ ...data, todos: data.todos.filter((todo) => !(todo.completedAt && (todo.listId ?? 'default') === listId)) }) as T
    }
    case 'reorder_todos': {
      const orderedIds = Array.isArray(args?.orderedIds) ? args.orderedIds.filter((id): id is string => typeof id === 'string') : []
      return writeBrowserData({
        ...data,
        todos: data.todos.map((todo) => {
          const index = orderedIds.indexOf(todo.id)
          return index >= 0 ? { ...todo, sortIndex: index } : todo
        }),
      }) as T
    }
    case 'set_todo_reminder': {
      const id = asString(args?.id)
      return writeBrowserData({ ...data, todos: data.todos.map((todo) => todo.id === id ? { ...todo, reminderAt: asNumber(args?.reminderAt) } : todo) }) as T
    }
    case 'check_for_update':
      return { available: false, currentVersion: 'dev-browser' } as T
    case 'get_app_version':
      return 'dev-browser' as T
    case 'get_data_file_path':
    case 'get_log_file_path':
    case 'get_changelog':
      return '' as T
    case 'hide_overlay':
    case 'install_update':
    case 'open_data_file':
    case 'open_log_file':
    case 'reset_all_data':
    case 'open_accessibility_settings':
    case 'set_window_width':
      return undefined as T
    default:
      throw new Error(`Unsupported browser dev command: ${cmd}`)
  }
}

function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriRuntime()) {
    return tauriInvoke<T>(cmd, args)
  }
  return Promise.resolve(handleBrowserInvoke<T>(cmd, args))
}

export type UpdateInfo = {
  available: boolean
  currentVersion: string
  latestVersion?: string
  releaseDate?: string
  releaseNotes?: string
}

export async function loadState(): Promise<AppData> {
  return safeInvoke<AppData>('load_state')
}

export async function addTodo(text: string): Promise<AppData> {
  return safeInvoke<AppData>('add_todo', { text })
}

export async function createTodo(
  title: string,
  details: string | undefined,
  reminderAt: number | undefined,
  parentId: string | undefined,
  listId: string | undefined,
): Promise<AppData> {
  return safeInvoke<AppData>('create_todo', {
    title,
    details: details ?? null,
    reminderAt: reminderAt ?? null,
    parentId: parentId ?? null,
    listId: listId ?? null,
  })
}

export async function updateTodo(
  id: string,
  title: string,
  details: string | undefined,
  reminderAt: number | undefined,
): Promise<AppData> {
  return safeInvoke<AppData>('update_todo', {
    payload: {
      id,
      title,
      details: details ?? null,
      reminderAt: reminderAt ?? null,
    },
  })
}

export async function completeTodo(id: string): Promise<AppData> {
  return safeInvoke<AppData>('complete_todo', { id })
}

export async function setTodoCompleted(
  id: string,
  completed: boolean,
): Promise<AppData> {
  return safeInvoke<AppData>('set_todo_completed', { id, completed })
}

export async function setTodoStarred(
  id: string,
  starred: boolean,
): Promise<AppData> {
  return safeInvoke<AppData>('set_todo_starred', { id, starred })
}

export async function setTodoPriority(
  id: string,
  priority: TodoPriority,
): Promise<AppData> {
  return safeInvoke<AppData>('set_todo_priority', { id, priority })
}

export async function setTodoLabel(
  id: string,
  labelId: string | undefined,
): Promise<AppData> {
  return safeInvoke<AppData>('set_todo_label', { id, labelId: labelId ?? null })
}

export async function deleteTodo(id: string): Promise<AppData> {
  return safeInvoke<AppData>('delete_todo', { id })
}

export async function clearHistory(): Promise<AppData> {
  return safeInvoke<AppData>('clear_history')
}

export async function updateSettings(settings: Settings): Promise<AppData> {
  return safeInvoke<AppData>('update_settings', { settings })
}

export async function setGlobalShortcut(shortcut: string): Promise<AppData> {
  return safeInvoke<AppData>('set_global_shortcut', { shortcut })
}

export async function setAutostartEnabled(enabled: boolean): Promise<AppData> {
  return safeInvoke<AppData>('set_autostart_enabled', { enabled })
}

export async function createList(name: string): Promise<AppData> {
  return safeInvoke<AppData>('create_list', { name })
}

export async function renameList(id: string, name: string): Promise<AppData> {
  return safeInvoke<AppData>('rename_list', { id, name })
}

export async function setListIcon(id: string, icon: string | undefined): Promise<AppData> {
  return safeInvoke<AppData>('set_list_icon', { id, icon: icon ?? null })
}

export async function setActiveList(id: string): Promise<AppData> {
  return safeInvoke<AppData>('set_active_list', { id })
}

export async function moveTodoToList(
  id: string,
  listId: string,
): Promise<AppData> {
  return safeInvoke<AppData>('move_todo_to_list', { id, listId })
}

export async function clearCompletedInList(listId: string): Promise<AppData> {
  return safeInvoke<AppData>('clear_completed_in_list', { listId })
}

export async function reorderTodos(
  listId: string,
  parentId: string | undefined,
  completed: boolean,
  orderedIds: string[],
): Promise<AppData> {
  return safeInvoke<AppData>('reorder_todos', {
    listId,
    parentId: parentId ?? null,
    completed,
    orderedIds,
  })
}

export async function setTodoReminder(
  id: string,
  reminderAt: number | undefined,
): Promise<AppData> {
  return safeInvoke<AppData>('set_todo_reminder', { id, reminderAt: reminderAt ?? null })
}

export async function hideOverlay(): Promise<void> {
  await safeInvoke('hide_overlay')
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  return safeInvoke<UpdateInfo>('check_for_update')
}

export async function installUpdate(): Promise<void> {
  await safeInvoke('install_update')
}

export async function getAppVersion(): Promise<string> {
  return safeInvoke<string>('get_app_version')
}

export async function getDataFilePath(): Promise<string> {
  return safeInvoke<string>('get_data_file_path')
}

export async function openDataFile(): Promise<void> {
  await safeInvoke('open_data_file')
}

export async function getLogFilePath(): Promise<string> {
  return safeInvoke<string>('get_log_file_path')
}

export async function openLogFile(): Promise<void> {
  await safeInvoke('open_log_file')
}

export async function resetAllData(): Promise<void> {
  await safeInvoke('reset_all_data')
}

export async function getChangelog(version: string): Promise<string> {
  return safeInvoke<string>('get_changelog', { version })
}

export async function openAccessibilitySettings(): Promise<void> {
  await safeInvoke('open_accessibility_settings')
}

export async function setWindowWidth(width: number): Promise<void> {
  await safeInvoke('set_window_width', { width })
}

export function isOverlayWindow(): boolean {
  try {
    const currentWindow = getCurrentWindow()
    return currentWindow.label === 'overlay'
  } catch {
    return false
  }
}
