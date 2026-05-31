import { AlertTriangle, Star, Tags } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { labelClasses, priorityClasses, priorityLabel } from '@/lib/todo-ui'
import type { Todo, TodoLabel, TodoPriority } from '@/types/todo'

type DragOverlayContentProps = {
  todo: Todo
  priority: TodoPriority
  labelById: Map<string, TodoLabel>
}

export function DragOverlayContent({ todo, priority, labelById }: DragOverlayContentProps) {
  const { t } = useTranslation()
  const label = todo.labelId ? labelById.get(todo.labelId) : undefined

  return (
    <div className={cn(
      'flex items-start gap-1.5 rounded-md px-1 py-1 bg-background border-2 border-primary shadow-2xl cursor-grabbing',
      priority === 'urgent' ? 'ring-2 ring-destructive/50' : undefined,
    )}>
      <Checkbox className="mt-0.5" checked={false} disabled />
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="text-sm text-foreground line-clamp-2 break-all max-w-[400px]">
          {todo.title}
        </p>
        {(todo.reminderAt || priority !== 'none' || label) && (
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {priority !== 'none' ? (
              <Badge variant="ghost" className={cn('h-5 px-1.5 py-0 rounded-md', priorityClasses(priority))}>
                {priority === 'urgent' ? <AlertTriangle className="h-3 w-3" /> : null}
                {priorityLabel(priority, t)}
              </Badge>
            ) : null}
            {label ? (
              <Badge variant="ghost" className={cn('h-5 px-1.5 py-0 rounded-md', labelClasses(label.color))}>
                <Tags className="h-3 w-3" />
                {label.name}
              </Badge>
            ) : null}
          </div>
        )}
      </div>
      <Star className={cn('h-3.5 w-3.5 mt-1', todo.starred ? 'fill-foreground' : 'text-muted-foreground')} />
    </div>
  )
}
