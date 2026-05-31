import type { Todo, Settings, AppData } from '@/types/todo'

export function createMockSettings(overrides?: Partial<Settings>): Settings {
  return {
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
    soundSettings: {
      enabled: true,
      onCreate: true,
      onComplete: true,
      onDelete: true,
    },
    language: 'auto',
    ...overrides,
  }
}

export function createMockData(overrides?: {
  todos?: Todo[]
  settings?: Partial<Settings>
}): AppData {
  return {
    todos: overrides?.todos ?? [],
    settings: createMockSettings(overrides?.settings),
  }
}
