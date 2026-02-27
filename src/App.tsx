import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Check, ChevronDown, Filter, Home, MoreHorizontal, Plus, Printer, Settings, Star, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-shell'
import { useTranslation } from 'react-i18next'
import { SettingsPage } from '@/components/settings-page'
import { StatisticsPage } from '@/components/statistics-page'
import { TodoList } from '@/components/todo-list'
import { UpdateBanner } from '@/components/update-banner'
import { Onboarding } from '@/components/onboarding/Onboarding'
import { IconPicker, getIconComponent } from '@/components/icon-picker'
import { Toaster } from '@/components/ui/toaster'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
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
import { setWindowWidth, isOverlayWindow } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import type { SortMode, Todo, TodoPriority } from '@/types/todo'

function compareTodoOrder(
  left: Todo,
  right: Todo,
  sortOrder: 'asc' | 'desc',
): number {
  const leftHasManualOrder = typeof left.sortIndex === 'number'
  const rightHasManualOrder = typeof right.sortIndex === 'number'

  if (leftHasManualOrder && rightHasManualOrder && left.sortIndex !== right.sortIndex) {
    return (left.sortIndex ?? 0) - (right.sortIndex ?? 0)
  }

  if (leftHasManualOrder !== rightHasManualOrder) {
    return leftHasManualOrder ? -1 : 1
  }

  if (sortOrder === 'asc') {
    return left.createdAt - right.createdAt
  }

  // DESC: plus récents en premier
  return right.createdAt - left.createdAt
}

