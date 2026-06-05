import type { ReactNode } from 'react'
import type { ModuleRecord } from '../../types/common.types'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '../ui/Button'
import { PageContextHeader } from '../ui/PageHeader'
import type { DynamicTableColumn } from '../ui/Table'
import { DynamicTable } from '../ui/Table'
import { PageContainer } from './PageContainer'

interface ModuleScaffoldPageProps {
  title: string
  description?: string
  records: ModuleRecord[]
  actionNode?: ReactNode
}

const columns: DynamicTableColumn<ModuleRecord>[] = [
  {
    key: 'name',
    label: 'Record',
    minWidth: 260,
    renderCell: (row: ModuleRecord) => (
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted">{row.id}</p>
      </div>
    ),
  },
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

export function ModuleScaffoldPage({
  description: _description,
  records,
  title,
  actionNode,
}: ModuleScaffoldPageProps) {
  return (
    <PageContainer>
      <PageContextHeader
        actionNode={actionNode}
        title={title}
        utilityNode={
          <Button size="sm" variant="secondary">
            <SlidersHorizontal className="mr-2 size-4" />
            Filters
          </Button>
        }
      />
      <DynamicTable
        bodyMaxHeight={560}
        columns={columns}
        data={records}
        description={`We could not load ${title.toLowerCase()} right now. Please refresh and try again.`}
        pagination={{
          page: 1,
          pageSize: records.length || 1,
          total: records.length,
        }}
        title={title}
      />
    </PageContainer>
  )
}
