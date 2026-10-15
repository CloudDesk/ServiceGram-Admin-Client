import { useMemo, useState } from 'react'
import type { EChartsCoreOption } from 'echarts/core'
import { Clock3 } from 'lucide-react'
import { ErrorState } from '../../../components/ui/ErrorState'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { Skeleton } from '../../../components/ui/Skeleton'
import { SummaryMetricCard } from '../../../components/ui/SummaryMetricCard'
import { useTheme } from '../../../providers/themeContext'
import { usePeakTimeOrders } from '../hooks/usePeakTimeOrders'
import { DashboardChart } from './DashboardChart'

type PeakTimesRange = '7d' | '30d' | '90d'

const rangeOptions: { value: PeakTimesRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
]

function formatHourLabel(hour: number) {
  const period = hour < 12 ? 'AM' : 'PM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12

  return `${displayHour} ${period}`
}

export function PeakTimesPanel({ active }: { active: boolean }) {
  const [range, setRange] = useState<PeakTimesRange>('30d')
  const { theme } = useTheme()
  const { charts } = theme
  const peakTimesQuery = usePeakTimeOrders(range, active)
  const data = peakTimesQuery.data

  const hourlyOption = useMemo<EChartsCoreOption>(() => {
    const hourly = data?.hourly ?? []

    return {
      aria: { enabled: true },
      color: [charts.palette[0]],
      grid: { bottom: 28, containLabel: true, left: 4, right: 12, top: 12 },
      tooltip: { trigger: 'axis' },
      xAxis: {
        axisLabel: { color: charts.axisMuted, interval: 2 },
        data: hourly.map((row) => formatHourLabel(row.hour)),
        type: 'category',
      },
      yAxis: {
        axisLabel: { color: charts.axisMuted },
        splitLine: { lineStyle: { color: charts.splitLine } },
        type: 'value',
      },
      series: [
        {
          barMaxWidth: 18,
          data: hourly.map((row) => ({
            itemStyle: { borderRadius: [4, 4, 0, 0] },
            value: row.orders,
          })),
          name: 'Orders',
          type: 'bar',
        },
      ],
    }
  }, [charts, data])

  const heatmapOption = useMemo<EChartsCoreOption>(() => {
    const heatmap = data?.heatmap ?? []
    const dayIndexes = Array.from(new Set(heatmap.map((cell) => cell.dayIndex))).sort(
      (left, right) => left - right,
    )
    const dayLabelByIndex = new Map(
      heatmap.map((cell) => [cell.dayIndex, cell.dayOfWeek]),
    )
    const dayLabels = dayIndexes.map((dayIndex) => dayLabelByIndex.get(dayIndex) ?? '')
    const hourLabels = Array.from({ length: 24 }, (_, hour) => formatHourLabel(hour))
    const maxCount = Math.max(1, ...heatmap.map((cell) => cell.orders))

    return {
      aria: { enabled: true },
      grid: { bottom: 28, containLabel: true, left: 8, right: 8, top: 8 },
      tooltip: { position: 'top' },
      visualMap: {
        calculable: false,
        inRange: { color: [...charts.heatmapRange] },
        max: maxCount,
        min: 0,
        show: false,
      },
      xAxis: {
        axisLabel: { color: charts.axisMuted, interval: 2 },
        data: hourLabels,
        splitArea: { show: true },
        type: 'category',
      },
      yAxis: {
        axisLabel: { color: charts.axisStrong },
        data: dayLabels,
        splitArea: { show: true },
        type: 'category',
      },
      series: [
        {
          data: heatmap.map((cell) => ({
            value: [cell.hour, dayIndexes.indexOf(cell.dayIndex), cell.orders],
          })),
          emphasis: {
            itemStyle: {
              borderColor: charts.border,
              borderWidth: 1,
            },
          },
          name: 'Orders by day and hour',
          type: 'heatmap',
        },
      ],
    }
  }, [charts, data])

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          See which hours and days receive the most orders, so staffing and vendor capacity can
          match real demand.
        </p>
        <SegmentedControl
          aria-label="Peak times range"
          options={rangeOptions}
          value={range}
          onChange={setRange}
        />
      </div>

      {peakTimesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : null}

      {peakTimesQuery.isError ? (
        <ErrorState
          description="We could not load peak order times right now. Please try again."
          title="Unable to load peak times"
          onRetry={() => void peakTimesQuery.refetch()}
        />
      ) : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryMetricCard
              hint={
                data.topHour
                  ? `${data.topHour.orders} orders in this hour`
                  : 'No orders in this window'
              }
              label="Peak hour"
              value={data.topHour ? formatHourLabel(data.topHour.hour) : '—'}
            />
            <SummaryMetricCard
              hint={
                data.topDay
                  ? `${data.topDay.orders} orders on this day`
                  : 'No orders in this window'
              }
              label="Peak day"
              value={data.topDay ? data.topDay.dayOfWeek : '—'}
            />
          </div>

          <div className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
            <div className="mb-2 flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Orders by hour of day</h3>
            </div>
            <DashboardChart className="h-72 min-h-72" option={hourlyOption} />
          </div>

          <div className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
            <div className="mb-2 flex items-center gap-2">
              <Clock3 className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Orders by day and hour</h3>
            </div>
            <DashboardChart className="h-80 min-h-80" option={heatmapOption} />
          </div>
        </>
      ) : null}
    </section>
  )
}
