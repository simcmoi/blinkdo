import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type { AppData, Settings, TodoPriority } from '@/types/todo'

export type UpdateInfo = {
  available: boolean
  currentVersion: string
  latestVersion?: string
  releaseDate?: string
  releaseNotes?: string
}

export async function loadState(): Promise<AppData> {
  return invoke<AppData>('load_state')
}

export async function addTodo(text: string): Promise<AppData> {
  return invoke<AppData>('add_todo', { text })
}

export async function createTodo(
  title: string,
  details: string | undefined,
  reminderAt: number | undefined,
  parentId: string | undefined,
  listId: string | undefined,
): Promise<AppData> {
  return invoke<AppData>('create_todo', {
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
  return invoke<AppData>('update_todo', {
    payload: {
      id,
      title,
      details: details ?? null,
      reminderAt: reminderAt ?? null,
    },
  })
}

export async function completeTodo(id: string): Promise<AppData> {
  return invoke<AppData>('complete_todo', { id })
}

export async function setTodoCompleted(
  id: string,
  completed: boolean,
): Promise<AppData> {
  return invoke<AppData>('set_todo_completed', { id, completed })
}

export async function setTodoStarred(
  id: string,
  starred: boolean,
): Promise<AppData> {
  return invoke<AppData>('set_todo_starred', { id, starred })
}

export async function setTodoPriority(
  id: string,
  priority: TodoPriority,
): Promise<AppData> {
  return invoke<AppData>('set_todo_priority', { id, priority })
}

export async function setTodoLabel(
  id: string,
  labelId: string | undefined,
): Promise<AppData> {
  return invoke<AppData>('set_todo_label', { id, labelId: labelId ?? null })
}

export async function deleteTodo(id: string): Promise<AppData> {
  return invoke<AppData>('delete_todo', { id })
}

export async function clearHistory(): Promise<AppData> {
  return invoke<AppData>('clear_history')
}

export async function updateSettings(settings: Settings): Promise<AppData> {
  return invoke<AppData>('update_settings', { settings })
}

export async function setGlobalShortcut(shortcut: string): Promise<AppData> {
  return invoke<AppData>('set_global_shortcut', { shortcut })
}

export async function setAutostartEnabled(enabled: boolean): Promise<AppData> {
  return invoke<AppData>('set_autostart_enabled', { enabled })
}

export async function createList(name: string): Promise<AppData> {
  return invoke<AppData>('create_list', { name })
}

export async function renameList(id: string, name: string): Promise<AppData> {
  return invoke<AppData>('rename_list', { id, name })
}

export async function setListIcon(id: string, icon: string | undefined): Promise<AppData> {
  return invoke<AppData>('set_list_icon', { id, icon: icon ?? null })
}

export async function setActiveList(id: string): Promise<AppData> {
  return invoke<AppData>('set_active_list', { id })
}

export async function moveTodoToList(
  id: string,
  listId: string,
): Promise<AppData> {
  return invoke<AppData>('move_todo_to_list', { id, listId })
}

export async function clearCompletedInList(listId: string): Promise<AppData> {
  return invoke<AppData>('clear_completed_in_list', { listId })
}

export async function reorderTodos(
  listId: string,
  parentId: string | undefined,
  completed: boolean,
  orderedIds: string[],
): Promise<AppData> {
  return invoke<AppData>('reorder_todos', {
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
  return invoke<AppData>('set_todo_reminder', { id, reminderAt: reminderAt ?? null })
}

export async function hideOverlay(): Promise<void> {
  await invoke('hide_overlay')
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  return invoke<UpdateInfo>('check_for_update')
}

export async function installUpdate(): Promise<void> {
  await invoke('install_update')
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>('get_app_version')
}

export async function getDataFilePath(): Promise<string> {
  return invoke<string>('get_data_file_path')
}

export async function openDataFile(): Promise<void> {
  await invoke('open_data_file')
}

export async function getLogFilePath(): Promise<string> {
  return invoke<string>('get_log_file_path')
}

export async function openLogFile(): Promise<void> {
  await invoke('open_log_file')
}

export async function resetAllData(): Promise<void> {
  await invoke('reset_all_data')
}

export async function getChangelog(version: string): Promise<string> {
  return invoke<string>('get_changelog', { version })
}

export async function openAccessibilitySettings(): Promise<void> {
  await invoke('open_accessibility_settings')
}

export async function setWindowWidth(width: number): Promise<void> {
  await invoke('set_window_width', { width })
}

export function isOverlayWindow(): boolean {
  const currentWindow = getCurrentWindow()
  return currentWindow.label === 'overlay'
}
