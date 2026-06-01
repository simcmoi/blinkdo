import {
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronDown, ChevronRight, Ellipsis, FileText, Plus, Sparkles, Star, Tags } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  priorityLabel,
  statusClasses,
  statusLabel,
  todoStatus,
  labelClasses,
  reminderBadgeClasses,
  getReminderBadgeStyle,
  buildTodoWithDepth,
} from '@/lib/todo-ui'
import type { Todo, TodoLabel, TodoListMeta, TodoPriority, TodoStatus } from '@/types/todo'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { DragOverlayContent } from '@/features/todos/components/DragOverlayContent'
import { TodoContextMenu } from '@/features/todos/components/TodoContextMenu'
import { TodoInlineEditor } from '@/features/todos/components/TodoInlineEditor'
import { ShortcutHint } from '@/components/shortcut-hints'

type TodoListProps = {
  composeInputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
  activeListId: string
  canReorder: boolean
  lists: TodoListMeta[]
  labels: TodoLabel[]
  activeTodos: Todo[]
  completedTodos: Todo[]
  onCreate: (payload: {
    title: string
    details?: string
    reminderAt?: number
    parentId?: string
  }) => Promise<void>
  onUpdate: (payload: {
    id: string
    title: string
    details?: string
    reminderAt?: number
  }) => Promise<void>
  onSetCompleted: (id: string, completed: boolean) => Promise<void>
  onSetStarred: (id: string, starred: boolean) => Promise<void>
  onSetPriority: (id: string, priority: TodoPriority) => Promise<void>
  onSetStatus: (id: string, status: TodoStatus) => Promise<void>
  onSetLabel: (id: string, labelId?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMoveToList: (id: string, listId: string) => Promise<void>
  onReorder: (payload: {
    listId: string
    parentId?: string
    completed: boolean
    orderedIds: string[]
  }) => Promise<void>
  onDeleteCompleted: (id: string) => Promise<void>
  emptyLabel: string
}

type DateEditMode = 'date' | 'datetime' | null

type TodoDraft = {
  title: string
  details: string
  reminderAt?: number
}

const INITIAL_COMPLETED_VISIBLE_COUNT = 5
const COMPLETED_VISIBLE_STEP = 10
const COMPLETION_FEEDBACK_MS = 420

function priorityClasses(priority: TodoPriority): string {
  switch (priority) {
    case 'urgent':
      return 'border border-red-700/30 bg-red-500/15 text-red-700 dark:text-red-400 dark:border-red-500/30'
    case 'high':
      return 'border border-orange-700/30 bg-orange-500/15 text-orange-700 dark:text-orange-300 dark:border-orange-500/30'
    case 'medium':
      return 'border border-blue-700/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:border-blue-500/30'
    case 'low':
      return 'border border-border bg-muted text-muted-foreground'
    default:
      return 'border border-border bg-transparent text-muted-foreground'
  }
}

type SortableTodoItemProps = {
  id: string
  children: ReactNode
  disabled?: boolean
  depth: number
  isDragging?: boolean
  isOver?: boolean
  dropPosition?: 'before' | 'after'
}

function SortableTodoItem({
  id,
  children,
  disabled = false,
  depth,
  isDragging: externalIsDragging = false,
  isOver = false,
  dropPosition = 'after',
}: SortableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver: isSortableOver,
  } = useSortable({ 
    id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const leftOffset = Math.min(depth, 6) * 16
  const isCurrentlyDragging = isDragging || externalIsDragging
  const isCurrentlyOver = isOver || isSortableOver

  // Determine indicator position based on drop position
  const indicatorClass = dropPosition === 'before' 
    ? 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary before:rounded-full before:shadow-lg before:shadow-primary/50'
    : 'before:absolute before:inset-x-0 before:bottom-0 before:h-0.5 before:bg-primary before:rounded-full before:shadow-lg before:shadow-primary/50'

  return (
    <motion.li
      ref={setNodeRef}
      style={{
        ...style,
        ...(leftOffset > 0 ? { paddingLeft: `${leftOffset + 8}px` } : undefined),
      }}
      animate={{ opacity: isCurrentlyDragging ? 0.4 : 1 }}
      transition={{ duration: 0.08 }}
      className={cn(
        'px-2 py-1 relative',
        isCurrentlyOver && !isCurrentlyDragging && indicatorClass
      )}
      data-sortable-id={id}
      {...attributes}
      {...listeners}
    >
      {children}
    </motion.li>
  )
}

type TaskMetaBadgesProps = {
  todo: Todo
  priority: TodoPriority
  status: TodoStatus
  label?: TodoLabel
}

function TaskMetaBadges({ todo, priority, status, label }: TaskMetaBadgesProps) {
  const { t, i18n } = useTranslation()

  if (!todo.details && !todo.reminderAt && priority === 'none' && status === 'todo' && !label) {
    return null
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {status !== 'todo' ? (
        <Badge
          variant="ghost"
          className={cn('h-5 rounded-md px-1.5 py-0', statusClasses(status))}
        >
          {statusLabel(status, t)}
        </Badge>
      ) : null}
      {todo.reminderAt ? (
        (() => {
          const badgeStyle = getReminderBadgeStyle(todo.reminderAt, t, i18n)
          return (
            <Badge
              variant="ghost"
              className={cn('h-5 rounded-md px-1.5 py-0', reminderBadgeClasses(badgeStyle.variant))}
            >
              <CalendarClock className="h-3 w-3" />
              {badgeStyle.label}
            </Badge>
          )
        })()
      ) : null}
      {priority !== 'none' ? (
        <Badge
          variant="ghost"
          className={cn('h-5 rounded-md px-1.5 py-0', priorityClasses(priority))}
        >
          {priority === 'urgent' ? <AlertTriangle className="h-3 w-3" /> : null}
          {priorityLabel(priority, t)}
        </Badge>
      ) : null}
      {label ? (
        <Badge
          variant="ghost"
          className={cn('h-5 rounded-md px-1.5 py-0', labelClasses(label.color))}
        >
          <Tags className="h-3 w-3" />
          {label.name}
        </Badge>
      ) : null}
      {todo.details ? (
        <Badge
          variant="outline"
          className="h-5 max-w-[180px] rounded-md px-1.5 py-0 text-muted-foreground"
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate">{todo.details}</span>
        </Badge>
      ) : null}
    </div>
  )
}

type TaskRowProps = {
  todo: Todo
  priority: TodoPriority
  status: TodoStatus
  label?: TodoLabel
  lists: TodoListMeta[]
  labels: TodoLabel[]
  activeListId: string
  isSelected: boolean
  isCompleting: boolean
  canReorder: boolean
  onHover: () => void
  onOpen: () => void
  onComplete: () => Promise<void>
  onSetStarred: (id: string, starred: boolean) => Promise<void>
  onSetPriority: (id: string, priority: TodoPriority) => Promise<void>
  onSetStatus: (id: string, status: TodoStatus) => Promise<void>
  onSetLabel: (id: string, labelId?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMoveToList: (id: string, listId: string) => Promise<void>
  onOpenDateEditor: () => void
  onOpenSubtaskEditor: () => void
}

function TaskRow({
  todo,
  priority,
  status,
  label,
  lists,
  labels,
  activeListId,
  isSelected,
  isCompleting,
  canReorder,
  onHover,
  onOpen,
  onComplete,
  onSetStarred,
  onSetPriority,
  onSetStatus,
  onSetLabel,
  onDelete,
  onMoveToList,
  onOpenDateEditor,
  onOpenSubtaskEditor,
}: TaskRowProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'group relative flex items-start gap-2 overflow-hidden rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border/80 hover:bg-card',
        'before:absolute before:bottom-1.5 before:left-0 before:top-1.5 before:w-0.5 before:rounded-full before:bg-transparent',
        isSelected ? 'border-border bg-card shadow-sm before:bg-primary' : undefined,
        priority === 'urgent' ? 'border-destructive/30 bg-destructive/5 before:bg-destructive' : undefined,
        isCompleting ? 'border-emerald-500/35 bg-emerald-500/10 shadow-sm before:bg-emerald-500' : undefined,
        canReorder ? 'cursor-grab active:cursor-grabbing' : undefined,
      )}
      onMouseEnter={onHover}
    >
      <AnimatePresence>
        {isCompleting ? (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-emerald-500/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          />
        ) : null}
      </AnimatePresence>
      <div className="relative z-10 mt-0.5">
        <Checkbox
          className={cn('h-5 w-5 rounded-md', isCompleting && 'border-emerald-600 bg-emerald-600 text-white')}
          checked={isCompleting || typeof todo.completedAt === 'number'}
          onCheckedChange={async (checked) => {
            if (checked === true) await onComplete()
          }}
          aria-label={t('todo.markCompleted', { title: todo.title })}
        />
        {isSelected ? <ShortcutHint shortcut="Space" className="absolute -left-1 top-6" /> : null}
      </div>

      <button
        type="button"
        className="relative z-10 min-w-0 flex-1 overflow-hidden text-left focus-visible:outline-none"
        onClick={onOpen}
      >
        <p
          className={cn(
            'max-w-full whitespace-normal break-words text-sm font-medium leading-5 text-foreground line-clamp-3 transition-colors',
            isCompleting && 'text-emerald-800 line-through decoration-emerald-700/70 decoration-2 dark:text-emerald-200',
          )}
        >
          {todo.title}
        </p>
        <TaskMetaBadges todo={todo} priority={priority} status={status} label={label} />
      </button>

      <TodoContextMenu
        todo={todo}
        lists={lists}
        labels={labels}
        activeListId={activeListId}
        onSetPriority={onSetPriority}
        onSetStatus={onSetStatus}
        onSetLabel={onSetLabel}
        onDelete={onDelete}
        onMoveToList={onMoveToList}
        onOpenDateEditor={onOpenDateEditor}
        onOpenSubtaskEditor={onOpenSubtaskEditor}
      />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-7 w-7 text-muted-foreground opacity-70 transition-opacity hover:text-foreground group-hover:opacity-100"
        onClick={async () => {
          await onSetStarred(todo.id, !todo.starred)
        }}
        aria-label={todo.starred ? t('todo.removeFromFavorites', { title: todo.title }) : t('todo.addToFavorites', { title: todo.title })}
      >
        <Star className={cn('h-3.5 w-3.5', todo.starred ? 'fill-foreground text-foreground' : 'text-muted-foreground')} />
        {isSelected ? <ShortcutHint shortcut="F" className="absolute -right-1 top-7" /> : null}
      </Button>
      <AnimatePresence>
        {isCompleting ? (
          <motion.div
            className="relative z-10 ml-1 flex h-7 shrink-0 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-200"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('common.done')}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function TodoList({
  composeInputRef,
  activeListId,
  canReorder,
  lists,
  labels,
  activeTodos,
  completedTodos,
  onCreate,
  onUpdate,
  onSetCompleted,
  onSetStarred,
  onSetPriority,
  onSetStatus,
  onSetLabel,
  onDelete,
  onMoveToList,
  onReorder,
  onDeleteCompleted,
  emptyLabel,
}: TodoListProps) {
  const { t, i18n } = useTranslation()
  const { playAdd } = useSoundEffects()
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [newParentId, setNewParentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TodoDraft>({ title: '', details: '' })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showDate, setShowDate] = useState(false)
  const [dateMode, setDateMode] = useState<DateEditMode>(null)
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const [completedVisibleCount, setCompletedVisibleCount] = useState(INITIAL_COMPLETED_VISIBLE_COUNT)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('after')
  const [selectedTodoId, setSelectedTodoId] = useState<string | null>(null)
  const [completingIds, setCompletingIds] = useState<Set<string>>(() => new Set())

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const activeItems = useMemo(() => buildTodoWithDepth(activeTodos), [activeTodos])
  const completedItems = useMemo(() => buildTodoWithDepth(completedTodos), [completedTodos])
  const navigableTodoIds = useMemo(() => activeItems.map(({ todo }) => todo.id), [activeItems])
  const effectiveSelectedTodoId =
    selectedTodoId && navigableTodoIds.includes(selectedTodoId)
      ? selectedTodoId
      : navigableTodoIds[0] ?? null

  useEffect(() => {
    if (!completedExpanded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompletedVisibleCount(INITIAL_COMPLETED_VISIBLE_COUNT)
      return
    }

    setCompletedVisibleCount((current) =>
      Math.min(Math.max(current, INITIAL_COMPLETED_VISIBLE_COUNT), completedItems.length || INITIAL_COMPLETED_VISIBLE_COUNT),
    )
  }, [completedExpanded, completedItems.length])
  const activeTodoById = useMemo(
    () => new Map(activeTodos.map((todo) => [todo.id, todo])),
    [activeTodos],
  )
  const labelById = useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels])

  const titleInputRef = useRef<HTMLTextAreaElement | null>(null)
  const detailsInputRef = useRef<HTMLInputElement | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const saveInFlightRef = useRef(false)
  const editingIdRef = useRef<string | 'new' | null>(null)
  const lastPointerInsideEditorAtRef = useRef(0)

  const markTodoCompleteWithFeedback = useCallback(async (id: string) => {
    if (completingIds.has(id)) return

    setCompletingIds((current) => new Set(current).add(id))
    await new Promise((resolve) => window.setTimeout(resolve, COMPLETION_FEEDBACK_MS))

    try {
      await onSetCompleted(id, true)
    } finally {
      setCompletingIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
    }
  }, [completingIds, onSetCompleted])

  const compactDateFormatter = useMemo(
    () => {
      const locale = i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US'
      return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      })
    },
    [i18n.language],
  )

  const fullDateFormatter = useMemo(
    () => {
      const locale = i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US'
      return new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    },
    [i18n.language],
  )

  useEffect(() => {
    editingIdRef.current = editingId
    
    // Emit event to notify other components about editor state
    const event = new CustomEvent('todo-editor-state-changed', { 
      detail: { isEditing: editingId !== null } 
    })
    window.dispatchEvent(event)
  }, [editingId])

  // Auto-open create editor on mount AND when window gains focus
  useEffect(() => {
    const openCreateEditor = () => {
      // Only open editor if nothing is being edited
      if (editingIdRef.current === null) {
        setEditingId('new')
        setNewParentId(null)
        setDraft({ title: '', details: '' })
        setSaveError(null)
        setShowDetails(false)
        setShowDate(false)
        setDateMode(null)
      }
    }

    // Open on mount
    openCreateEditor()

    // Listen to custom event emitted by use-window-behavior hook
    const handleWindowFocused = () => {
      openCreateEditor()
    }

    window.addEventListener('tauri-window-focused', handleWindowFocused)
    return () => window.removeEventListener('tauri-window-focused', handleWindowFocused)
  }, [])

  useEffect(() => {
    if (editingId === null) {
      composeInputRef.current = null
      return
    }

    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
      
      // Auto-resize textarea
      if (titleInputRef.current) {
        titleInputRef.current.style.height = 'auto'
        titleInputRef.current.style.height = `${Math.min(titleInputRef.current.scrollHeight, 120)}px`
      }
    })
  }, [editingId, composeInputRef])

  // Auto-resize textarea when content changes
  useEffect(() => {
    if (titleInputRef.current && draft.title) {
      titleInputRef.current.style.height = 'auto'
      titleInputRef.current.style.height = `${Math.min(titleInputRef.current.scrollHeight, 120)}px`
    }
  }, [draft.title])


  const closeEditor = useCallback(() => {
    setEditingId(null)
    setNewParentId(null)
    setDraft({ title: '', details: '' })
    setSaveError(null)
    setShowDetails(false)
    setShowDate(false)
    setDateMode(null)
  }, [])

  const persistAndMaybeClose = useCallback(async (shouldClose: boolean, reopenAfterCreate = false): Promise<boolean> => {
    if (editingId === null || saveInFlightRef.current) {
      return false
    }

    const editingIdAtStart = editingId
    const newParentIdAtStart = newParentId
    let persistSucceeded = true
    saveInFlightRef.current = true
    setSaveError(null)

    try {
      const title = draft.title.trim()
      const details = draft.details.trim() || undefined

      if (editingIdAtStart === 'new') {
        if (title) {
          await onCreate({
            title,
            details,
            reminderAt: draft.reminderAt,
            parentId: newParentIdAtStart ?? undefined,
          })
          playAdd()
        }
      } else if (title) {
        await onUpdate({
          id: editingIdAtStart,
          title,
          details,
          reminderAt: draft.reminderAt,
        })
      }
    } catch (error) {
      persistSucceeded = false
      setSaveError(error instanceof Error ? error.message : 'Échec de sauvegarde')
    } finally {
      saveInFlightRef.current = false
      if (persistSucceeded && shouldClose && editingIdRef.current === editingIdAtStart) {
        if (editingIdAtStart === 'new' && newParentIdAtStart === null && reopenAfterCreate) {
          // After creating a new top-level task with Enter, reopen the editor
          setEditingId('new')
          setNewParentId(null)
          setDraft({ title: '', details: '' })
          setSaveError(null)
          setShowDetails(false)
          setShowDate(false)
          setDateMode(null)
        } else {
          closeEditor()
        }
      }
    }

    return persistSucceeded
  }, [closeEditor, draft, editingId, newParentId, onCreate, onUpdate, playAdd])

  const openCreateEditor = useCallback(async (parentId?: string) => {
    if (editingId !== null) {
      const previousSaveSucceeded = await persistAndMaybeClose(true)
      if (!previousSaveSucceeded) {
        return
      }
    }

    setEditingId('new')
    setNewParentId(parentId ?? null)
    setDraft({ title: '', details: '' })
    setSaveError(null)
    setShowDetails(false)
    setShowDate(false)
    setDateMode(null)
  }, [editingId, persistAndMaybeClose])

  const openTodoEditor = useCallback(async (
    todo: Todo,
    options?: {
      showDate?: boolean
      showDetails?: boolean
    },
  ) => {
    if (editingId === todo.id) {
      return
    }

    if (editingId !== null) {
      const previousSaveSucceeded = await persistAndMaybeClose(true)
      if (!previousSaveSucceeded) {
        return
      }
    }

    setEditingId(todo.id)
    setDraft({
      title: todo.title,
      details: todo.details ?? '',
      reminderAt: todo.reminderAt,
    })
    setNewParentId(null)
    setSaveError(null)
    setShowDetails(options?.showDetails ?? Boolean(todo.details))
    setShowDate(options?.showDate ?? Boolean(todo.reminderAt))
    setDateMode(null)
  }, [editingId, persistAndMaybeClose])

  useEffect(() => {
    if (editingId !== null) return

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName.toLowerCase()
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable
    }

    const moveSelection = (direction: 1 | -1) => {
      if (navigableTodoIds.length === 0) return

      setSelectedTodoId((current) => {
        const currentId = current && navigableTodoIds.includes(current) ? current : effectiveSelectedTodoId
        const currentIndex = currentId ? navigableTodoIds.indexOf(currentId) : -1
        const nextIndex = currentIndex < 0
          ? direction > 0 ? 0 : navigableTodoIds.length - 1
          : Math.min(Math.max(currentIndex + direction, 0), navigableTodoIds.length - 1)
        return navigableTodoIds[nextIndex]
      })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return

      if (event.key === 'n' || event.key === 'a') {
        event.preventDefault()
        void openCreateEditor()
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault()
        moveSelection(1)
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault()
        moveSelection(-1)
        return
      }

      const selectedTodo = effectiveSelectedTodoId ? activeTodoById.get(effectiveSelectedTodoId) : undefined
      if (!selectedTodo) return

      if (event.key === 'Enter') {
        event.preventDefault()
        void openTodoEditor(selectedTodo)
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        void markTodoCompleteWithFeedback(selectedTodo.id)
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        void onSetStarred(selectedTodo.id, !selectedTodo.starred)
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        void onDelete(selectedTodo.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeTodoById,
    effectiveSelectedTodoId,
    editingId,
    navigableTodoIds,
    onDelete,
    markTodoCompleteWithFeedback,
    onSetCompleted,
    onSetStarred,
    openCreateEditor,
    openTodoEditor,
  ])

  const normalizeDateLabel = (label: string): string => {
    return label.replace(',', '').replace(/\s+/g, ' ').trim()
  }

  const formatDateLabel = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()

    if (date.getFullYear() === now.getFullYear()) {
      return normalizeDateLabel(compactDateFormatter.format(date))
    }

    return normalizeDateLabel(fullDateFormatter.format(date))
  }

  const reorderWithinSiblingGroup = async (
    draggedId: string,
    targetId: string,
    position: 'before' | 'after',
  ) => {
    const draggedTodo = activeTodoById.get(draggedId)
    const targetTodo = activeTodoById.get(targetId)
    if (!draggedTodo || !targetTodo) {
      return
    }

    const draggedParentId = draggedTodo.parentId ?? null
    const targetParentId = targetTodo.parentId ?? null
    if (draggedParentId !== targetParentId) {
      return
    }
    if (Boolean(draggedTodo.starred) !== Boolean(targetTodo.starred)) {
      return
    }

    const siblingIds = activeTodos
      .filter(
        (todo) =>
          (todo.parentId ?? null) === targetParentId &&
          Boolean(todo.starred) === Boolean(targetTodo.starred),
      )
      .map((todo) => todo.id)

    if (siblingIds.length < 2) {
      return
    }

    const sourceIndex = siblingIds.indexOf(draggedId)
    const targetIndex = siblingIds.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    const reorderedIds = siblingIds.filter((id) => id !== draggedId)
    const insertionTargetIndex = reorderedIds.indexOf(targetId)
    const insertionIndex = position === 'after' ? insertionTargetIndex + 1 : insertionTargetIndex

    reorderedIds.splice(insertionIndex, 0, draggedId)

    if (reorderedIds.every((id, index) => id === siblingIds[index])) {
      return
    }

    await onReorder({
      listId: activeListId,
      parentId: targetTodo.parentId,
      completed: false,
      orderedIds: reorderedIds,
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveDragId(active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over, activatorEvent } = event
    setOverId(over?.id as string | null)
    
    // Calculate if we should drop before or after based on pointer position
    if (over && activatorEvent) {
      const overElement = document.querySelector(`[data-sortable-id="${over.id}"]`)
      if (overElement) {
        const rect = overElement.getBoundingClientRect()
        const pointerY = (activatorEvent as PointerEvent).clientY
        const midpoint = rect.top + rect.height / 2
        setDropPosition(pointerY < midpoint ? 'before' : 'after')
      }
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    setActiveDragId(null)
    setOverId(null)
    
    if (!over || active.id === over.id) {
      return
    }

    const draggedId = active.id as string
    const targetId = over.id as string
    
    await reorderWithinSiblingGroup(draggedId, targetId, dropPosition)
    setDropPosition('after') // Reset to default
  }

  const handleDragCancel = () => {
    setActiveDragId(null)
    setOverId(null)
  }

  const renderEditorRow = (targetId: string | 'new', depth = 0) => (
    <TodoInlineEditor
      key={targetId === 'new' ? 'new-editor' : `editor-${targetId}`}
      targetId={targetId}
      depth={depth}
      draft={draft}
      showDetails={showDetails}
      showDate={showDate}
      dateMode={dateMode}
      saveError={saveError}
      editorContainerRef={editorContainerRef}
      titleInputRef={titleInputRef}
      detailsInputRef={detailsInputRef}
      composeInputRef={composeInputRef}
      lastPointerInsideEditorAtRef={lastPointerInsideEditorAtRef}
      onTitleChange={(value) => { setSaveError(null); setDraft((prev) => ({ ...prev, title: value })) }}
      onDetailsChange={(value) => { setSaveError(null); setDraft((prev) => ({ ...prev, details: value })) }}
      onShowDetailsChange={setShowDetails}
      onShowDateChange={setShowDate}
      onDateModeChange={setDateMode}
      onSaveErrorChange={setSaveError}
      onApplyReminder={(timestamp) => setDraft((prev) => ({ ...prev, reminderAt: timestamp }))}
      onPersistAndClose={persistAndMaybeClose}
      onClose={closeEditor}
      onSetCompleted={onSetCompleted}
    />
  )

  const visibleCompletedItems = completedExpanded
    ? completedItems.slice(0, completedVisibleCount)
    : []
  const hasMoreCompleted = completedExpanded && completedVisibleCount < completedItems.length

  return (
    <ScrollArea className="h-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={activeItems.map(item => item.todo.id)}
          strategy={verticalListSortingStrategy}
        >
            <ul className="space-y-1 py-1 pr-2">
              {editingId !== 'new' || newParentId !== null ? (
                <li className="px-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full justify-start gap-2 border-dashed bg-card px-3 text-sm font-medium text-muted-foreground hover:border-solid hover:bg-muted/70 hover:text-foreground"
                    onClick={() => {
                      void openCreateEditor()
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {t('todo.addTask')}
                    <ShortcutHint shortcut="N" className="ml-auto" />
                  </Button>
                </li>
              ) : null}

              {editingId === 'new' && newParentId === null ? renderEditorRow('new', 0) : null}

              {activeTodos.length === 0 ? (
                <li className="px-4 py-8 text-center">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-foreground">{emptyLabel}</p>
                </li>
              ) : (
                <>
                  {activeItems.flatMap(({ todo, depth }) => {
                    const priority = todo.priority ?? 'none'
                    const status = todoStatus(todo)
                    const label = todo.labelId ? labelById.get(todo.labelId) : undefined
                    const isCompleting = completingIds.has(todo.id)
                    const rows: ReactNode[] = []

                    if (editingId === todo.id) {
                      rows.push(renderEditorRow(todo.id, depth))
                    } else {
                      rows.push(
                        <SortableTodoItem
                          key={todo.id}
                          id={todo.id}
                          depth={depth}
                          disabled={!canReorder || editingId !== null}
                          isDragging={activeDragId === todo.id}
                          isOver={overId === todo.id}
                          dropPosition={dropPosition}
                        >
                          <TaskRow
                            todo={todo}
                            priority={priority}
                            status={status}
                            label={label}
                            lists={lists}
                            labels={labels}
                            activeListId={activeListId}
                            isSelected={effectiveSelectedTodoId === todo.id && editingId === null}
                            isCompleting={isCompleting}
                            canReorder={canReorder && editingId === null}
                            onHover={() => setSelectedTodoId(todo.id)}
                            onOpen={() => {
                              setSelectedTodoId(todo.id)
                              void openTodoEditor(todo)
                            }}
                            onComplete={() => markTodoCompleteWithFeedback(todo.id)}
                            onSetStarred={onSetStarred}
                            onSetPriority={onSetPriority}
                            onSetStatus={onSetStatus}
                            onSetLabel={onSetLabel}
                            onDelete={onDelete}
                            onMoveToList={onMoveToList}
                            onOpenDateEditor={() => void openTodoEditor(todo, { showDate: true })}
                            onOpenSubtaskEditor={() => void openCreateEditor(todo.id)}
                          />
                        </SortableTodoItem>,
                      )
                    }

                    if (editingId === 'new' && newParentId === todo.id) {
                      rows.push(renderEditorRow('new', depth + 1))
                    }

                    return rows
                  })}
                </>
              )}

              <li className="mt-3 px-2 pt-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  onClick={() => {
                    setCompletedExpanded((current) => !current)
                  }}
                >
                  {completedExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span>{t('todo.completedTasks', { count: completedTodos.length })}</span>
                </button>
              </li>

              {completedExpanded ? (
                completedTodos.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-muted-foreground">{t('todo.noCompletedTasks')}</li>
                ) : (
                  <>
                      {visibleCompletedItems.map(({ todo, depth }) => {
                        const leftOffset = Math.min(depth, 6) * 16

                        return (
                          <li
                            key={`completed-${todo.id}`}
                            className="px-2 py-1"
                            style={leftOffset > 0 ? { paddingLeft: `${leftOffset + 8}px` } : undefined}
                          >
                            <div
                              className="group flex items-start gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border/80 hover:bg-card"
                            >
                              <Checkbox
                                checked
                                className="mt-0.5 border-muted-foreground/30 bg-background"
                                onCheckedChange={async (checked) => {
                                  if (checked === false) {
                                    await onSetCompleted(todo.id, false)
                                  }
                                }}
                                aria-label={t('todo.reopen', { title: todo.title })}
                              />

                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="max-w-full whitespace-normal break-words text-sm leading-5 text-muted-foreground line-through line-clamp-3">{todo.title}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {todo.completedAt
                                    ? t('todo.completedOn', { date: formatDateLabel(todo.completedAt) })
                                    : t('todo.completedLabel')}
                                </p>
                                {todo.priority && todo.priority !== 'none' ? (
                                  <p className={cn('mt-0.5 text-[11px]', todo.priority === 'urgent' ? 'text-destructive' : 'text-muted-foreground')}>
                                    {t('todo.priorityLabel', { priority: priorityLabel(todo.priority, t) })}
                                  </p>
                                ) : null}
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 opacity-70 text-muted-foreground transition-opacity hover:text-foreground group-hover:opacity-100"
                                    aria-label={`Actions pour ${todo.title}`}
                                  >
                                    <Ellipsis className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      void onSetCompleted(todo.id, false)
                                    }}
                                  >
                                    {t('todo.reopenTask')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      void onDeleteCompleted(todo.id)
                                    }}
                                  >
                                    {t('todo.deleteTask')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="px-2 py-1 text-xs text-muted-foreground">
                                    {t('todo.moveTo')}
                                  </DropdownMenuLabel>
                                  {lists.map((list) => {
                                    const isCurrentList = (todo.listId ?? activeListId) === list.id
                                    return (
                                      <DropdownMenuItem
                                        key={`move-completed-${todo.id}-${list.id}`}
                                        className="flex items-center justify-between gap-2"
                                        onSelect={() => {
                                          if (!isCurrentList) {
                                            void onMoveToList(todo.id, list.id)
                                          }
                                        }}
                                      >
                                        <span className="truncate">{list.name}</span>
                                        {isCurrentList ? <Check className="h-3.5 w-3.5" /> : null}
                                      </DropdownMenuItem>
                                    )
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-70 text-muted-foreground transition-opacity hover:text-foreground group-hover:opacity-100"
                                onClick={async () => {
                                  await onSetStarred(todo.id, !todo.starred)
                                }}
                                aria-label={todo.starred ? t('todo.removeFromFavorites', { title: todo.title }) : t('todo.addToFavorites', { title: todo.title })}
                              >
                                <Star
                                  className={cn(
                                    'h-3.5 w-3.5',
                                    todo.starred ? 'fill-foreground text-foreground' : 'text-muted-foreground',
                                  )}
                                />
                              </Button>
                            </div>
                          </li>
                        )
                      })}

                    {hasMoreCompleted ? (
                      <li className="px-3 pb-2 pt-1">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setCompletedVisibleCount((current) => current + COMPLETED_VISIBLE_STEP)
                          }}
                        >
                          {t('todo.showMore')}
                        </button>
                      </li>
                    ) : null}
                  </>
                )
              ) : null}
            </ul>
        </SortableContext>
        
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeDragId ? (() => {
            const todo = activeTodoById.get(activeDragId)
            if (!todo) return null
            const priority = todo.priority ?? 'none'
            return <DragOverlayContent todo={todo} priority={priority} labelById={labelById} />
          })() : null}
        </DragOverlay>
      </DndContext>
    </ScrollArea>
  )
}
