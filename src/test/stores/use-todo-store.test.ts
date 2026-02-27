import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTodoStore } from '@/store/use-todo-store'
import * as tauriApi from '@/lib/tauri'

vi.mock('@/lib/tauri')

describe('useTodoStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useTodoStore())
    
    expect(result.current.settings.sortMode).toBe('manual')
    expect(result.current.settings.themeMode).toBe('system')
    expect(result.current.todos).toEqual([])
    expect(result.current.hydrated).toBe(false)
  })

  it('should hydrate state from Tauri', async () => {
    const mockData = {
      todos: [
        { id: '1', title: 'Test Todo', createdAt: Date.now() },
      ],
      settings: {
        sortMode: 'recent' as const,
        sortOrder: 'desc' as const,
        autoCloseOnBlur: true,
        globalShortcut: 'Cmd+Shift+T',
        themeMode: 'dark' as const,
        activeListId: 'default',
        lists: [],
        labels: [],
        enableAutostart: false,
        enableSoundEffects: true,
        soundSettings: {
          enabled: true,
          onCreate: true,
          onComplete: true,
          onDelete: true,
        },
        language: 'auto',
      },
    }

    vi.mocked(tauriApi.loadState).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.hydrate()
    })

    expect(result.current.hydrated).toBe(true)
    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].title).toBe('Test Todo')
    expect(result.current.settings.sortMode).toBe('recent')
  })

  it('should handle hydration errors', async () => {
    vi.mocked(tauriApi.loadState).mockRejectedValue(new Error('Failed to load'))

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.hydrate()
    })

    expect(result.current.hydrated).toBe(true)
    expect(result.current.error).toBe('Impossible de charger les données locales')
  })

  it('should create a todo', async () => {
    const newTodo = {
      id: '1',
      title: 'New Task',
      createdAt: Date.now(),
    }

    const mockData = {
      todos: [newTodo],
      settings: {
        sortMode: 'manual' as const,
        sortOrder: 'asc' as const,
        autoCloseOnBlur: false,
        globalShortcut: '',
        themeMode: 'system' as const,
        activeListId: 'default',
        lists: [],
        labels: [],
        enableAutostart: false,
        enableSoundEffects: true,
        soundSettings: {
          enabled: true,
          onCreate: true,
          onComplete: true,
          onDelete: true,
        },
        language: 'auto',
      },
    }

    vi.mocked(tauriApi.createTodo).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.createTodo({
        title: 'New Task',
      })
    })

    expect(result.current.todos).toHaveLength(1)
    expect(result.current.todos[0].title).toBe('New Task')
  })

  it('should toggle todo completion', async () => {
    const mockData = {
      todos: [
        { id: '1', title: 'Test', createdAt: Date.now(), completedAt: Date.now() },
      ],
      settings: {
        sortMode: 'manual' as const,
        sortOrder: 'asc' as const,
        autoCloseOnBlur: false,
        globalShortcut: '',
        themeMode: 'system' as const,
        activeListId: 'default',
        lists: [],
        labels: [],
        enableAutostart: false,
        enableSoundEffects: true,
        soundSettings: {
          enabled: true,
          onCreate: true,
          onComplete: true,
          onDelete: true,
        },
        language: 'auto',
      },
    }

    vi.mocked(tauriApi.setTodoCompleted).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.setTodoCompleted('1', true)
    })

    expect(result.current.todos[0].completedAt).toBeDefined()
  })

  it('should update settings', async () => {
    const mockData = {
      todos: [],
      settings: {
        sortMode: 'title' as const,
        sortOrder: 'asc' as const,
        autoCloseOnBlur: false,
        globalShortcut: '',
        themeMode: 'light' as const,
        activeListId: 'default',
        lists: [],
        labels: [],
        enableAutostart: true,
        enableSoundEffects: true,
        soundSettings: {
          enabled: true,
          onCreate: true,
          onComplete: true,
          onDelete: true,
        },
        language: 'auto',
      },
    }

    vi.mocked(tauriApi.updateSettings).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.updateSettings({
        sortMode: 'title',
        themeMode: 'light',
        enableAutostart: true,
      })
    })

    expect(result.current.settings.sortMode).toBe('title')
    expect(result.current.settings.themeMode).toBe('light')
    expect(result.current.settings.enableAutostart).toBe(true)
  })

  it('should delete a todo', async () => {
    const mockData = {
      todos: [],
      settings: {
        sortMode: 'manual' as const,
        sortOrder: 'asc' as const,
        autoCloseOnBlur: false,
        globalShortcut: '',
        themeMode: 'system' as const,
        activeListId: 'default',
        lists: [],
        labels: [],
        enableAutostart: false,
        enableSoundEffects: true,
        soundSettings: {
          enabled: true,
          onCreate: true,
          onComplete: true,
          onDelete: true,
        },
        language: 'auto',
      },
    }

    vi.mocked(tauriApi.deleteTodo).mockResolvedValue(mockData)

    const { result } = renderHook(() => useTodoStore())
    
    await act(async () => {
      await result.current.deleteTodo('1')
    })

    expect(result.current.todos).toHaveLength(0)
  })
})
