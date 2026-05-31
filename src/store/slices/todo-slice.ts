import {
  clearCompletedInList as clearCompletedInListCommand,
  clearHistory as clearHistoryCommand,
  createTodo as createTodoCommand,
  deleteTodo as deleteTodoCommand,
  moveTodoToList as moveTodoToListCommand,
  reorderTodos as reorderTodosCommand,
  setTodoCompleted as setTodoCompletedCommand,
  setTodoLabel as setTodoLabelCommand,
  setTodoPriority as setTodoPriorityCommand,
  setTodoStarred as setTodoStarredCommand,
  updateTodo as updateTodoCommand,
} from '@/lib/tauri'
import { enqueue } from '@/store/operation-queue'
import type { Todo, TodoPriority } from '@/types/todo'

type Set = (state: Record<string, unknown>) => void
type Get = () => Record<string, unknown>

export function createTodoSlice(set: Set, get: Get) {
  const mode = () => (get() as { storageMode: string }).storageMode
  const provider = () => (get() as { storageProvider: { save: (d: unknown) => Promise<void>; getSyncStatus: () => string } | null }).storageProvider

  const handle = async <T>(local: () => Promise<T>, cloud: () => Promise<T>) => {
    const fn = mode() === 'local' ? local : cloud
    try {
      await enqueue(fn)
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Operation failed' })
    }
  }

  return {
    createTodo: async (payload: { title: string; details?: string; reminderAt?: number; parentId?: string; listId?: string }) => {
      const trimmedTitle = payload.title.trim()
      if (!trimmedTitle) return

      await handle(
        async () => {
          const data = await createTodoCommand(trimmedTitle, payload.details, payload.reminderAt, payload.parentId, payload.listId)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          const state = get() as { todos: Todo[]; settings: { activeListId: string } }
          const newTodo: Todo = { id: crypto.randomUUID(), title: trimmedTitle, details: payload.details, reminderAt: payload.reminderAt, parentId: payload.parentId, listId: payload.listId || state.settings.activeListId, createdAt: Date.now(), starred: false, priority: 'none' }
          set({ todos: [...state.todos, newTodo], error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    updateTodo: async (payload: { id: string; title: string; details?: string; reminderAt?: number }) => {
      const trimmedTitle = payload.title.trim()
      if (!trimmedTitle) return

      await handle(
        async () => {
          const data = await updateTodoCommand(payload.id, trimmedTitle, payload.details, payload.reminderAt)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          const todos = (get() as { todos: Todo[] }).todos.map((t) => t.id === payload.id ? { ...t, title: trimmedTitle, details: payload.details, reminderAt: payload.reminderAt } : t)
          set({ todos, error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    setTodoCompleted: async (id: string, completed: boolean) => {
      await handle(
        async () => {
          const data = await setTodoCompletedCommand(id, completed)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          const todos = (get() as { todos: Todo[] }).todos.map((t) => t.id === id ? { ...t, completedAt: completed ? Date.now() : undefined } : t)
          set({ todos, error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    setTodoStarred: async (id: string, starred: boolean) => {
      await handle(
        async () => {
          const data = await setTodoStarredCommand(id, starred)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.map((t) => t.id === id ? { ...t, starred } : t), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    setTodoPriority: async (id: string, priority: TodoPriority) => {
      await handle(
        async () => {
          const data = await setTodoPriorityCommand(id, priority)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.map((t) => t.id === id ? { ...t, priority } : t), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    setTodoLabel: async (id: string, labelId?: string) => {
      await handle(
        async () => {
          const data = await setTodoLabelCommand(id, labelId)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.map((t) => t.id === id ? { ...t, labelId } : t), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    reorderTodos: async (payload: { listId: string; parentId?: string; completed: boolean; orderedIds: string[] }) => {
      if (payload.orderedIds.length < 2) return

      await handle(
        async () => {
          const data = await reorderTodosCommand(payload.listId, payload.parentId, payload.completed, payload.orderedIds)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({
            todos: (get() as { todos: Todo[] }).todos.map((t) => {
              const index = payload.orderedIds.indexOf(t.id)
              return index !== -1 ? { ...t, sortIndex: index } : t
            }),
            error: null,
          })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    deleteTodo: async (id: string) => {
      await handle(
        async () => {
          const data = await deleteTodoCommand(id)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.filter((t) => t.id !== id), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    clearHistory: async () => {
      await handle(
        async () => {
          const data = await clearHistoryCommand()
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.filter((t) => !t.completedAt), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    clearCompletedInList: async (listId: string) => {
      await handle(
        async () => {
          const data = await clearCompletedInListCommand(listId)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.filter((t) => t.listId !== listId || !t.completedAt), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },

    moveTodoToList: async (id: string, listId: string) => {
      await handle(
        async () => {
          const data = await moveTodoToListCommand(id, listId)
          set({ todos: data.todos, settings: data.settings, error: null })
        },
        async () => {
          const p = provider()
          if (!p) throw new Error('Storage provider not initialized')
          set({ todos: (get() as { todos: Todo[] }).todos.map((t) => t.id === id ? { ...t, listId } : t), error: null })
          await p.save({ todos: (get() as { todos: Todo[] }).todos, settings: (get() as { settings: unknown }).settings })
          set({ syncStatus: p.getSyncStatus() })
        },
      )
    },
  }
}
