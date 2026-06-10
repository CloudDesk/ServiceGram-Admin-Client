import type { ReactNode } from 'react'
import type { DynamicTableColumn } from '../components/ui/Table'
import { DynamicTable } from '../components/ui/Table'
import { DetailPageHeader } from '../components/layout/DetailPageHeader'
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
  listHref,
  listLabel,
  record,
  title,
}: {
  description?: string
  listHref: string
  listLabel: string
  record: ModuleRecord
  title: string
}) {
  return (
    <PageContainer>
      <DetailPageHeader
        description={record.id}
        listHref={listHref}
        listLabel={listLabel}
        recordName={record.name}
        title={title}
      />
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
