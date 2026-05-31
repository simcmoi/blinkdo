type Set = (state: Record<string, unknown>) => void
type Get = () => Record<string, unknown>

export function createAuthSlice(set: Set, get: Get) {
  const p = () => (get() as { storageProvider: { isAuthenticated: () => boolean; getCurrentUser: () => { email: string } | null; signIn: (e: string, p: string) => Promise<void>; signUp: (e: string, p: string) => Promise<void>; signOut: () => Promise<void> } | null }).storageProvider

  return {
    isAuthenticated: () => p()?.isAuthenticated() ?? false,

    getCurrentUserEmail: () => p()?.getCurrentUser()?.email ?? null,

    signIn: async (email: string, password: string) => {
      const prov = p()
      if (!prov) throw new Error('Storage provider not initialized')
      set({ loading: true, error: null })
      try {
        await prov.signIn(email, password)
        set({ loading: false })
        await (get() as { hydrate: () => Promise<void> }).hydrate()
      } catch (error) {
        set({ loading: false, error: error instanceof Error ? error.message : 'Sign in failed' })
        throw error
      }
    },

    signUp: async (email: string, password: string) => {
      const prov = p()
      if (!prov) throw new Error('Storage provider not initialized')
      set({ loading: true, error: null })
      try {
        await prov.signUp(email, password)
        set({ loading: false })
        await (get() as { hydrate: () => Promise<void> }).hydrate()
      } catch (error) {
        set({ loading: false, error: error instanceof Error ? error.message : 'Sign up failed' })
        throw error
      }
    },

    signOut: async () => {
      const prov = p()
      if (!prov) throw new Error('Storage provider not initialized')
      set({ loading: true, error: null })
      try {
        await prov.signOut()
        set({
          loading: false,
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
          hydrated: true,
        })
      } catch (error) {
        set({ loading: false, error: error instanceof Error ? error.message : 'Sign out failed' })
        throw error
      }
    },
  }
}
