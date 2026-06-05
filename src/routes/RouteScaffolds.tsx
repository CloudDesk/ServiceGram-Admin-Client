import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '../components/ui/Badge'
import { TableShell } from '../components/ui/Table'
import { ModuleScaffoldPage } from '../components/layout/ModuleScaffoldPage'
import { PageContainer } from '../components/layout/PageContainer'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { PageHeader } from '../components/ui/PageHeader'
import type { ModuleRecord } from '../types/common.types'
import { formatDate } from '../utils/formatDate'

export function ModulePageFactory({
  title,
  description,
  records,
}: {
  title: string
  description: string
  records: ModuleRecord[]
}) {
  return (
    <ModuleScaffoldPage
      crumbs={[{ label: title }]}
      description={description}
      metrics={[
        { label: 'Records loaded', value: String(records.length) },
        { label: 'Loading state', value: 'Ready' },
        { label: 'Error state', value: 'Ready' },
        { label: 'Backend mode', value: 'Mock' },
      ]}
      records={records}
      title={title}
    />
  )
}

const detailColumns: ColumnDef<ModuleRecord>[] = [
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

export function RecordDetailPage({
  crumbs,
  description,
  record,
  title,
}: {
  crumbs: { label: string; href?: string }[]
  description: string
  record: ModuleRecord
  title: string
}) {
  return (
    <PageContainer>
      <div className="space-y-4">
        <Breadcrumbs items={crumbs} />
        <PageHeader description={description} eyebrow="Detail" title={title} />
      </div>
      <TableShell
        columns={detailColumns}
        data={[record]}
        description={`We could not load ${title.toLowerCase()} right now. Please refresh and try again.`}
        title={title}
      />
    </PageContainer>
  )
}
