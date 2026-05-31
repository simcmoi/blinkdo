import {
  type FocusEvent,
  type MutableRefObject,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AlertTriangle, CalendarClock, Check, ChevronDown, ChevronRight, Ellipsis, FileText, Plus, Star, Tags, X } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { cn } from '@/lib/utils'
import type { Todo, TodoLabel, TodoListMeta, TodoPriority } from '@/types/todo'
import { useSoundEffects } from '@/hooks/useSoundEffects'

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

type TodoWithDepth = {
  todo: Todo
  depth: number
}

const INITIAL_COMPLETED_VISIBLE_COUNT = 5
const COMPLETED_VISIBLE_STEP = 10
const PRIORITY_ORDER: TodoPriority[] = ['none', 'low', 'medium', 'high', 'urgent']

function priorityLabel(priority: TodoPriority, t: (key: string) => string): string {
  switch (priority) {
    case 'low':
      return t('priority.low')
    case 'medium':
      return t('priority.medium')
    case 'high':
      return t('priority.high')
    case 'urgent':
      return t('priority.urgent')
    default:
      return t('filter.none')
  }
}

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


function labelClasses(color: TodoLabel['color']): string {
  switch (color) {
    case 'slate':
      return 'border border-slate-700/30 bg-slate-500/15 text-slate-700 dark:text-slate-300 dark:border-slate-500/30'
    case 'blue':
      return 'border border-blue-700/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:border-blue-500/30'
    case 'green':
      return 'border border-green-700/30 bg-green-500/15 text-green-700 dark:text-green-300 dark:border-green-500/30'
    case 'orange':
      return 'border border-orange-700/30 bg-orange-500/15 text-orange-700 dark:text-orange-300 dark:border-orange-500/30'
    case 'rose':
      return 'border border-rose-700/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 dark:border-rose-500/30'
    case 'violet':
      return 'border border-violet-700/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 dark:border-violet-500/30'
    default:
      return 'border border-border bg-muted text-muted-foreground'
  }
}

function reminderBadgeClasses(variant: 'destructive' | 'blue' | 'default'): string {
  switch (variant) {
    case 'destructive':
      return 'border border-red-700/30 bg-red-500/15 text-red-700 hover:bg-red-500/20 dark:border-red-500/30 dark:text-red-400'
    case 'blue':
      return 'border border-blue-700/30 bg-blue-500/15 text-blue-700 dark:border-blue-500/30 dark:text-blue-400'
    case 'default':
      return 'border border-border bg-muted text-foreground'
  }
}

function getTodayAtDefaultHour(): number {
  const now = new Date()
  now.setHours(18, 0, 0, 0)
  return now.getTime()
}

function getTomorrowAtDefaultHour(): number {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return tomorrow.getTime()
}

function getReminderBadgeStyle(
  timestamp: number, 
  t: (key: string, options?: { count?: number; time?: string }) => string,
  i18n: { language: string }
): {
  label: string
  variant: 'destructive' | 'blue' | 'default'
} {
  const reminderDate = new Date(timestamp)
  const now = new Date()
  
  // Comparer le timestamp complet (date + heure)
  const isPast = timestamp < now.getTime()
  
  // Comparer juste les jours pour afficher le bon label
  const reminderDay = new Date(reminderDate)
  reminderDay.setHours(0, 0, 0, 0)
  
  const todayDay = new Date(now)
  todayDay.setHours(0, 0, 0, 0)
  
  const dayMs = 24 * 60 * 60 * 1000
  const dayDiff = Math.round((reminderDay.getTime() - todayDay.getTime()) / dayMs)
  
  // Get locale for date formatting
  const locale = i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US'
  
  // Aujourd'hui
  if (dayDiff === 0) {
    const timeStr = reminderDate.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
    // Rouge si l'heure est passée, bleu sinon
    return { 
      label: `${t('time.today')} ${timeStr}`, 
      variant: isPast ? 'destructive' : 'blue' 
    }
  }
  
  // Passé (hier ou avant)
  if (dayDiff < 0) {
    const absDays = Math.abs(dayDiff)
    
    if (absDays === 1) {
      return { label: t('time.ago1Day'), variant: 'destructive' }
    }
    
    if (absDays < 7) {
      return { label: t('time.agoDays', { count: absDays }), variant: 'destructive' }
    }
    
    const weeks = Math.floor(absDays / 7)
    if (weeks < 52) {
      return { 
        label: weeks === 1 ? t('time.ago1Week') : t('time.agoWeeks', { count: weeks }), 
        variant: 'destructive' 
      }
    }
    
    const years = Math.floor(absDays / 365)
    return { 
      label: years === 1 ? t('time.ago1Year') : t('time.agoYears', { count: years }), 
      variant: 'destructive' 
    }
  }
  
  // Futur (demain ou après)
  const dateStr = reminderDate.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const timeStr = reminderDate.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  
  return { label: `${dateStr} ${timeStr}`, variant: 'default' }
}


