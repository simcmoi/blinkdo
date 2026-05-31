import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sortTodos } from '@/lib/sort'
import type { Settings, SortMode, Todo, TodoListMeta, TodoPriority } from '@/types/todo'

type FilterState = {
  favoritesOnly: boolean
  priorityFilter: TodoPriority | 'all'
  labelFilterId: string | 'all'
}

export function useFilteredTodos(todos: Todo[], settings: Settings) {
  const { t } = useTranslation()

  const [filterState, setFilterState] = useState<FilterState>({
    favoritesOnly: false,
    priorityFilter: 'all',
    labelFilterId: 'all',
  })

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

  const activeList: TodoListMeta | undefined = useMemo(() => {
    if (settings.lists.length === 0) return undefined
    return settings.lists.find((list) => list.id === settings.activeListId) ?? settings.lists[0]
  }, [settings.activeListId, settings.lists])

  const listScopedTodos = useMemo(() => {
    if (!activeList) return [] as Todo[]
    return todos.filter((todo) => (todo.listId ?? activeList.id) === activeList.id)
  }, [activeList, todos])

  const sortedTodos = useMemo(
    () => sortTodos(listScopedTodos, settings.sortMode, settings.sortOrder),
    [listScopedTodos, settings.sortMode, settings.sortOrder],
  )

  const effectiveLabelFilterId = useMemo(
    () =>
      filterState.labelFilterId !== 'all' && !settings.labels.some((label) => label.id === filterState.labelFilterId)
        ? 'all'
        : filterState.labelFilterId,
    [filterState.labelFilterId, settings.labels],
  )

  const visibleTodos = useMemo(
    () =>
      sortedTodos
        .filter((todo) => (filterState.favoritesOnly ? todo.starred : true))
        .filter((todo) =>
          filterState.priorityFilter === 'all' ? true : (todo.priority ?? 'none') === filterState.priorityFilter,
        )
        .filter((todo) =>
          effectiveLabelFilterId === 'all' ? true : todo.labelId === effectiveLabelFilterId,
        ),
    [effectiveLabelFilterId, filterState.favoritesOnly, filterState.priorityFilter, sortedTodos],
  )

  const activeTodos = useMemo(
    () => visibleTodos.filter((todo) => typeof todo.completedAt !== 'number'),
    [visibleTodos],
  )

  const completedTodos = useMemo(
    () => visibleTodos.filter((todo) => typeof todo.completedAt === 'number'),
    [visibleTodos],
  )

  const canReorder =
    settings.sortMode === 'manual' &&
    !filterState.favoritesOnly &&
    filterState.priorityFilter === 'all' &&
    effectiveLabelFilterId === 'all'

  const resetFilters = () => {
    setFilterState({ favoritesOnly: false, priorityFilter: 'all', labelFilterId: 'all' })
  }

  const setFavoritesOnly = (value: boolean) => {
    setFilterState((prev) => ({ ...prev, favoritesOnly: value }))
  }

  const setPriorityFilter = (value: TodoPriority | 'all') => {
    setFilterState((prev) => ({ ...prev, priorityFilter: value }))
  }

  const setLabelFilterId = (value: string | 'all') => {
    setFilterState((prev) => ({ ...prev, labelFilterId: value }))
  }

  return {
    ...filterState,
    setFavoritesOnly,
    setPriorityFilter,
    setLabelFilterId,
    resetFilters,
    activeList,
    sortedTodos,
    visibleTodos,
    activeTodos,
    completedTodos,
    canReorder,
    PRIORITY_FILTERS,
    SORT_MODE_OPTIONS,
    effectiveLabelFilterId,
  }
}
