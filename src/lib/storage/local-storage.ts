import { loadState } from '@/lib/tauri'
import type { AppData } from '@/types/todo'
import type { StorageProvider, StorageMode, SyncStatus, AuthUser } from './types'

export class LocalStorageProvider implements StorageProvider {
  readonly mode: StorageMode = 'local'
  private syncStatus: SyncStatus = 'idle'
  
  isAuthenticated(): boolean {
    return false
  }
  
  getCurrentUser(): AuthUser | null {
    return null
  }
  
  getSyncStatus(): SyncStatus {
    return this.syncStatus
  }
  
  async initialize(): Promise<void> {
    // Rien à initialiser pour le mode local
  }
  
  async load(): Promise<AppData> {
    try {
      const data = await loadState()
      return data
    } catch (error) {
      console.error('Failed to load local data:', error)
      throw new Error('Impossible de charger les données locales', { cause: error })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(_data: AppData): Promise<void> {
    // IMPORTANT: En mode local, la persistence est gérée automatiquement
    // par les commandes Tauri individuelles (createTodo, updateTodo, deleteTodo, etc.)
    // qui sauvegardent directement dans le fichier JSON local.
    // Cette méthode save() existe uniquement pour respecter l'interface StorageProvider.
    // Ne pas implémenter de logique ici pour éviter les doubles écritures.
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signIn(_email: string, _password: string): Promise<void> {
    throw new Error('Authentication not available in local mode')
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async signUp(_email: string, _password: string): Promise<void> {
    throw new Error('Authentication not available in local mode')
  }
  
  async signOut(): Promise<void> {
    throw new Error('Authentication not available in local mode')
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribe(_callback: (data: AppData) => void): () => void {
    // Pas de sync en mode local
    return () => {}
  }
  
  destroy(): void {
    // Rien à nettoyer pour le mode local
  }
}
