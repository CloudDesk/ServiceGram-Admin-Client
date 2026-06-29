import { useEffect, useRef } from 'react'
import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import {
  AriaComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import type { ECElementEvent, ECharts, EChartsCoreOption } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { cn } from '../../../utils/cn'

echarts.use([
  AriaComponent,
  BarChart,
  CanvasRenderer,
  DatasetComponent,
  GridComponent,
  HeatmapChart,
  LegendComponent,
  LineChart,
  PieChart,
  TooltipComponent,
  VisualMapComponent,
])

interface DashboardChartProps {
  className?: string
  onChartClick?: (event: ECElementEvent) => void
  option: EChartsCoreOption
}

export function DashboardChart({
  className,
  onChartClick,
  option,
}: DashboardChartProps) {
  const chartNodeRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ECharts | null>(null)
  const clickRef = useRef<DashboardChartProps['onChartClick']>(onChartClick)

  useEffect(() => {
    clickRef.current = onChartClick
  }, [onChartClick])

  useEffect(() => {
    const node = chartNodeRef.current
    if (!node) return undefined

    const chart = echarts.init(node, null, { renderer: 'canvas' })
    chartRef.current = chart

    const resizeObserver = new ResizeObserver(() => {
      chart.resize()
    })
    resizeObserver.observe(node)

    const handleClick = (event: ECElementEvent) => {
      clickRef.current?.(event)
    }

    chart.on('click', handleClick)

    return () => {
      chart.off('click', handleClick)
      resizeObserver.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, {
      lazyUpdate: true,
      notMerge: true,
    })
  }, [option])

  return (
    <div
      aria-hidden="true"
      className={cn('h-72 min-h-72 w-full overflow-hidden', className)}
      ref={chartNodeRef}
    />
  )
}

