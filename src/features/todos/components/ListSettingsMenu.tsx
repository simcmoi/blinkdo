import { BarChart3, Check, Filter, MoreHorizontal, Printer, Star, Tags, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { SortMode, TodoLabel, TodoListMeta, TodoPriority } from '@/types/todo'

type ListSettingsMenuProps = {
  activeList: TodoListMeta | undefined
  sortMode: SortMode
  sortModeOptions: Array<{ id: SortMode; label: string }>
  favoritesOnly: boolean
  priorityFilter: TodoPriority | 'all'
  effectiveLabelFilterId: string
  labels: TodoLabel[]
  priorityFilters: Array<{ id: TodoPriority | 'all'; label: string }>
  onSetSortMode: (mode: SortMode) => void
  onRenameList: () => void
  onPrintList: () => void
  onOpenStatistics: () => void
  onClearCompleted: () => void
  onSetFavoritesOnly: (value: boolean) => void
  onSetPriorityFilter: (value: TodoPriority | 'all') => void
  onSetLabelFilterId: (value: string | 'all') => void
  onResetFilters: () => void
}

export function ListSettingsMenu({
  activeList,
  sortMode,
  sortModeOptions,
  favoritesOnly,
  priorityFilter,
  effectiveLabelFilterId,
  labels,
  priorityFilters,
  onSetSortMode,
  onRenameList,
  onPrintList,
  onOpenStatistics,
  onClearCompleted,
  onSetFavoritesOnly,
  onSetPriorityFilter,
  onSetLabelFilterId,
  onResetFilters,
}: ListSettingsMenuProps) {
  const { t } = useTranslation()
  const hasActiveFilter = favoritesOnly || priorityFilter !== 'all' || effectiveLabelFilterId !== 'all'

  return (
    <DropdownMenu>
      <Tooltip>
        <DropdownMenuTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 text-muted-foreground hover:text-foreground',
                hasActiveFilter && 'text-primary',
              )}
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

        {/* Sort modes */}
        {sortModeOptions.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className="flex items-center justify-between gap-2"
            onSelect={() => onSetSortMode(option.id)}
          >
            <span>{option.label}</span>
            {sortMode === option.id ? <Check className="h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Filters section */}
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          <Filter className="mr-1.5 inline h-3 w-3" />
          {t('filter.filters')}
        </DropdownMenuLabel>

        <DropdownMenuItem
          onSelect={() => onSetFavoritesOnly(!favoritesOnly)}
          className="flex items-center justify-between gap-2"
        >
          <span>{t('filter.showFavoritesOnly')}</span>
          {favoritesOnly ? <Star className="h-3.5 w-3.5 fill-foreground" /> : <Star className="h-3.5 w-3.5" />}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center justify-between gap-2">
            <span>{t('todo.priority')}</span>
            {priorityFilter !== 'all' && <span className="text-xs text-muted-foreground">{priorityFilters.find((p) => p.id === priorityFilter)?.label}</span>}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            {priorityFilters.map((option) => (
              <DropdownMenuItem
                key={option.id}
                className={cn(option.id === priorityFilter ? 'font-medium' : undefined)}
                onSelect={() => onSetPriorityFilter(option.id)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Tags className="mr-2 h-3.5 w-3.5" />
            <span>{t('todo.label')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem
              className={cn(effectiveLabelFilterId === 'all' ? 'font-medium' : undefined)}
              onSelect={() => onSetLabelFilterId('all')}
            >
              {t('filter.allLabels')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {labels.map((label) => (
              <DropdownMenuItem
                key={label.id}
                className={cn(effectiveLabelFilterId === label.id ? 'font-medium' : undefined)}
                onSelect={() => onSetLabelFilterId(label.id)}
              >
                {label.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {hasActiveFilter ? (
          <DropdownMenuItem onSelect={onResetFilters}>
            {t('filter.reset')}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        {/* List actions */}
        {activeList ? (
          <DropdownMenuItem onSelect={onRenameList}>
            {t('list.renameAndChangeIcon')}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={onPrintList}>
          <Printer className="mr-2 h-3.5 w-3.5" />
          {t('list.printList')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenStatistics}>
          <BarChart3 className="mr-2 h-3.5 w-3.5" />
          {t('statistics.title')}
        </DropdownMenuItem>
        {activeList ? (
          <DropdownMenuItem onSelect={onClearCompleted}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {t('list.deleteCompletedTasks')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
