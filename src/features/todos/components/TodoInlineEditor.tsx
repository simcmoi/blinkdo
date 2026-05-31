import { type FocusEvent, type MutableRefObject } from 'react'
import { CalendarClock, FileText, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { cn } from '@/lib/utils'
import { getTodayAtDefaultHour, getTomorrowAtDefaultHour, getReminderBadgeStyle, reminderBadgeClasses } from '@/lib/todo-ui'

type TodoDraft = {
  title: string
  details: string
  reminderAt?: number
}

type DateEditMode = 'date' | 'datetime' | null

export type TodoInlineEditorProps = {
  targetId: string | 'new'
  depth: number
  draft: TodoDraft
  showDetails: boolean
  showDate: boolean
  dateMode: DateEditMode
  saveError: string | null
  editorContainerRef: MutableRefObject<HTMLDivElement | null>
  titleInputRef: MutableRefObject<HTMLTextAreaElement | null>
  detailsInputRef: MutableRefObject<HTMLInputElement | null>
  composeInputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>
  lastPointerInsideEditorAtRef: MutableRefObject<number>
  onTitleChange: (value: string) => void
  onDetailsChange: (value: string) => void
  onShowDetailsChange: (show: boolean) => void
  onShowDateChange: (show: boolean) => void
  onDateModeChange: (mode: DateEditMode) => void
  onSaveErrorChange: (error: string | null) => void
  onApplyReminder: (timestamp: number | undefined) => void
  onPersistAndClose: (shouldClose: boolean, reopenAfterCreate?: boolean) => Promise<boolean>
  onClose: () => void
  onSetCompleted: (id: string, completed: boolean) => Promise<void>
}

export function TodoInlineEditor({
  targetId,
  depth,
  draft,
  showDetails,
  showDate,
  dateMode,
  saveError,
  editorContainerRef,
  titleInputRef,
  detailsInputRef,
  composeInputRef,
  lastPointerInsideEditorAtRef,
  onTitleChange,
  onDetailsChange,
  onShowDetailsChange,
  onShowDateChange,
  onDateModeChange,
  onSaveErrorChange,
  onApplyReminder,
  onPersistAndClose,
  onClose,
  onSetCompleted,
}: TodoInlineEditorProps) {
  const { t, i18n } = useTranslation()

  const isExistingTodo = targetId !== 'new'
  const leftOffset = Math.min(depth, 6) * 16
  const reminderBadgeStyle = draft.reminderAt ? getReminderBadgeStyle(draft.reminderAt, t, i18n) : null

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocused = event.relatedTarget
    if (nextFocused && event.currentTarget.contains(nextFocused)) return

    window.setTimeout(() => {
      const root = editorContainerRef.current
      if (!root) return
      if (window.performance.now() - lastPointerInsideEditorAtRef.current < 200) return

      const active = document.activeElement
      if (active && root.contains(active)) return

      void onPersistAndClose(true)
    }, 0)
  }

  return (
    <li
      key={targetId === 'new' ? 'new-editor' : `editor-${targetId}`}
      className="py-1"
      style={leftOffset > 0 ? { paddingLeft: `${leftOffset + 8}px` } : undefined}
    >
      <div
        ref={editorContainerRef}
        className="flex items-start gap-1.5 rounded-md bg-background px-2 py-2"
        onPointerDownCapture={() => { lastPointerInsideEditorAtRef.current = window.performance.now() }}
        onBlur={onBlur}
      >
        {isExistingTodo ? (
          <Checkbox
            className="mt-2"
            checked={false}
            onCheckedChange={async () => {
              await onSetCompleted(targetId, true)
              onClose()
            }}
            aria-label={t('todo.markAsCompleted')}
          />
        ) : (
          <Checkbox className="mt-2" checked={false} disabled aria-label={t('todo.newTask')} />
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <Textarea
            ref={(node) => {
              titleInputRef.current = node
              composeInputRef.current = node
            }}
            value={draft.title}
            onChange={(event) => {
              onSaveErrorChange(null)
              const newValue = event.target.value
              if (newValue.length <= 1000) {
                onTitleChange(newValue)
                const target = event.target
                target.style.height = 'auto'
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault()
                onShowDetailsChange(true)
                setTimeout(() => detailsInputRef.current?.focus(), 0)
                return
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void onPersistAndClose(true, true)
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                event.stopPropagation()
                onClose()
              }
            }}
            placeholder={t('todo.taskTitle')}
            maxLength={1000}
            rows={1}
            className="min-h-[32px] max-h-[120px] resize-none overflow-y-auto border-none bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center gap-1.5">
            {!showDetails && draft.details.trim().length === 0 && (
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {showDetails || draft.details.trim().length > 0 ? (
              <Input
                ref={detailsInputRef}
                value={draft.details}
                onChange={(event) => {
                  onSaveErrorChange(null)
                  onDetailsChange(event.target.value)
                }}
                onBlur={(event) => {
                  if (!event.target.value.trim()) onShowDetailsChange(false)
                }}
                placeholder={t('todo.detail')}
                className="h-6 border-none bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  onShowDetailsChange(true)
                  setTimeout(() => detailsInputRef.current?.focus(), 0)
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t('todo.detail')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {draft.reminderAt ? (
              <div className="inline-flex items-center gap-1">
                <Popover
                  modal={false}
                  open={showDate && dateMode === 'datetime'}
                  onOpenChange={(open) => {
                    onShowDateChange(open)
                    if (!open) onDateModeChange(null)
                  }}
                >
                  <PopoverTrigger asChild>
                    <Badge
                      asChild
                      variant="ghost"
                      className={cn(
                        "cursor-pointer rounded-md h-6 px-2 gap-1.5",
                        reminderBadgeStyle && reminderBadgeClasses(reminderBadgeStyle.variant),
                        reminderBadgeStyle?.variant === 'destructive' && "hover:bg-red-500/20",
                        reminderBadgeStyle?.variant === 'blue' && "hover:bg-blue-500/20",
                        reminderBadgeStyle?.variant === 'default' && "hover:bg-muted/60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSaveErrorChange(null)
                          onShowDateChange(true)
                          onDateModeChange('datetime')
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
                      onDateTimeChange={(date) => onApplyReminder(date.getTime())}
                      onClose={() => {
                        onShowDateChange(false)
                        onDateModeChange(null)
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
                    onSaveErrorChange(null)
                    onApplyReminder(undefined)
                  }}
                  aria-label={t('todo.removeDate')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  tabIndex={0}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => {
                    onSaveErrorChange(null)
                    onApplyReminder(getTodayAtDefaultHour())
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSaveErrorChange(null)
                      onApplyReminder(getTodayAtDefaultHour())
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
                    onSaveErrorChange(null)
                    onApplyReminder(getTomorrowAtDefaultHour())
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSaveErrorChange(null)
                      onApplyReminder(getTomorrowAtDefaultHour())
                    }
                  }}
                >
                  {t('time.tomorrow')}
                </Button>
                <span className="text-xs text-muted-foreground">|</span>
                <Popover
                  modal={false}
                  open={showDate && dateMode === 'datetime'}
                  onOpenChange={(open) => {
                    onShowDateChange(open)
                    if (!open) onDateModeChange(null)
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      tabIndex={0}
                      className="h-6 w-6 p-0 focus-visible:ring-1 focus-visible:ring-ring"
                      onClick={() => {
                        onSaveErrorChange(null)
                        onShowDateChange(true)
                        onDateModeChange('datetime')
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSaveErrorChange(null)
                          onShowDateChange(true)
                          onDateModeChange('datetime')
                        }
                      }}
                    >
                      <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <DateTimePicker
                      date={draft.reminderAt ? new Date(draft.reminderAt) : undefined}
                      onDateTimeChange={(date) => onApplyReminder(date.getTime())}
                      onClose={() => {
                        onShowDateChange(false)
                        onDateModeChange(null)
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