function buildTodoWithDepth(todos: Todo[]): TodoWithDepth[] {
  const todosById = new Map(todos.map((todo) => [todo.id, todo]))
  const childrenByParent = new Map<string, Todo[]>()

  for (const todo of todos) {
    if (!todo.parentId || !todosById.has(todo.parentId)) {
      continue
    }

    const siblings = childrenByParent.get(todo.parentId) ?? []
    siblings.push(todo)
    childrenByParent.set(todo.parentId, siblings)
  }

  const roots = todos.filter((todo) => !todo.parentId || !todosById.has(todo.parentId))
  const ordered: TodoWithDepth[] = []
  const visited = new Set<string>()

  const walk = (todo: Todo, depth: number) => {
    if (visited.has(todo.id)) {
      return
    }

    visited.add(todo.id)
    ordered.push({ todo, depth })

    const children = childrenByParent.get(todo.id) ?? []
    for (const child of children) {
      walk(child, depth + 1)
    }
  }

  for (const root of roots) {
    walk(root, 0)
  }

  for (const orphan of todos) {
    if (!visited.has(orphan.id)) {
      walk(orphan, 0)
    }
  }

  return ordered
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
      layout
      initial={{ opacity: 0, y: 6, scale: 0.985 }}
      animate={{ opacity: isCurrentlyDragging ? 0.4 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 580, damping: 38, mass: 0.5 }}
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

// Component to render the dragged item in the overlay
type DragOverlayContentProps = {
  todo: Todo
  priority: TodoPriority
  labelById: Map<string, TodoLabel>
}

function DragOverlayContent({ todo, priority, labelById }: DragOverlayContentProps) {
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
              <Badge
                variant="ghost"
                className={cn(
                  'h-5 px-1.5 py-0 rounded-md',
                  priorityClasses(priority),
                )}
              >
                {priority === 'urgent' ? <AlertTriangle className="h-3 w-3" /> : null}
                {priorityLabel(priority, t)}
              </Badge>
            ) : null}
            {label ? (
              <Badge
                variant="ghost"
                className={cn(
                  'h-5 px-1.5 py-0 rounded-md',
                  labelClasses(label.color),
                )}
              >
                <Tags className="h-3 w-3" />
                {label.name}
              </Badge>
            ) : null}
          </div>
        )}
      </div>
      <Star className={cn(
        'h-3.5 w-3.5 mt-1',
        todo.starred ? 'fill-foreground' : 'text-muted-foreground'
      )} />
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const activeItems = useMemo(() => buildTodoWithDepth(activeTodos), [activeTodos])
  const completedItems = useMemo(() => buildTodoWithDepth(completedTodos), [completedTodos])

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


  const closeEditor = () => {
    setEditingId(null)
    setNewParentId(null)
    setDraft({ title: '', details: '' })
    setSaveError(null)
    setShowDetails(false)
    setShowDate(false)
    setDateMode(null)
  }

  const persistAndMaybeClose = async (shouldClose: boolean, reopenAfterCreate = false): Promise<boolean> => {
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
  }

  const openCreateEditor = async (parentId?: string) => {
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
  }

  const openTodoEditor = async (
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
  }

  const onEditorBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocused = event.relatedTarget
    if (nextFocused && event.currentTarget.contains(nextFocused)) {
      return
    }

    window.setTimeout(() => {
      const root = editorContainerRef.current
      if (!root) {
        return
      }

      // macOS may not focus buttons on click; keep editor open for recent internal pointer interactions.
      if (window.performance.now() - lastPointerInsideEditorAtRef.current < 200) {
        return
      }

      const active = document.activeElement
      if (active && root.contains(active)) {
        return
      }

      void persistAndMaybeClose(true)
    }, 0)
  }

  const applyReminder = (timestamp: number | undefined) => {
    setDraft((previous) => ({
      ...previous,
      reminderAt: timestamp,
    }))
  }

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

  const renderEditorRow = (targetId: string | 'new', depth = 0) => {
    const isExistingTodo = targetId !== 'new'
    const detailsInputVisible = showDetails || draft.details.trim().length > 0
    const leftOffset = Math.min(depth, 6) * 16
    const reminderBadgeStyle = draft.reminderAt ? getReminderBadgeStyle(draft.reminderAt, t, i18n) : null

    return (
      <li
        key={targetId === 'new' ? 'new-editor' : `editor-${targetId}`}
        className="py-1"
        style={leftOffset > 0 ? { paddingLeft: `${leftOffset + 8}px` } : undefined}
      >
        <div
          ref={editorContainerRef}
          className="flex items-start gap-1.5 rounded-md bg-background px-2 py-2"
          onPointerDownCapture={() => {
            lastPointerInsideEditorAtRef.current = window.performance.now()
          }}
          onBlur={onEditorBlur}
        >
          {isExistingTodo ? (
            <Checkbox
              className="mt-2"
              checked={false}
              onCheckedChange={async () => {
                await onSetCompleted(targetId, true)
                closeEditor()
              }}
              aria-label={t('todo.markAsCompleted')}
            />
          ) : (
            <Checkbox className="mt-2" checked={false} disabled aria-label={t('todo.newTask')} />
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Ligne 1: Titre */}
            <Textarea
              ref={(node) => {
                titleInputRef.current = node
                composeInputRef.current = node
              }}
              value={draft.title}
              onChange={(event) => {
                setSaveError(null)
                const newValue = event.target.value
                if (newValue.length <= 1000) {
                  setDraft((previous) => ({
                    ...previous,
                    title: newValue,
                  }))
                  
                  // Auto-resize immediately during typing
                  const target = event.target
                  target.style.height = 'auto'
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Tab' && !event.shiftKey) {
                  event.preventDefault()
                  setShowDetails(true)
                  setTimeout(() => detailsInputRef.current?.focus(), 0)
                  return
                }

                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void persistAndMaybeClose(true, true) // reopen after create
                }

                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation() // Prevent window from closing
                  closeEditor()
                }
              }}
              placeholder={t('todo.taskTitle')}
              maxLength={1000}
              rows={1}
              className="min-h-[32px] max-h-[120px] resize-none overflow-y-auto border-none bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0"
            />

            {/* Ligne 2: Détails */}
            <div className="flex items-center gap-1.5">
              {!detailsInputVisible && (
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              {detailsInputVisible ? (
                <Input
                  ref={detailsInputRef}
                  value={draft.details}
                  onChange={(event) => {
                    setSaveError(null)
                    setDraft((previous) => ({
                      ...previous,
                      details: event.target.value,
                    }))
                  }}
                  onBlur={(event) => {
                    if (!event.target.value.trim()) {
                      setShowDetails(false)
                    }
                  }}
                  placeholder={t('todo.detail')}
                  className="h-6 border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(true)
                    setTimeout(() => detailsInputRef.current?.focus(), 0)
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('todo.detail')}
                </button>
              )}
            </div>

            {/* Ligne 3: Date rapide */}
            <div className="flex items-center gap-2">
              {draft.reminderAt ? (
                <div className="inline-flex items-center gap-1">
                  {/* Badge de date avec couleurs conditionnelles et bouton × intégré */}
                  <Popover modal={false} open={showDate && dateMode === 'datetime'} onOpenChange={(open) => {
                    setShowDate(open)
                    if (!open) {
                      setDateMode(null)
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Badge
                        asChild
                        variant="ghost"
                        className={cn(
                          "cursor-pointer rounded-md h-6 px-2 gap-1.5",
                          reminderBadgeStyle && reminderBadgeClasses(reminderBadgeStyle.variant),
                          reminderBadgeStyle?.variant === 'destructive' && "hover:bg-red-500/20",
                          reminderBadgeStyle?.variant === 'blue' && "hover:bg-blue-500/20",
                          reminderBadgeStyle?.variant === 'default' && "hover:bg-muted/60"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSaveError(null)
                            setShowDate(true)
                            setDateMode('datetime')
                          }}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {reminderBadgeStyle?.label}
                        </button>
                      </Badge>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DateTimePicker
                        date={new Date(draft.reminderAt)}
                        onDateTimeChange={(date) => {
                          applyReminder(date.getTime())
                        }}
                        onClose={() => {
                          setShowDate(false)
                          setDateMode(null)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSaveError(null)
                      applyReminder(undefined)
                    }}
                    aria-label={t('todo.removeDate')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  {/* Boutons rapides: Aujourd'hui | Demain | Calendrier */}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    tabIndex={0}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={() => {
                      setSaveError(null)
                      applyReminder(getTodayAtDefaultHour())
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSaveError(null)
                        applyReminder(getTodayAtDefaultHour())
                      }
                    }}
                  >
                    {t('time.today')}
                  </Button>
                  <span className="text-xs text-muted-foreground">|</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    tabIndex={0}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={() => {
                      setSaveError(null)
                      applyReminder(getTomorrowAtDefaultHour())
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSaveError(null)
                        applyReminder(getTomorrowAtDefaultHour())
                      }
                    }}
                  >
                    {t('time.tomorrow')}
                  </Button>
                  <span className="text-xs text-muted-foreground">|</span>
                  <Popover modal={false} open={showDate && dateMode === 'datetime'} onOpenChange={(open) => {
                    setShowDate(open)
                    if (!open) {
                      setDateMode(null)
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        tabIndex={0}
                        className="h-6 w-6 p-0 focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => {
                          setSaveError(null)
                          setShowDate(true)
                          setDateMode('datetime')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setSaveError(null)
                            setShowDate(true)
                            setDateMode('datetime')
                          }
                        }}
                      >
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <DateTimePicker
                        date={draft.reminderAt ? new Date(draft.reminderAt) : undefined}
                        onDateTimeChange={(date) => {
                          applyReminder(date.getTime())
                        }}
                        onClose={() => {
                          setShowDate(false)
                          setDateMode(null)
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>

            {saveError ? <p className="text-xs text-muted-foreground">{`Échec de sauvegarde: ${saveError}`}</p> : null}
          </div>
        </div>
      </li>
    )
  }

  const visibleCompletedItems = completedExpanded
    ? completedItems.slice(0, completedVisibleCount)
    : []
  const hasMoreCompleted = completedExpanded && completedVisibleCount < completedItems.length

  return (
    <ScrollArea className="h-full rounded-md">
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
          <LayoutGroup id="todo-items">
            <ul className="space-y-2 py-1 pr-2">
              {editingId !== 'new' || newParentId !== null ? (
                <li className="px-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full justify-start gap-2 border-dashed bg-muted/40 px-3 text-sm font-medium text-foreground hover:border-solid hover:bg-muted/70"
                    onClick={() => {
                      void openCreateEditor()
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    {t('todo.addTask')}
                  </Button>
                </li>
              ) : null}

              {editingId === 'new' && newParentId === null ? (
                <li className="rounded-lg border border-border bg-muted/40 px-2 py-2">
                  {renderEditorRow('new', 0)}
                </li>
              ) : null}

              {activeTodos.length === 0 ? (
                <li className="px-4 py-4 text-center text-sm text-muted-foreground">{emptyLabel}</li>
              ) : (
                <AnimatePresence initial={false}>
                  {activeItems.flatMap(({ todo, depth }) => {
                    const priority = todo.priority ?? 'none'
                    const label = todo.labelId ? labelById.get(todo.labelId) : undefined
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
                          <motion.div
                            layout
                            layoutId={`todo-card-${todo.id}`}
                            className={cn(
                              'flex items-start gap-1.5 rounded-md px-1 py-1 hover:bg-muted/60 transition-colors',
                              priority === 'urgent' ? 'ring-1 ring-destructive/35' : undefined,
                              canReorder && editingId === null ? 'cursor-grab active:cursor-grabbing' : undefined,
                            )}
                          >
                            <Checkbox
                              className="mt-0.5"
                              checked={Boolean(todo.completedAt)}
                              onCheckedChange={async (checked) => {
                                if (checked === true) {
                                  await onSetCompleted(todo.id, true)
                                }
                              }}
                              aria-label={t('todo.markCompleted', { title: todo.title })}
                            />

                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left overflow-hidden"
                            onClick={() => {
                              void openTodoEditor(todo)
                            }}
                          >
                            <p className="text-sm text-foreground line-clamp-3 break-all whitespace-normal max-w-[500px]">{todo.title}</p>
                            {(todo.details || todo.reminderAt || priority !== 'none' || label) && (
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {todo.reminderAt ? (
                                  (() => {
                                    const badgeStyle = getReminderBadgeStyle(todo.reminderAt, t, i18n)
                                    return (
                                      <Badge
                                        variant="ghost"
                                        className={cn(
                                          "h-5 px-1.5 py-0 rounded-md",
                                          reminderBadgeClasses(badgeStyle.variant),
                                        )}
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
                                    className={cn(
                                      'h-5 px-1.5 py-0 rounded-md',
                                      priorityClasses(priority),
                                    )}
                                  >
                                    {priority === 'urgent' ? <AlertTriangle className="h-3 w-3" /> : null}
                                    {priorityLabel(priority, t)}
                                  </Badge>
                                ) : null}
                                {label ? (
                                  <Badge
                                    variant="ghost"
                                    className={cn(
                                      'h-5 px-1.5 py-0 rounded-md',
                                      labelClasses(label.color),
                                    )}
                                  >
                                    <Tags className="h-3 w-3" />
                                    {label.name}
                                  </Badge>
                                ) : null}
                                {todo.details ? (
                                  <Badge
                                    variant="outline"
                                    className="h-5 px-1.5 py-0 rounded-md text-muted-foreground max-w-[200px]"
                                  >
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{todo.details}</span>
                                  </Badge>
                                ) : null}
                              </div>
                            )}
                          </button>

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
                                <DropdownMenuSubTrigger>{t('todo.priority')}</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-40">
                                  {PRIORITY_ORDER.map((option) => (
                                    <DropdownMenuItem
                                      key={option}
                                      className={cn(option === priority ? 'font-medium' : undefined)}
                                      onSelect={() => {
                                        void onSetPriority(todo.id, option)
                                      }}
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
                                    className={cn(!label ? 'font-medium' : undefined)}
                                    onSelect={() => {
                                      void onSetLabel(todo.id, undefined)
                                    }}
                                  >
                                    {t('todo.noLabel')}
                                  </DropdownMenuItem>
                                  {labels.map((item) => (
                                    <DropdownMenuItem
                                      key={item.id}
                                      className={cn(item.id === todo.labelId ? 'font-medium' : undefined)}
                                      onSelect={() => {
                                        void onSetLabel(todo.id, item.id)
                                      }}
                                    >
                                      {item.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => {
                                  void openTodoEditor(todo, { showDate: true })
                                }}
                              >
                                {t('todo.addDueDate')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  void openCreateEditor(todo.id)
                                }}
                              >
                                {t('todo.addSubtask')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  void onDelete(todo.id)
                                }}
                              >
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
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                        </motion.div>
                        </SortableTodoItem>,
                      )
                    }

                    if (editingId === 'new' && newParentId === todo.id) {
                      rows.push(renderEditorRow('new', depth + 1))
                    }

                    return rows
                  })}
                </AnimatePresence>
              )}

              <li className="mt-2 px-2 pt-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-1 text-left text-sm text-muted-foreground hover:text-foreground"
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
                    <AnimatePresence initial={false}>
                      {visibleCompletedItems.map(({ todo, depth }) => {
                        const leftOffset = Math.min(depth, 6) * 16

                        return (
                          <motion.li
                            key={`completed-${todo.id}`}
                            layout
                            initial={{ opacity: 0, y: 8, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 10, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 580, damping: 38, mass: 0.5 }}
                            className="px-2 py-1"
                            style={leftOffset > 0 ? { paddingLeft: `${leftOffset + 8}px` } : undefined}
                          >
                            <motion.div
                              layout
                              layoutId={`todo-card-${todo.id}`}
                              className="flex items-start gap-1.5 rounded-md px-1 py-1 hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                checked
                                className="mt-0.5"
                                onCheckedChange={async (checked) => {
                                  if (checked === false) {
                                    await onSetCompleted(todo.id, false)
                                  }
                                }}
                                aria-label={t('todo.reopen', { title: todo.title })}
                              />

                              <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="text-sm text-muted-foreground line-through line-clamp-3 break-all whitespace-normal max-w-[500px]">{todo.title}</p>
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
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                            </motion.div>
                          </motion.li>
                        )
                      })}
                    </AnimatePresence>

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
          </LayoutGroup>
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
