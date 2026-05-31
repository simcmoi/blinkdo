import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTodoStore } from '@/store/use-todo-store'
import * as tauriApi from '@/lib/tauri'
import { createMockData, createMockSettings } from './helpers'
import type { Todo } from '@/types/todo'

vi.mock('@/lib/tauri')

const mockSettings = createMockSettings()

const storeInitialState = {
  hydrated: false,
  loading: false,
  error: null,
  todos: [] as Todo[],
  settings: createMockSettings(),
  view: 'active' as const,
  storageMode: 'local' as const,
  syncStatus: 'idle' as const,
  storageProvider: null,
}

const settingsFields = {
  sortMode: 'manual' as const,
  sortOrder: 'desc' as const,
  autoCloseOnBlur: true,
  globalShortcut: 'Shift+Space',
  themeMode: 'system' as const,
  activeListId: 'default',
  lists: [{ id: 'default', name: 'Mes tâches', createdAt: 0 }],
  labels: [{ id: 'general', name: 'Général', color: 'slate' as const }],
  enableAutostart: true,
  enableSoundEffects: true,
  soundSettings: { enabled: true, onCreate: true, onComplete: true, onDelete: true },
  language: 'auto',
}

describe('useTodoStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useTodoStore.setState(storeInitialState)
  })

  it('initialize with default settings', () => {
    const { result } = renderHook(() => useTodoStore())
    
    expect(result.current.settings.sortMode).toBe('manual')
    expect(result.current.settings.themeMode).toBe('system')
    expect(result.current.todos).toEqual([])
    expect(result.current.hydrated).toBe(false)
  })

  it('hydrate state from Tauri', async () => {
    const mockData = createMockData({
      todos: [{ id: '1', title: 'Test Todo', createdAt: Date.now() }],
      settings: { sortMode: 'recent', globalShortcut: 'Cmd+Shift+T', themeMode: 'dark' },
    })

    vi.mocked(tauriApi.loadState).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.hydrate() })

    expect(result.current.hydrated).toBe(true)
    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].title).toBe('Test Todo')
    expect(result.current.settings.sortMode).toBe('recent')
  })

  it('handle hydration errors', async () => {
    vi.mocked(tauriApi.loadState).mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.hydrate() })

    expect(result.current.hydrated).toBe(true)
    expect(result.current.error).toBe('Impossible de charger les données locales')
  })

  it('create a todo', async () => {
    const newTodo = { id: '1', title: 'New Task', createdAt: Date.now() }
    const mockData = createMockData({ todos: [newTodo] })

    vi.mocked(tauriApi.createTodo).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.createTodo({ title: 'New Task' }) })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].title).toBe('New Task')
  })

  it('reject empty title on create', async () => {
    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.createTodo({ title: '  ' }) })

    expect(result.current.todos).toHaveLength(0)
    expect(tauriApi.createTodo).not.toHaveBeenCalled()
  })

  it('reject whitespace-only title', async () => {
    const { result } = renderHook(() => useTodoStore())

    await act(async () => { await result.current.createTodo({ title: '\n  \n' }) })

    expect(result.current.todos).toHaveLength(0)
    expect(tauriApi.createTodo).not.toHaveBeenCalled()
  })

  it('toggle todo completion', async () => {
    const todo = { id: '1', title: 'Test', createdAt: Date.now(), completedAt: Date.now() }
    const mockData = createMockData({ todos: [todo] })

    vi.mocked(tauriApi.setTodoCompleted).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setTodoCompleted('1', true) })

    expect(result.current.todos[0].completedAt).toBeDefined()
  })

  it('star and unstar a todo', async () => {
    const todo = { id: '1', title: 'Test', createdAt: Date.now(), starred: true }
    const mockData = createMockData({ todos: [todo] })

    vi.mocked(tauriApi.setTodoStarred).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setTodoStarred('1', true) })

    expect(result.current.todos[0].starred).toBe(true)

    const unstarred = { ...todo, starred: false }
    vi.mocked(tauriApi.setTodoStarred).mockResolvedValue(createMockData({ todos: [unstarred] }))

    await act(async () => { await result.current.setTodoStarred('1', false) })

    expect(result.current.todos[0].starred).toBe(false)
  })

  it('set priority on a todo', async () => {
    const todo = { id: '1', title: 'Test', createdAt: Date.now(), priority: 'high' as const }
    const mockData = createMockData({ todos: [todo] })

    vi.mocked(tauriApi.setTodoPriority).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setTodoPriority('1', 'high') })

    expect(result.current.todos[0].priority).toBe('high')
  })

  it('set label on a todo', async () => {
    const todo = { id: '1', title: 'Test', createdAt: Date.now(), labelId: 'general' }
    const mockData = createMockData({ todos: [todo] })

    vi.mocked(tauriApi.setTodoLabel).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setTodoLabel('1', 'general') })

    expect(result.current.todos[0].labelId).toBe('general')
  })

  it('update todo details', async () => {
    const todo = { id: '1', title: 'Old', details: 'Old details', createdAt: Date.now() }
    const updated = { ...todo, title: 'Updated', details: 'New details', reminderAt: Date.now() + 3600000 }
    vi.mocked(tauriApi.updateTodo).mockResolvedValue(createMockData({ todos: [updated] }))

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.updateTodo({ id: '1', title: 'Updated', details: 'New details', reminderAt: Date.now() + 3600000 })
    })

    expect(result.current.todos[0].title).toBe('Updated')
    expect(result.current.todos[0].details).toBe('New details')
  })

  it('reject empty title on update', async () => {
    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.updateTodo({ id: '1', title: '  ' }) })

    expect(result.current.todos).toHaveLength(0)
  })

  it('create a list', async () => {
    const newList = { id: 'list-2', name: 'Work', createdAt: Date.now() }
    const mockData = createMockData({
      settings: { lists: [...mockSettings.lists, newList] },
    })

    vi.mocked(tauriApi.createList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.createList('Work') })

    expect(result.current.settings.lists).toHaveLength(2)
    expect(result.current.settings.lists[1].name).toBe('Work')
  })

  it('rename a list', async () => {
    const renamed = { id: 'default', name: 'Renamed', createdAt: 0 }
    const mockData = createMockData({
      settings: { lists: [renamed] },
    })

    vi.mocked(tauriApi.renameList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.renameList('default', 'Renamed') })

    expect(result.current.settings.lists[0].name).toBe('Renamed')
  })

  it('set list icon', async () => {
    const withIcon = { id: 'default', name: 'Mes tâches', icon: 'star', createdAt: 0 }
    const mockData = createMockData({
      settings: { lists: [withIcon] },
    })

    vi.mocked(tauriApi.setListIcon).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setListIcon('default', 'star') })

    expect(result.current.settings.lists[0].icon).toBe('star')
  })

  it('set active list', async () => {
    const list2 = { id: 'list-2', name: 'Work', createdAt: Date.now() }
    const mockData = createMockData({
      settings: { activeListId: 'list-2', lists: [mockSettings.lists[0], list2] },
    })

    vi.mocked(tauriApi.setActiveList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setActiveList('list-2') })

    expect(result.current.settings.activeListId).toBe('list-2')
  })

  it('move todo to another list', async () => {
    const todo = { id: '1', title: 'Test', createdAt: Date.now(), listId: 'list-2' }
    const mockData = createMockData({ todos: [todo] })

    vi.mocked(tauriApi.moveTodoToList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.moveTodoToList('1', 'list-2') })

    expect(result.current.todos[0].listId).toBe('list-2')
  })

  it('clear completed in list', async () => {
    const active = { id: '1', title: 'Active', createdAt: Date.now(), listId: 'default' }
    const completed = { id: '2', title: 'Done', createdAt: Date.now(), completedAt: Date.now(), listId: 'default' }
    const mockData = createMockData({ todos: [active] })

    vi.mocked(tauriApi.clearCompletedInList).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    result.current.todos.push(active, completed)

    await act(async () => { await result.current.clearCompletedInList('default') })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].id).toBe('1')
  })

  it('clear all history', async () => {
    const active = { id: '1', title: 'Active', createdAt: Date.now() }
    const completed = { id: '2', title: 'Done', createdAt: Date.now(), completedAt: Date.now() }
    const mockData = createMockData({ todos: [active] })

    vi.mocked(tauriApi.clearHistory).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    result.current.todos.push(active, completed)

    await act(async () => { await result.current.clearHistory() })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].completedAt).toBeUndefined()
  })

  it('reorder todos', async () => {
    const reordered = [
      { id: '2', title: 'Second', createdAt: 200, sortIndex: 0 },
      { id: '1', title: 'First', createdAt: 100, sortIndex: 1 },
    ]
    const mockData = createMockData({ todos: reordered })

    vi.mocked(tauriApi.reorderTodos).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.reorderTodos({ listId: 'default', completed: false, orderedIds: ['2', '1'] })
    })

    expect(result.current.todos[0].id).toBe('2')
  })

  it('update settings', async () => {
    const mockData = createMockData({
      settings: { sortMode: 'title', themeMode: 'light', enableAutostart: true },
    })

    vi.mocked(tauriApi.updateSettings).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.updateSettings({ sortMode: 'title', themeMode: 'light', enableAutostart: true })
    })

    expect(result.current.settings.sortMode).toBe('title')
    expect(result.current.settings.themeMode).toBe('light')
    expect(result.current.settings.enableAutostart).toBe(true)
  })

  it('set global shortcut', async () => {
    const mockData = createMockData({ settings: { globalShortcut: 'Cmd+Shift+K' } })

    vi.mocked(tauriApi.setGlobalShortcut).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setGlobalShortcut('Cmd+Shift+K') })

    expect(result.current.settings.globalShortcut).toBe('Cmd+Shift+K')
  })

  it('set autostart enabled', async () => {
    const mockData = createMockData({ settings: { enableAutostart: false } })

    vi.mocked(tauriApi.setAutostartEnabled).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.setAutostartEnabled(false) })

    expect(result.current.settings.enableAutostart).toBe(false)
  })

  it('deep-merge soundSettings on update', async () => {
    const merged = createMockSettings({ soundSettings: { enabled: true, onCreate: true, onComplete: false, onDelete: true } })
    vi.mocked(tauriApi.updateSettings).mockResolvedValue(createMockData({ settings: merged }))

    const { result } = renderHook(() => useTodoStore())

    await act(async () => {
      await result.current.updateSettings({ soundSettings: { enabled: true, onCreate: true, onComplete: false, onDelete: true } })
    })

    expect(result.current.settings.soundSettings.enabled).toBe(true)
    expect(result.current.settings.soundSettings.onCreate).toBe(true)
    expect(result.current.settings.soundSettings.onComplete).toBe(false)
    expect(result.current.settings.soundSettings.onDelete).toBe(true)
  })

  it('migrate deprecated enableSoundEffects to soundSettings', async () => {
    vi.mocked(tauriApi.loadState).mockResolvedValue({
      todos: [],
      settings: {
        ...settingsFields,
        enableSoundEffects: false,
        soundSettings: undefined as unknown as typeof settingsFields.soundSettings,
      },
    })

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.hydrate() })

    expect(result.current.settings.soundSettings.enabled).toBe(false)
    expect(result.current.settings.soundSettings.onCreate).toBe(true)
  })

  it('migrate label color amber → orange', async () => {
    vi.mocked(tauriApi.loadState).mockResolvedValue(createMockData({
      settings: {
        labels: [
          { id: 'general', name: 'Général', color: 'slate' },
          { id: 'test', name: 'Test', color: 'amber' as 'slate' },
        ],
      },
    }))

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => { await result.current.hydrate() })

    expect(result.current.settings.labels[1].color).toBe('orange')
    expect(result.current.settings.labels[0].color).toBe('slate')
  })

})
