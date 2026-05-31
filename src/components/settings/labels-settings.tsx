import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Settings, TodoLabel } from '@/types/todo'

type LabelsSettingsProps = {
  settings: Settings
  onUpdateSettings: (partial: Partial<Settings>) => Promise<void>
}

export function LabelsSettings({
  settings,
  onUpdateSettings,
}: LabelsSettingsProps) {
  const { t } = useTranslation()
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>(
    Object.fromEntries(settings.labels.map((label) => [label.id, label.name])),
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabelDrafts(
      Object.fromEntries(settings.labels.map((label) => [label.id, label.name])),
    )
  }, [settings.labels])

  const COLOR_OPTIONS: Array<{ value: TodoLabel['color']; label: string }> = [
    { value: 'slate', label: t('settings.colors.slate') },
    { value: 'blue', label: t('settings.colors.blue') },
    { value: 'green', label: t('settings.colors.green') },
    { value: 'orange', label: t('settings.colors.orange') },
    { value: 'rose', label: t('settings.colors.rose') },
    { value: 'violet', label: t('settings.colors.violet') },
  ]

  const sortedLabels = useMemo(
    () => [...settings.labels].sort((a, b) => a.name.localeCompare(b.name, 'fr-FR')),
    [settings.labels],
  )

  const updateLabel = async (labelId: string, partial: Partial<TodoLabel>) => {
    const nextLabels = settings.labels.map((label) =>
      label.id === labelId ? { ...label, ...partial } : label,
    )
    await onUpdateSettings({ labels: nextLabels })
  }

  const removeLabel = async (labelId: string) => {
    const nextLabels = settings.labels.filter((label) => label.id !== labelId)
    await onUpdateSettings({ labels: nextLabels })
  }

  const addLabel = async () => {
    const newLabel: TodoLabel = {
      id: crypto.randomUUID(),
      name: t('settings.newLabel'),
      color: 'slate',
    }
    await onUpdateSettings({ labels: [...settings.labels, newLabel] })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">{t('settings.labels')}</h2>
          <p className="text-xs text-muted-foreground">Créez et gérez vos étiquettes</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={addLabel}>
              <Plus className="h-3.5 w-3.5" />
              {t('settings.addLabel')}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p>{t('settings.addLabelTooltip')}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="space-y-2">
        {sortedLabels.map((label) => (
          <div key={label.id} className="flex items-center gap-2">
            <span className={cn(
              'inline-flex h-2.5 w-2.5 rounded-full border',
              label.color === 'slate' && 'bg-slate-500/15 text-slate-700 border-slate-700/30 dark:text-slate-300 dark:border-slate-500/30',
              label.color === 'blue' && 'bg-blue-500/15 text-blue-600 border-blue-600/30 dark:text-blue-300 dark:border-blue-400/30',
              label.color === 'green' && 'bg-green-500/15 text-green-600 border-green-600/30 dark:text-green-300 dark:border-green-500/30',
              label.color === 'orange' && 'bg-orange-custom/15 text-orange-dark border-orange-custom/30 dark:text-orange-light dark:border-orange-custom/30',
              label.color === 'rose' && 'bg-rose-500/15 text-rose-700 border-rose-700/30 dark:text-rose-300 dark:border-rose-500/30',
              label.color === 'violet' && 'bg-violet-500/15 text-violet-700 border-violet-700/30 dark:text-violet-300 dark:border-violet-500/30',
            )} />
            <Input
              value={labelDrafts[label.id] ?? label.name}
              onChange={(event) => {
                setLabelDrafts((current) => ({
                  ...current,
                  [label.id]: event.currentTarget.value,
                }))
              }}
              onBlur={() => {
                const draftName = labelDrafts[label.id] ?? label.name
                const normalizedName = draftName.trim() || label.name
                if (normalizedName !== label.name) {
                  void updateLabel(label.id, { name: normalizedName })
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              className="h-7 flex-1 text-xs"
              aria-label={`Nom du label ${label.name}`}
            />
            <Select
              value={label.color}
              onValueChange={(value) => {
                void updateLabel(label.id, { color: value as TodoLabel['color'] })
              }}
            >
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLOR_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => {
                void removeLabel(label.id)
              }}
              aria-label={t('labels.deleteLabel', { name: label.name })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
