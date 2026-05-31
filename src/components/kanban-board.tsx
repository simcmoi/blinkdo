import { CheckCircle2, Clock3, GripVertical, MoreHorizontal, PauseCircle, PlayCircle, Star, Trash2 } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { STATUS_ORDER, labelClasses, priorityClasses, priorityLabel, statusClasses, statusLabel, todoStatus } from '@/lib/todo-ui'
import type { Todo, TodoLabel, TodoStatus } from '@/types/todo'

type KanbanBoardProps = {
  todos: Todo[]
  labels: TodoLabel[]
  onSetStatus: (id: string, status: TodoStatus) => Promise<void>
  onSetStarred: (id: string, starred: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  emptyLabel: string
}

const statusIcons: Record<TodoStatus, typeof Clock3> = {
  todo: Clock3,
  inProgress: PlayCircle,
  waiting: PauseCircle,
  done: CheckCircle2,
}

function statusDropId(status: TodoStatus): string {
  return `status:${status}`
}

function getStatusFromDropId(id: string): TodoStatus | null {
  const value = id.replace('status:', '')
  return STATUS_ORDER.includes(value as TodoStatus) ? value as TodoStatus : null
}

function KanbanColumn({
  status,
  children,
}: {
  status: TodoStatus
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: statusDropId(status),
    data: { status },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-1 flex-col gap-1.5 p-1.5 transition-colors',
        isOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/25' : undefined,
      )}
    >
      {children}
    </div>
  )
}

function KanbanCard({
  todo,
  status,
  label,
  onSetStatus,
  onSetStarred,
  onDelete,
}: {
  todo: Todo
  status: TodoStatus
  label?: TodoLabel
  onSetStatus: (id: string, status: TodoStatus) => Promise<void>
  onSetStarred: (id: string, starred: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const priority = todo.priority ?? 'none'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: todo.id,
    data: { status },
  })

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={cn(
        'group rounded-md border border-border/70 bg-background px-2 py-2 shadow-sm transition-colors hover:border-border',
        status === 'done' ? 'opacity-75' : undefined,
        isDragging ? 'relative z-20 border-primary/40 opacity-80 shadow-lg ring-1 ring-primary/20' : undefined,
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="mt-0.5 flex h-5 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label={t('kanban.dragTask')}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 rounded border border-border bg-muted transition-colors',
            status === 'done' ? 'border-emerald-600 bg-emerald-600' : undefined,
          )}
          onClick={() => void onSetStatus(todo.id, status === 'done' ? 'todo' : 'done')}
          aria-label={status === 'done' ? t('todo.reopen', { title: todo.title }) : t('todo.markCompleted', { title: todo.title })}
        >
          {status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 text-white" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn('line-clamp-3 break-words text-sm font-medium leading-5', status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground')}>
            {todo.title}
          </p>
          {(priority !== 'none' || label || todo.details) ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Badge variant="ghost" className={cn('h-5 rounded-md px-1.5 py-0 text-[10px]', statusClasses(status))}>
                {statusLabel(status, t)}
              </Badge>
              {priority !== 'none' ? (
                <Badge variant="ghost" className={cn('h-5 rounded-md px-1.5 py-0 text-[10px]', priorityClasses(priority))}>
                  {priorityLabel(priority, t)}
                </Badge>
              ) : null}
              {label ? (
                <Badge variant="ghost" className={cn('h-5 rounded-md px-1.5 py-0 text-[10px]', labelClasses(label.color))}>
                  {label.name}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>{t('todo.status')}</DropdownMenuLabel>
            {STATUS_ORDER.map((option) => (
              <DropdownMenuItem
                key={`${todo.id}-${option}`}
                className={cn(option === status ? 'font-medium' : undefined)}
                onSelect={() => void onSetStatus(todo.id, option)}
              >
                {statusLabel(option, t)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void onSetStarred(todo.id, !todo.starred)}>
              <Star className={cn('mr-2 h-3.5 w-3.5', todo.starred ? 'fill-foreground' : undefined)} />
              {todo.starred ? t('todo.removeFavorite') : t('todo.addFavorite')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void onDelete(todo.id)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              {t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  )
}

export function KanbanBoard({
  todos,
  labels,
  onSetStatus,
  onSetStarred,
  onDelete,
  emptyLabel,
}: KanbanBoardProps) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )
  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels])
  const groupedTodos = useMemo(() => {
    const groups = new Map<TodoStatus, Todo[]>(STATUS_ORDER.map((status) => [status, []]))
    for (const todo of todos) {
      groups.get(todoStatus(todo))?.push(todo)
    }
    return groups
  }, [todos])

  const handleDragEnd = (event: DragEndEvent) => {
    const todoId = String(event.active.id)
    const nextStatus = event.over?.id ? getStatusFromDropId(String(event.over.id)) : null
    const currentStatus = event.active.data.current?.status as TodoStatus | undefined

    if (!nextStatus || !currentStatus || nextStatus === currentStatus) {
      return
    }

    void onSetStatus(todoId, nextStatus)
  }

  if (todos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <ScrollArea className="h-full">
        <div className="flex h-full min-h-0 gap-2 overflow-x-auto pb-2">
          {STATUS_ORDER.map((status) => {
            const Icon = statusIcons[status]
            const columnTodos = groupedTodos.get(status) ?? []
            return (
              <section
                key={status}
                className="flex min-h-[320px] w-[228px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card/80"
              >
                <div className="flex items-center justify-between gap-2 border-b border-border/70 px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate text-xs font-semibold text-foreground">
                      {statusLabel(status, t)}
                    </span>
                  </div>
                  <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px] tabular-nums">
                    {columnTodos.length}
                  </Badge>
                </div>

                <KanbanColumn status={status}>
                  {columnTodos.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border/70 px-2 py-4 text-center text-xs text-muted-foreground">
                      {t('kanban.emptyColumn')}
                    </div>
                  ) : (
                    columnTodos.map((todo) => (
                      <KanbanCard
                        key={todo.id}
                        todo={todo}
                        status={status}
                        label={todo.labelId ? labelById.get(todo.labelId) : undefined}
                        onSetStatus={onSetStatus}
                        onSetStarred={onSetStarred}
                        onDelete={onDelete}
                      />
                    ))
                  )}
                </KanbanColumn>
              </section>
            )
          })}
        </div>
      </ScrollArea>
    </DndContext>
  )
}
