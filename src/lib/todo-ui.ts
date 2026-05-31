import type { Todo, TodoLabel, TodoPriority } from '@/types/todo'

export type TodoWithDepth = {
  todo: Todo
  depth: number
}

export const PRIORITY_ORDER: TodoPriority[] = ['none', 'low', 'medium', 'high', 'urgent']

export function priorityLabel(priority: TodoPriority, t: (key: string) => string): string {
  switch (priority) {
    case 'low': return t('priority.low')
    case 'medium': return t('priority.medium')
    case 'high': return t('priority.high')
    case 'urgent': return t('priority.urgent')
    default: return t('filter.none')
  }
}

export function priorityClasses(priority: TodoPriority): string {
  switch (priority) {
    case 'urgent': return 'border border-red-700/30 bg-red-500/15 text-red-700 dark:text-red-400 dark:border-red-500/30'
    case 'high': return 'border border-orange-700/30 bg-orange-500/15 text-orange-700 dark:text-orange-300 dark:border-orange-500/30'
    case 'medium': return 'border border-blue-700/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:border-blue-500/30'
    case 'low': return 'border border-border bg-muted text-muted-foreground'
    default: return 'border border-border bg-transparent text-muted-foreground'
  }
}

export function labelClasses(color: TodoLabel['color']): string {
  switch (color) {
    case 'slate': return 'border border-slate-700/30 bg-slate-500/15 text-slate-700 dark:text-slate-300 dark:border-slate-500/30'
    case 'blue': return 'border border-blue-700/30 bg-blue-500/15 text-blue-700 dark:text-blue-300 dark:border-blue-500/30'
    case 'green': return 'border border-green-700/30 bg-green-500/15 text-green-700 dark:text-green-300 dark:border-green-500/30'
    case 'orange': return 'border border-orange-700/30 bg-orange-500/15 text-orange-700 dark:text-orange-300 dark:border-orange-500/30'
    case 'rose': return 'border border-rose-700/30 bg-rose-500/15 text-rose-700 dark:text-rose-300 dark:border-rose-500/30'
    case 'violet': return 'border border-violet-700/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 dark:border-violet-500/30'
    default: return 'border border-border bg-muted text-muted-foreground'
  }
}

export function reminderBadgeClasses(variant: 'destructive' | 'blue' | 'default'): string {
  switch (variant) {
    case 'destructive': return 'border border-red-700/30 bg-red-500/15 text-red-700 hover:bg-red-500/20 dark:border-red-500/30 dark:text-red-400'
    case 'blue': return 'border border-blue-700/30 bg-blue-500/15 text-blue-700 dark:border-blue-500/30 dark:text-blue-400'
    case 'default': return 'border border-border bg-muted text-foreground'
  }
}

export function getTodayAtDefaultHour(): number {
  const now = new Date()
  now.setHours(18, 0, 0, 0)
  return now.getTime()
}

export function getTomorrowAtDefaultHour(): number {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return tomorrow.getTime()
}

export function getReminderBadgeStyle(
  timestamp: number,
  t: (key: string, options?: { count?: number; time?: string }) => string,
  i18n: { language: string },
): {
  label: string
  variant: 'destructive' | 'blue' | 'default'
} {
  const reminderDate = new Date(timestamp)
  const now = new Date()
  const isPast = timestamp < now.getTime()

  const reminderDay = new Date(reminderDate)
  reminderDay.setHours(0, 0, 0, 0)

  const todayDay = new Date(now)
  todayDay.setHours(0, 0, 0, 0)

  const dayMs = 24 * 60 * 60 * 1000
  const dayDiff = Math.round((reminderDay.getTime() - todayDay.getTime()) / dayMs)

  const locale = i18n.language === 'fr' ? 'fr-FR' : i18n.language === 'es' ? 'es-ES' : i18n.language === 'zh' ? 'zh-CN' : i18n.language === 'hi' ? 'hi-IN' : 'en-US'

  if (dayDiff === 0) {
    const timeStr = reminderDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    return { label: `${t('time.today')} ${timeStr}`, variant: isPast ? 'destructive' : 'blue' }
  }

  if (dayDiff < 0) {
    const absDays = Math.abs(dayDiff)
    if (absDays === 1) return { label: t('time.ago1Day'), variant: 'destructive' }
    if (absDays < 7) return { label: t('time.agoDays', { count: absDays }), variant: 'destructive' }
    const weeks = Math.floor(absDays / 7)
    if (weeks < 52) return { label: weeks === 1 ? t('time.ago1Week') : t('time.agoWeeks', { count: weeks }), variant: 'destructive' }
    const years = Math.floor(absDays / 365)
    return { label: years === 1 ? t('time.ago1Year') : t('time.agoYears', { count: years }), variant: 'destructive' }
  }

  const dateStr = reminderDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = reminderDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return { label: `${dateStr} ${timeStr}`, variant: 'default' }
}

export function buildTodoWithDepth(todos: Todo[]): TodoWithDepth[] {
  const todosById = new Map(todos.map((todo) => [todo.id, todo]))
  const childrenByParent = new Map<string, Todo[]>()

  for (const todo of todos) {
    if (!todo.parentId || !todosById.has(todo.parentId)) continue
    const siblings = childrenByParent.get(todo.parentId) ?? []
    siblings.push(todo)
    childrenByParent.set(todo.parentId, siblings)
  }

  const roots = todos.filter((todo) => !todo.parentId || !todosById.has(todo.parentId))
  const ordered: TodoWithDepth[] = []
  const visited = new Set<string>()

  const walk = (todo: Todo, depth: number) => {
    if (visited.has(todo.id)) return
    visited.add(todo.id)
    ordered.push({ todo, depth })
    const children = childrenByParent.get(todo.id) ?? []
    for (const child of children) walk(child, depth + 1)
  }

  for (const root of roots) walk(root, 0)
  for (const orphan of todos) {
    if (!visited.has(orphan.id)) walk(orphan, 0)
  }

  return ordered
}
