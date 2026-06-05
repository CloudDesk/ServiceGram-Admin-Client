import type { ReactNode } from 'react'
import { PageContextHeader } from '../components/ui/PageHeader'
import type { DynamicTableColumn } from '../components/ui/Table'
import { DynamicTable } from '../components/ui/Table'
import { ModuleScaffoldPage } from '../components/layout/ModuleScaffoldPage'
import { PageContainer } from '../components/layout/PageContainer'
import type { ModuleRecord } from '../types/common.types'

export function ModulePageFactory({
  actionNode,
  title,
  description: _description,
  records,
}: {
  actionNode?: ReactNode
  title: string
  description?: string
  records: ModuleRecord[]
}) {
  return (
    <ModuleScaffoldPage
      actionNode={actionNode}
      records={records}
      title={title}
    />
  )
}

const detailColumns: DynamicTableColumn<ModuleRecord>[] = [
  {
    key: 'subtitle',
    label: 'Context',
    minWidth: 220,
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: 'info',
    minWidth: 140,
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function RecordDetailPage({
  description: _description,
  record,
  title,
}: {
  description?: string
  record: ModuleRecord
  title: string
}) {
  return (
    <PageContainer>
      <PageContextHeader compact title={title} />
      <DynamicTable
        bodyMaxHeight={320}
        columns={detailColumns}
        data={[record]}
        description={`We could not load ${title.toLowerCase()} right now. Please refresh and try again.`}
        pagination={{
          page: 1,
          pageSize: 1,
          total: 1,
        }}
        title={title}
      />
    </PageContainer>
  )
}
