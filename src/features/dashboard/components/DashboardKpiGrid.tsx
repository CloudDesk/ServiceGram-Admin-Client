import type { ModuleMetric } from '../../../types/common.types'
import { Card } from '../../../components/ui/Card'

interface DashboardKpiGridProps {
  metrics: ModuleMetric[]
}

export function DashboardKpiGrid({ metrics }: DashboardKpiGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card className="p-5" key={metric.label}>
          <p className="text-sm text-muted">{metric.label}</p>
          <p className="mt-3 text-3xl font-semibold">{metric.value}</p>
        </Card>
      ))}
    </section>
  )
}
