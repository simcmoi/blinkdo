import { Check, Ellipsis } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PRIORITY_ORDER, STATUS_ORDER, priorityLabel, statusLabel, todoStatus } from '@/lib/todo-ui'
import type { Todo, TodoLabel, TodoListMeta, TodoPriority, TodoStatus } from '@/types/todo'

type TodoContextMenuProps = {
  todo: Todo
  lists: TodoListMeta[]
  labels: TodoLabel[]
  activeListId: string
  onSetPriority: (id: string, priority: TodoPriority) => Promise<void>
  onSetStatus: (id: string, status: TodoStatus) => Promise<void>
  onSetLabel: (id: string, labelId?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMoveToList: (id: string, listId: string) => Promise<void>
  onOpenDateEditor: () => void
  onOpenSubtaskEditor: () => void
}

export function TodoContextMenu({
  todo,
  lists,
  labels,
  activeListId,
  onSetPriority,
  onSetStatus,
  onSetLabel,
  onDelete,
  onMoveToList,
  onOpenDateEditor,
  onOpenSubtaskEditor,
}: TodoContextMenuProps) {
  const { t } = useTranslation()
  const priority = todo.priority ?? 'none'
  const status = todoStatus(todo)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={t('todo.actionsFor', { title: todo.title })}
        >
          <Ellipsis className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('todo.status')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            {STATUS_ORDER.map((option) => (
              <DropdownMenuItem
                key={option}
                className={cn(option === status ? 'font-medium' : undefined)}
                onSelect={() => void onSetStatus(todo.id, option)}
              >
                {statusLabel(option, t)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('todo.priority')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
            {PRIORITY_ORDER.map((option) => (
              <DropdownMenuItem
                key={option}
                className={cn(option === priority ? 'font-medium' : undefined)}
                onSelect={() => void onSetPriority(todo.id, option)}
              >
                {priorityLabel(option, t)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('todo.label')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            <DropdownMenuItem
              className={cn(!todo.labelId ? 'font-medium' : undefined)}
              onSelect={() => void onSetLabel(todo.id, undefined)}
            >
              {t('todo.noLabel')}
            </DropdownMenuItem>
            {labels.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(item.id === todo.labelId ? 'font-medium' : undefined)}
                onSelect={() => void onSetLabel(todo.id, item.id)}
              >
                {item.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenDateEditor}>
          {t('todo.addDueDate')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenSubtaskEditor}>
          {t('todo.addSubtask')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void onDelete(todo.id)}>
          {t('common.delete')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
          {t('todo.moveToList')}
        </DropdownMenuLabel>
        {lists.map((list) => {
          const isCurrentList = (todo.listId ?? activeListId) === list.id
          return (
            <DropdownMenuItem
              key={`move-${todo.id}-${list.id}`}
              className="flex items-center justify-between gap-2"
              onSelect={() => { if (!isCurrentList) void onMoveToList(todo.id, list.id) }}
            >
              <span className="truncate">{list.name}</span>
              {isCurrentList ? <Check className="h-3.5 w-3.5" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
