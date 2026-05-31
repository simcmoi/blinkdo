import { Filter } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { TodoLabel, TodoPriority } from '@/types/todo'

type FilterBarProps = {
  favoritesOnly: boolean
  priorityFilter: TodoPriority | 'all'
  effectiveLabelFilterId: string
  labels: TodoLabel[]
  priorityFilters: Array<{ id: TodoPriority | 'all'; label: string }>
  onSetPriorityFilter: (value: TodoPriority | 'all') => void
  onSetLabelFilterId: (value: string | 'all') => void
  onResetFilters: () => void
}

export function FilterBar({
  favoritesOnly,
  priorityFilter,
  effectiveLabelFilterId,
  labels,
  priorityFilters,
  onSetPriorityFilter,
  onSetLabelFilterId,
  onResetFilters,
}: FilterBarProps) {
  const { t } = useTranslation()

  const selectedPriorityFilterLabel =
    priorityFilters.find((option) => option.id === priorityFilter)?.label ?? t('filter.allPriorities')

  const selectedLabelFilterName = (() => {
    if (effectiveLabelFilterId === 'all') return t('filter.allLabels')
    return labels.find((label) => label.id === effectiveLabelFilterId)?.name ?? t('filter.allLabels')
  })()

  const hasActiveFilters = favoritesOnly || priorityFilter !== 'all' || effectiveLabelFilterId !== 'all'

  return (
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
          {priorityFilters.map((option) => (
            <DropdownMenuItem
              key={option.id}
              className={cn(option.id === priorityFilter ? 'font-medium' : undefined)}
              onSelect={() => onSetPriorityFilter(option.id)}
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
        </DropdownMenuContent>
      </DropdownMenu>

      {hasActiveFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onResetFilters}
        >
          {t('filter.reset')}
        </Button>
      ) : null}
    </div>
  )
}
