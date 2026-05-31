import { BarChart3, Check, MoreHorizontal, Printer, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { SortMode, TodoListMeta } from '@/types/todo'

type ListSettingsMenuProps = {
  activeList: TodoListMeta | undefined
  sortMode: SortMode
  sortModeOptions: Array<{ id: SortMode; label: string }>
  onSetSortMode: (mode: SortMode) => void
  onRenameList: () => void
  onPrintList: () => void
  onOpenStatistics: () => void
  onClearCompleted: () => void
}

export function ListSettingsMenu({
  activeList,
  sortMode,
  sortModeOptions,
  onSetSortMode,
  onRenameList,
  onPrintList,
  onOpenStatistics,
  onClearCompleted,
}: ListSettingsMenuProps) {
  const { t } = useTranslation()

  return (
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
        {activeList ? (
          <>
            <DropdownMenuItem onSelect={onRenameList}>
              {t('list.renameAndChangeIcon')}
            </DropdownMenuItem>
          </>
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
