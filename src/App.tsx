import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, Columns3, Home, List, Plus, Settings } from 'lucide-react'
import { motion } from 'framer-motion'
import { listen } from '@tauri-apps/api/event'
import { useTranslation } from 'react-i18next'
import { SettingsPage } from '@/components/settings-page'
import { StatisticsPage } from '@/components/statistics-page'
import { KanbanBoard } from '@/components/kanban-board'
import { TodoList } from '@/components/todo-list'
import { UpdateBanner } from '@/components/update-banner'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { AppFooter } from '@/features/todos/components/AppFooter'
import { ListSettingsMenu } from '@/features/todos/components/ListSettingsMenu'
import { IconPicker, getIconComponent } from '@/components/icon-picker'
import { Toaster } from '@/components/ui/toaster'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useWindowBehavior } from '@/hooks/use-window-behavior'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { useTodoStore } from '@/store/use-todo-store'
import { useUpdateStore } from '@/store/use-update-store'
import { useFilteredTodos } from '@/hooks/useFilteredTodos'
import { setWindowWidth, isOverlayWindow, isTauriRuntime } from '@/lib/tauri'
import { cn } from '@/lib/utils'

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const listNameInputRef = useRef<HTMLInputElement>(null)
  const [renamingListId, setRenamingListId] = useState<string | null>(null)
  const [listNameDraft, setListNameDraft] = useState('')
  const [settingsPageOpen, setSettingsPageOpen] = useState(false)
  const [statisticsPageOpen, setStatisticsPageOpen] = useState(false)
  const [todoViewMode, setTodoViewMode] = useState<'list' | 'kanban'>('list')

  const { toast } = useToast()
  const { playAdd, playDelete, playComplete } = useSoundEffects()
  const { t, i18n } = useTranslation()

  const {
    hydrated,
    loading,
    error,
    todos,
    settings,
    hydrate,
    createTodo,
    createList,
    deleteTodo,
    clearCompletedInList,
    moveTodoToList,
    reorderTodos,
    renameList,
    setListIcon,
    setActiveList,
    setTodoCompleted,
    setTodoLabel,
    setTodoPriority,
    setTodoStatus,
    setTodoStarred,
    setGlobalShortcut,
    setAutostartEnabled,
    updateSettings,
    updateTodo,
  } = useTodoStore()

  const { checkForUpdate, ensureListeners } = useUpdateStore()

  const {
    activeList,
    favoritesOnly,
    priorityFilter,
    labelFilterId: effectiveLabelFilterId,
    sortedTodos,
    visibleTodos,
    activeTodos,
    completedTodos,
    canReorder: canReorderBase,
    PRIORITY_FILTERS,
    SORT_MODE_OPTIONS,
    setFavoritesOnly,
    setPriorityFilter,
    setLabelFilterId,
  } = useFilteredTodos(todos, settings)

  const canReorder = !settingsPageOpen && canReorderBase

  // Sync language with i18n when settings change
  useEffect(() => {
    if (!settings.language) return

    let targetLanguage = settings.language

    // Si la langue est "auto", détecter la langue du système
    if (targetLanguage === 'auto') {
      // Récupérer la langue du navigateur/système
      const browserLang = navigator.language.split('-')[0] // ex: "fr-FR" -> "fr"
      const supportedLanguages = ['en', 'fr', 'es', 'zh', 'hi']
      
      // Utiliser la langue du navigateur si supportée, sinon anglais
      targetLanguage = supportedLanguages.includes(browserLang) ? browserLang : 'en'
    }

    // Changer la langue seulement si elle est différente
    if (i18n.language !== targetLanguage) {
      void i18n.changeLanguage(targetLanguage)
    }
  }, [settings.language, i18n])

  useWindowBehavior(settings.autoCloseOnBlur, inputRef)

  // Détection du premier lancement
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      const hasCompletedOnboarding = localStorage.getItem('blinkdo-onboarding-completed')
      return hasCompletedOnboarding !== 'true'
    } catch {
      return false
    }
  })

  const handleOnboardingComplete = () => {
    try {
      localStorage.setItem('blinkdo-onboarding-completed', 'true')
      setShowOnboarding(false)
    } catch (error) {
      console.error('Failed to save onboarding completion:', error)
      setShowOnboarding(false)
    }
  }

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  // Initialize window width on mount (only once after hydration)
  useEffect(() => {
    const initializeWindowWidth = async () => {
      if (!hydrated) return
      
      try {
        const defaultWidth = isOverlayWindow() ? 500 : 800
        const settingsWidth = isOverlayWindow() ? 780 : 1200
        await setWindowWidth(settingsPageOpen ? settingsWidth : defaultWidth)
      } catch (error) {
        console.error('Failed to initialize window width:', error)
      }
    }
    
    void initializeWindowWidth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  // Listen for data-reset event from backend
  useEffect(() => {
    if (!isTauriRuntime()) return

    const unlisten = listen('data-reset', () => {
      console.log('🔄 Data reset event received!')
      
      // Clear onboarding flag to show it again
      try {
        localStorage.removeItem('blinkdo-onboarding-completed')
        console.log('✅ Onboarding flag cleared from localStorage')
        setShowOnboarding(true)
        console.log('✅ showOnboarding set to true')
      } catch (error) {
        console.error('❌ Failed to clear onboarding flag:', error)
      }
      
      // Show success toast
      toast({
        title: t('toast.dataDeleted'),
        description: t('toast.dataDeletedDesc'),
      })
      console.log('✅ Toast displayed')
      
      // Rehydrate state
      void hydrate()
      console.log('✅ State rehydrated')
      
      // Close settings page if open
      setSettingsPageOpen(false)
      console.log('✅ Settings page closed')
    })

    return () => {
      void unlisten.then(fn => fn())
    }
  }, [hydrate, toast, t])

  // Vérifier les mises à jour au démarrage sans interrompre l'utilisateur
  useEffect(() => {
    if (!hydrated) return

    void ensureListeners()
    const timeout = window.setTimeout(() => {
      void checkForUpdate({ silent: true })
    }, 8000)

    return () => window.clearTimeout(timeout)
  }, [hydrated, checkForUpdate, ensureListeners])

  // Vérifier les mises à jour périodiquement (toutes les 24h)
  useEffect(() => {
    if (!hydrated) return

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const interval = setInterval(() => {
      void checkForUpdate({ silent: true })
    }, TWENTY_FOUR_HOURS)

    return () => clearInterval(interval)
  }, [hydrated, checkForUpdate])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark')
    if (settings.themeMode === 'light') {
      root.classList.add('theme-light')
    }
    if (settings.themeMode === 'dark') {
      root.classList.add('theme-dark')
    }
  }, [settings.themeMode])

  const persistListRename = async () => {
    if (!activeList || renamingListId !== activeList.id) {
      setRenamingListId(null)
      return
    }

    const normalizedName = listNameDraft.trim() || 'Nouvelle liste'
    if (listNameInputRef.current) {
      listNameInputRef.current.value = normalizedName
    }

    if (normalizedName !== activeList.name) {
      await renameList(activeList.id, normalizedName)
    }

    setRenamingListId(null)
  }

  const selectedSortModeLabel = useMemo(
    () => SORT_MODE_OPTIONS.find((option) => option.id === settings.sortMode)?.label ?? 'Récemment ajoutées',
    [settings.sortMode, SORT_MODE_OPTIONS],
  )

  const printCurrentList = () => {
    if (!activeList) {
      return
    }

    const popup = window.open('', '_blank', 'width=900,height=700')
    if (!popup) {
      return
    }

    const escapeHtml = (value: string): string =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')

    const printableActive = sortedTodos.filter((todo) => typeof todo.completedAt !== 'number')
    const printableCompleted = sortedTodos.filter((todo) => typeof todo.completedAt === 'number')

    const activeRows = printableActive
      .map((todo) => `<li>${escapeHtml(todo.title)}</li>`)
      .join('')
    const completedRows = printableCompleted
      .map((todo) => `<li style="color:#666;text-decoration:line-through">${escapeHtml(todo.title)}</li>`)
      .join('')

    popup.document.write(`
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(activeList.name)}</title>
          <style>
            body { font-family: Inter, -apple-system, sans-serif; margin: 24px; color: #111; }
            h1 { font-size: 20px; margin: 0 0 12px; }
            h2 { font-size: 14px; margin: 18px 0 8px; color: #444; }
            ul { margin: 0; padding-left: 20px; }
            li { margin: 4px 0; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(activeList.name)}</h1>
          <h2>${t('todo.activeTasks')}</h2>
          <ul>${activeRows || `<li>${t('app.noActiveTasks')}</li>`}</ul>
          <h2>${t('todo.completedTasks')}</h2>
          <ul>${completedRows || `<li>${t('todo.noCompletedTasks')}</li>`}</ul>
        </body>
      </html>
    `)
    popup.document.close()
    popup.focus()
    popup.print()
    popup.close()
  }

  // Afficher l'onboarding si nécessaire
  if (showOnboarding) {
    return (
      <>
        <Onboarding onComplete={handleOnboardingComplete} />
        <Toaster />
      </>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <main className="h-screen w-screen bg-transparent p-2.5 text-foreground">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="mx-auto flex h-full w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-white/70 bg-card shadow-[0_18px_60px_rgba(15,23,42,0.24),0_0_0_1px_rgba(15,23,42,0.10)] ring-1 ring-black/5 dark:border-white/10 dark:shadow-[0_18px_70px_rgba(0,0,0,0.50),0_0_0_1px_rgba(255,255,255,0.08)] dark:ring-white/10"
        >
        <UpdateBanner />
        {/* Header: current list and global actions */}
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/app-icon.png" alt="BlinkDo" className="h-4 w-4 rounded-sm" />
            {activeList && renamingListId === activeList.id ? (
              <div className="flex items-center gap-1">
                <IconPicker
                  value={activeList.icon}
                  onValueChange={(icon) => {
                    void setListIcon(activeList.id, icon)
                  }}
                />
                <Input
                  ref={listNameInputRef}
                  value={listNameDraft}
                  onChange={(event) => {
                    setListNameDraft(event.currentTarget.value)
                  }}
                  onBlur={() => {
                    void persistListRename()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setRenamingListId(null)
                    }
                  }}
                  className="h-7 max-w-[220px] border-none bg-transparent px-1 text-sm font-medium shadow-none focus-visible:ring-0"
                  aria-label={t('list.renameList')}
                  placeholder={t('list.listName')}
                  autoFocus
                />
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 max-w-[220px] justify-start gap-1.5 px-1 text-sm font-semibold text-foreground"
                  >
                    {activeList && (() => {
                      const Icon = getIconComponent(activeList.icon)
                      return <Icon className="h-3.5 w-3.5 shrink-0" />
                    })()}
                    <span className="truncate">{activeList?.name ?? t('list.myTasks')}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>{t('list.lists')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {settings.lists.map((list) => {
                    const Icon = getIconComponent(list.icon)
                    const listTodos = todos.filter((todo) => (todo.listId ?? settings.lists[0]?.id) === list.id)
                    const activeTodosCount = listTodos.filter((todo) => !todo.completedAt).length
                    const completedTodosCount = listTodos.filter((todo) => todo.completedAt).length
                    return (
                      <DropdownMenuItem
                        key={list.id}
                        onSelect={() => {
                          void setActiveList(list.id)
                        }}
                        className={cn(
                          'flex items-center gap-2',
                          list.id === activeList?.id ? 'font-medium' : undefined
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">{list.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {activeTodosCount} / {completedTodosCount}
                        </span>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  {activeList ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenamingListId(activeList.id)
                        setListNameDraft(activeList.name)
                      }}
                    >
                      {t('list.renameList')}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await createList(t('list.newList'))
                  }}
                  aria-label={t('list.addList')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('list.addList')}</p>
              </TooltipContent>
            </Tooltip>
            <ListSettingsMenu
              activeList={activeList}
              sortMode={settings.sortMode}
              sortModeOptions={SORT_MODE_OPTIONS}
              favoritesOnly={favoritesOnly}
              priorityFilter={priorityFilter}
              effectiveLabelFilterId={effectiveLabelFilterId}
              labels={settings.labels}
              priorityFilters={PRIORITY_FILTERS}
              onSetSortMode={(mode) => void updateSettings({ sortMode: mode })}
              onRenameList={() => {
                if (!activeList) return
                setRenamingListId(activeList.id)
                setListNameDraft(activeList.name)
              }}
              onPrintList={printCurrentList}
              onOpenStatistics={() => setStatisticsPageOpen(true)}
              onClearCompleted={() => { if (activeList) void clearCompletedInList(activeList.id) }}
              onSetFavoritesOnly={setFavoritesOnly}
              onSetPriorityFilter={setPriorityFilter}
              onSetLabelFilterId={setLabelFilterId}
              onResetFilters={() => {
                setFavoritesOnly(false)
                setPriorityFilter('all')
                setLabelFilterId('all')
              }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="mr-1 flex rounded-md border border-border/80 bg-background p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={todoViewMode === 'list' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setTodoViewMode('list')}
                    aria-label={t('view.list')}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('view.list')}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={todoViewMode === 'kanban' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setTodoViewMode('kanban')}
                    aria-label={t('view.kanban')}
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('view.kanban')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Badge variant="outline" className="h-6 rounded-md border-border/80 bg-background px-1.5 text-[11px] font-medium text-muted-foreground">
              <Circle className="h-2.5 w-2.5 fill-primary/20 text-primary" />
              {activeTodos.length}
            </Badge>
            <Badge variant="outline" className="h-6 rounded-md border-border/80 bg-background px-1.5 text-[11px] font-medium text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {completedTodos.length}
            </Badge>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const newState = !settingsPageOpen
                  setSettingsPageOpen(newState)
                  // Resize window based on context
                  // Settings: 900px (overlay) or 1200px (main), Main view: 500px (overlay) or 800px (main)
                  try {
                    if (newState) {
                      // Opening settings
                      const settingsWidth = isOverlayWindow() ? 780 : 1200
                      await setWindowWidth(settingsWidth)
                    } else {
                      // Closing settings
                      const defaultWidth = isOverlayWindow() ? 500 : 800
                      await setWindowWidth(defaultWidth)
                    }
                  } catch (error) {
                    console.error('Failed to resize window:', error)
                    toast({
                      title: t('app.errors.windowResize'),
                      description: error instanceof Error ? error.message : String(error),
                      variant: 'destructive',
                    })
                  }
                }}
                aria-label={settingsPageOpen ? t('app.backToHome') : t('app.openSettings')}
              >
                {settingsPageOpen ? (
                  <Home className="h-4 w-4" />
                ) : (
                  <Settings className="h-4 w-4" />
                )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{settingsPageOpen ? t('app.backToHome') : t('app.openSettings')}</p>
          </TooltipContent>
        </Tooltip>
        </div>

        <div className="min-h-0 flex-1 bg-background/95 px-2 py-2">
          {loading && !hydrated ? (
            <div className="flex h-full items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : (
            settingsPageOpen ? (
              <SettingsPage
                settings={settings}
                onUpdateSettings={async (partial) => {
                  await updateSettings(partial)
                }}
                onSetGlobalShortcut={async (shortcut) => {
                  await setGlobalShortcut(shortcut)
                }}
                onSetAutostartEnabled={async (enabled) => {
                  await setAutostartEnabled(enabled)
                }}
              />
            ) : statisticsPageOpen ? (
              <StatisticsPage
                todos={todos}
                onBack={() => {
                  setStatisticsPageOpen(false)
                }}
              />
            ) : todoViewMode === 'kanban' ? (
              <KanbanBoard
                todos={visibleTodos}
                labels={settings.labels}
                onSetStatus={async (id, status) => {
                  await setTodoStatus(id, status)
                  if (status === 'done') {
                    playComplete()
                  }
                }}
                onSetStarred={async (id, starred) => {
                  await setTodoStarred(id, starred)
                }}
                onDelete={async (id) => {
                  await deleteTodo(id)
                  playDelete()
                }}
                emptyLabel={t('app.noActiveTasks')}
              />
            ) : (
              <TodoList
                composeInputRef={inputRef}
                activeListId={activeList?.id ?? settings.activeListId}
                canReorder={canReorder}
                lists={settings.lists}
                labels={settings.labels}
                activeTodos={activeTodos}
                completedTodos={completedTodos}
                onCreate={async (payload) => {
                  await createTodo({
                    ...payload,
                    listId: activeList?.id,
                  })
                  playAdd()
                }}
                onUpdate={async (payload) => {
                  await updateTodo(payload)
                }}
                onSetCompleted={async (id, completed) => {
                  await setTodoCompleted(id, completed)
                  if (completed) {
                    playComplete()
                  }
                }}
                onSetStarred={async (id, starred) => {
                  await setTodoStarred(id, starred)
                }}
                onSetPriority={async (id, priority) => {
                  await setTodoPriority(id, priority)
                }}
                onSetStatus={async (id, status) => {
                  await setTodoStatus(id, status)
                  if (status === 'done') {
                    playComplete()
                  }
                }}
                onSetLabel={async (id, labelId) => {
                  await setTodoLabel(id, labelId)
                }}
                onDelete={async (id) => {
                  await deleteTodo(id)
                  playDelete()
                }}
                onMoveToList={async (id, listId) => {
                  await moveTodoToList(id, listId)
                }}
                onReorder={async (payload) => {
                  await reorderTodos(payload)
                }}
                onDeleteCompleted={async (id) => {
                  await deleteTodo(id)
                  playDelete()
                }}
                emptyLabel={t('app.noActiveTasks')}
              />
            )
          )}
        </div>

        <AppFooter
          error={error}
          globalShortcut={settings.globalShortcut}
          sortModeLabel={selectedSortModeLabel}
        />
      </motion.section>
      <Toaster />
    </main>
    </TooltipProvider>
  )
}
