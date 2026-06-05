import type { ColumnDef } from '@tanstack/react-table'
import type { ModuleMetric, ModuleRecord, NavCrumb } from '../../types/common.types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { PageHeader } from '../ui/PageHeader'
import { TableShell } from '../ui/Table'
import { formatDate } from '../../utils/formatDate'
import { PageContainer } from './PageContainer'
import { Breadcrumbs } from '../ui/Breadcrumbs'

interface ModuleScaffoldPageProps {
  title: string
  description: string
  crumbs: NavCrumb[]
  metrics: ModuleMetric[]
  records: ModuleRecord[]
}

const columns: ColumnDef<ModuleRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Record',
    cell: (info) => (
      <div>
        <p className="font-medium">{String(info.getValue())}</p>
        <p className="text-xs text-muted">{info.row.original.id}</p>
      </div>
    ),
  },
  {
    accessorKey: 'subtitle',
    header: 'Context',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => <Badge tone="info">{String(info.getValue())}</Badge>,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: (info) => formatDate(String(info.getValue()), true),
  },
]

export function ModuleScaffoldPage({
  crumbs,
  description,
  metrics,
  records,
  title,
}: ModuleScaffoldPageProps) {
  return (
    <PageContainer>
      <div className="space-y-4">
        <Breadcrumbs items={crumbs} />
        <PageHeader
          description={description}
          eyebrow="Foundation"
          title={title}
        />
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card className="p-5" key={metric.label}>
            <p className="text-sm text-muted">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold">{metric.value}</p>
          </Card>
        ))}
      </section>
      <TableShell
        columns={columns}
        data={records}
        description={`We could not load ${title.toLowerCase()} right now. Please refresh and try again.`}
        title={title}
      />
    </PageContainer>
  )
}
