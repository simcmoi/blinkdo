import { ArrowLeft, BarChart3, CheckCircle2, ListTodo } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Todo } from '@/types/todo'

type StatisticsPageProps = {
  todos: Todo[]
  onBack: () => void
}

type DailyStats = {
  date: string
  dateFormatted: string
  created: number
  completed: number
}

export function StatisticsPage({ todos, onBack }: StatisticsPageProps) {
  const { t, i18n } = useTranslation()
  const [currentTime] = useState(() => Date.now())

  const locale = i18n.language === 'auto' ? 'fr-FR' : i18n.language

  const stats = useMemo(() => {
    const now = currentTime
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    const dailyStatsMap = new Map<string, DailyStats>()
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      dailyStatsMap.set(dateStr, {
        date: dateStr,
        dateFormatted: date.toLocaleDateString(locale, {
          day: '2-digit',
          month: '2-digit',
        }),
        created: 0,
        completed: 0,
      })
    }

    // Compter les tâches créées et complétées
    todos.forEach((todo) => {
      // Tâches créées
      if (todo.createdAt >= thirtyDaysAgo) {
        const createdDate = new Date(todo.createdAt).toISOString().split('T')[0]
        const stat = dailyStatsMap.get(createdDate)
        if (stat) {
          stat.created++
        }
      }

      // Tâches complétées
      if (todo.completedAt && todo.completedAt >= thirtyDaysAgo) {
        const completedDate = new Date(todo.completedAt).toISOString().split('T')[0]
        const stat = dailyStatsMap.get(completedDate)
        if (stat) {
          stat.completed++
        }
      }
    })

    const dailyStats = Array.from(dailyStatsMap.values())

    // Statistiques globales
    const totalTasks = todos.length
    const completedTasks = todos.filter((t) => t.completedAt).length
    const activeTasks = totalTasks - completedTasks
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Derniers 7 jours
    const last7Days = dailyStats.slice(-7)
    const createdLast7Days = last7Days.reduce((sum, stat) => sum + stat.created, 0)
    const completedLast7Days = last7Days.reduce((sum, stat) => sum + stat.completed, 0)

    return {
      dailyStats,
      totalTasks,
      completedTasks,
      activeTasks,
      completionRate,
      createdLast7Days,
      completedLast7Days,
    }
  }, [todos, currentTime, locale])

  const chartConfig = {
    created: {
      label: t('statistics.created'),
      color: 'hsl(var(--chart-1))',
    },
    completed: {
      label: t('statistics.completed'),
      color: 'hsl(var(--chart-2))',
    },
  } satisfies ChartConfig

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
            aria-label={t('app.backToHome')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{t('statistics.title')}</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {/* Cartes de résumé */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('statistics.totalTasks')}</CardDescription>
              <CardTitle className="text-2xl">{stats.totalTasks}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ListTodo className="h-3 w-3" />
                <span>{t('statistics.allTime')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('statistics.completedTasks')}</CardDescription>
              <CardTitle className="text-2xl">{stats.completedTasks}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                <span>{stats.completionRate}% {t('statistics.completed')}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('statistics.createdLast7Days')}</CardDescription>
              <CardTitle className="text-2xl">{stats.createdLast7Days}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xs text-muted-foreground">
                {t('statistics.lastWeek')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{t('statistics.completedLast7Days')}</CardDescription>
              <CardTitle className="text-2xl">{stats.completedLast7Days}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xs text-muted-foreground">
                {t('statistics.lastWeek')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Graphique des tâches créées */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('statistics.tasksCreatedPerDay')}</CardTitle>
            <CardDescription className="text-xs">{t('statistics.last30Days')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={stats.dailyStats}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="dateFormatted"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="created" fill="var(--color-created)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Graphique des tâches complétées */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('statistics.tasksCompletedPerDay')}</CardTitle>
            <CardDescription className="text-xs">{t('statistics.last30Days')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <BarChart data={stats.dailyStats}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="dateFormatted"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Graphique combiné */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('statistics.overview')}</CardTitle>
            <CardDescription className="text-xs">{t('statistics.createdVsCompleted')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart
                data={stats.dailyStats}
                margin={{
                  top: 20,
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="dateFormatted"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Line
                  dataKey="created"
                  type="monotone"
                  stroke="var(--color-created)"
                  strokeWidth={2}
                  dot={{
                    fill: 'var(--color-created)',
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />
                <Line
                  dataKey="completed"
                  type="monotone"
                  stroke="var(--color-completed)"
                  strokeWidth={2}
                  dot={{
                    fill: 'var(--color-completed)',
                  }}
                  activeDot={{
                    r: 6,
                  }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