function sortTodos(todos: Todo[], sortMode: SortMode, sortOrder: 'asc' | 'desc'): Todo[] {
  return [...todos].sort((a, b) => {
    const starredDelta = Number(Boolean(b.starred)) - Number(Boolean(a.starred))
    if (starredDelta !== 0) {
      return starredDelta
    }

    switch (sortMode) {
      case 'manual':
        return compareTodoOrder(a, b, sortOrder)
      case 'oldest':
        return a.createdAt - b.createdAt
      case 'title':
        return a.title.localeCompare(b.title, 'fr-FR', { sensitivity: 'base' })
      case 'dueDate': {
        const leftDue = a.reminderAt
        const rightDue = b.reminderAt
        if (typeof leftDue === 'number' && typeof rightDue === 'number') {
          if (leftDue !== rightDue) {
            return leftDue - rightDue
          }
          return b.createdAt - a.createdAt
        }
        if (typeof leftDue === 'number') {
          return -1
        }
        if (typeof rightDue === 'number') {
          return 1
        }
        return b.createdAt - a.createdAt
      }
      case 'recent':
      default:
        return b.createdAt - a.createdAt
    }
  })
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const listNameInputRef = useRef<HTMLInputElement>(null)
  const [renamingListId, setRenamingListId] = useState<string | null>(null)
  const [listNameDraft, setListNameDraft] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<TodoPriority | 'all'>('all')
  const [labelFilterId, setLabelFilterId] = useState<string | 'all'>('all')
  const [settingsPageOpen, setSettingsPageOpen] = useState(false)
  const [statisticsPageOpen, setStatisticsPageOpen] = useState(false)

  const { toast } = useToast()
  const { playAdd, playDelete, playComplete } = useSoundEffects()
  const { t, i18n } = useTranslation()

  const PRIORITY_FILTERS: Array<{ id: TodoPriority | 'all'; label: string }> = useMemo(() => [
    { id: 'all', label: t('filter.allPriorities') },
    { id: 'urgent', label: t('filter.urgent') },
    { id: 'high', label: t('filter.high') },
    { id: 'medium', label: t('filter.medium') },
    { id: 'low', label: t('filter.low') },
    { id: 'none', label: t('filter.none') },
  ], [t])

  const SORT_MODE_OPTIONS: Array<{ id: SortMode; label: string }> = useMemo(() => [
    { id: 'manual', label: t('sort.manual') },
    { id: 'recent', label: t('sort.recent') },
    { id: 'oldest', label: t('sort.oldest') },
    { id: 'title', label: t('sort.title') },
    { id: 'dueDate', label: t('sort.dueDate') },
  ], [t])

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
    setTodoStarred,
    setGlobalShortcut,
    setAutostartEnabled,
    updateSettings,
    updateTodo,
  } = useTodoStore()

  const { checkForUpdate } = useUpdateStore()

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
        const settingsWidth = isOverlayWindow() ? 900 : 1200
        await setWindowWidth(settingsPageOpen ? settingsWidth : defaultWidth)
      } catch (error) {
        console.error('Failed to initialize window width:', error)
      }
    }
    
    void initializeWindowWidth()
  }, [hydrated]) // Only run on hydration, not when settingsPageOpen changes

  // Listen for data-reset event from backend
  useEffect(() => {
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

  // Vérifier les mises à jour au démarrage
  useEffect(() => {
    if (hydrated) {
      void checkForUpdate()
    }
  }, [hydrated, checkForUpdate])

  // Vérifier les mises à jour périodiquement (toutes les 24h)
  useEffect(() => {
    if (!hydrated) return

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
    const interval = setInterval(() => {
      void checkForUpdate()
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

  const activeList = useMemo(() => {
    if (settings.lists.length === 0) {
      return undefined
    }
    return settings.lists.find((list) => list.id === settings.activeListId) ?? settings.lists[0]
  }, [settings.activeListId, settings.lists])

  const listScopedTodos = useMemo(() => {
    if (!activeList) {
      return [] as Todo[]
    }
    return todos.filter((todo) => (todo.listId ?? activeList.id) === activeList.id)
  }, [activeList, todos])

  const sortedTodos = useMemo(
    () => sortTodos(listScopedTodos, settings.sortMode, settings.sortOrder),
    [listScopedTodos, settings.sortMode, settings.sortOrder],
  )

  const effectiveLabelFilterId = useMemo(
    () =>
      labelFilterId !== 'all' && !settings.labels.some((label) => label.id === labelFilterId)
        ? 'all'
        : labelFilterId,
    [labelFilterId, settings.labels],
  )

  const visibleTodos = useMemo(
    () =>
      sortedTodos
        .filter((todo) => (favoritesOnly ? todo.starred : true))
        .filter((todo) =>
          priorityFilter === 'all' ? true : (todo.priority ?? 'none') === priorityFilter,
        )
        .filter((todo) =>
          effectiveLabelFilterId === 'all' ? true : todo.labelId === effectiveLabelFilterId,
        ),
    [effectiveLabelFilterId, favoritesOnly, priorityFilter, sortedTodos],
  )

  const activeTodos = useMemo(
    () => visibleTodos.filter((todo) => typeof todo.completedAt !== 'number'),
    [visibleTodos],
  )

  const completedTodos = useMemo(
    () => visibleTodos.filter((todo) => typeof todo.completedAt === 'number'),
    [visibleTodos],
  )

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

  const selectedPriorityFilterLabel = useMemo(
    () => PRIORITY_FILTERS.find((option) => option.id === priorityFilter)?.label ?? t('filter.allPriorities'),
    [priorityFilter, t, PRIORITY_FILTERS],
  )

  const selectedLabelFilterName = useMemo(() => {
    if (effectiveLabelFilterId === 'all') {
      return t('filter.allLabels')
    }
    return settings.labels.find((label) => label.id === effectiveLabelFilterId)?.name ?? t('filter.allLabels')
  }, [effectiveLabelFilterId, settings.labels, t])

  const canReorder =
    !settingsPageOpen &&
    settings.sortMode === 'manual' &&
    !favoritesOnly &&
    priorityFilter === 'all' &&
    effectiveLabelFilterId === 'all'

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
      <main className="h-screen w-screen bg-transparent p-2 text-foreground">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.12 }}
          className="mx-auto flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-gray-400/80 bg-card"
        >
        <UpdateBanner />
        {/* Header: Logo + Liste + Paramètres - Background distinct */}
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
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
                    className="h-7 max-w-[220px] justify-start gap-1.5 px-1 text-sm font-medium"
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setFavoritesOnly((current) => !current)
                  }}
                  aria-label={favoritesOnly ? t('filter.showAllTasks') : t('filter.showFavoritesOnly')}
                >
                  <Star className={cn('h-3.5 w-3.5', favoritesOnly ? 'fill-foreground text-foreground' : undefined)} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{favoritesOnly ? t('filter.showAllTasks') : t('filter.showFavoritesOnly')}</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={t('list.listSettings')}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent>
                  <p>{t('list.sortAndDisplayOptions')}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{t('list.listSettings')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SORT_MODE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    className="flex items-center justify-between gap-2"
                    onSelect={() => {
                      void updateSettings({ sortMode: option.id })
                    }}
                  >
                    <span>{option.label}</span>
                    {settings.sortMode === option.id ? <Check className="h-3.5 w-3.5" /> : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                {activeList ? (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenamingListId(activeList.id)
                        setListNameDraft(activeList.name)
                      }}
                    >
                      {t('list.renameAndChangeIcon')}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem
                  onSelect={() => {
                    printCurrentList()
                  }}
                >
                  <Printer className="mr-2 h-3.5 w-3.5" />
                  {t('list.printList')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setStatisticsPageOpen(true)
                  }}
                >
                  <BarChart3 className="mr-2 h-3.5 w-3.5" />
                  {t('statistics.title')}
                </DropdownMenuItem>
                {activeList ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      void clearCompletedInList(activeList.id)
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {t('list.deleteCompletedTasks')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
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
                      const settingsWidth = isOverlayWindow() ? 900 : 1200
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

        {/* Filtres - Background distinct, visible seulement si pas dans settings */}
        {!settingsPageOpen && !statisticsPageOpen ? (
          <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2">
            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                      <Filter className="h-3.5 w-3.5" />
                      {selectedPriorityFilterLabel}
                    </Button>
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent>
                  <p>{t('filter.filterByPriority')}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-44">
                {PRIORITY_FILTERS.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    className={cn(option.id === priorityFilter ? 'font-medium' : undefined)}
                    onSelect={() => {
                      setPriorityFilter(option.id)
                    }}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <Tooltip>
                <DropdownMenuTrigger asChild>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                      {selectedLabelFilterName}
                    </Button>
                  </TooltipTrigger>
                </DropdownMenuTrigger>
                <TooltipContent>
                  <p>{t('filter.filterByLabel')}</p>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuItem
                  className={cn(effectiveLabelFilterId === 'all' ? 'font-medium' : undefined)}
                  onSelect={() => {
                    setLabelFilterId('all')
                  }}
                >
                  {t('filter.allLabels')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {settings.labels.map((label) => (
                  <DropdownMenuItem
                    key={label.id}
                    className={cn(effectiveLabelFilterId === label.id ? 'font-medium' : undefined)}
                    onSelect={() => {
                      setLabelFilterId(label.id)
                    }}
                  >
                    {label.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {(favoritesOnly || priorityFilter !== 'all' || effectiveLabelFilterId !== 'all') ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setFavoritesOnly(false)
                  setPriorityFilter('all')
                  setLabelFilterId('all')
                }}
              >
                {t('filter.reset')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Zone principale - Liste des tâches avec background blanc/card */}
        <div className="min-h-0 flex-1 bg-background px-4 py-3">
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

        {/* Footer - Background distinct */}
        <div className="border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          {error ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-destructive">Erreur: {error}</p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-medium">{settings.globalShortcut}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>Tri: {selectedSortModeLabel}</span>
              </div>
              <button
                onClick={() => {
                  void open('https://github.com/simcmoi/blinkdo')
                }}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Star className="h-3 w-3" />
                <span>Star on GitHub</span>
              </button>
            </div>
          )}
        </div>
      </motion.section>
      <Toaster />
    </main>
    </TooltipProvider>
  )
}
