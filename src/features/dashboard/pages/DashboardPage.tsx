import type { ColumnDef } from '@tanstack/react-table'
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs'
import { PageHeader } from '../../../components/ui/PageHeader'
import { TableShell } from '../../../components/ui/Table'
import { Badge } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/Skeleton'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import type { ModuleRecord } from '../../../types/common.types'
import { formatDate } from '../../../utils/formatDate'
import { DashboardKpiGrid } from '../components/DashboardKpiGrid'
import { useDashboardData } from '../hooks/useDashboardData'

const columns: ColumnDef<ModuleRecord>[] = [
  {
    accessorKey: 'name',
    header: 'Pending action',
    cell: (info) => (
      <div>
        <p className="font-medium">{String(info.getValue())}</p>
        <p className="text-xs text-muted">{info.row.original.subtitle}</p>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => <Badge tone="warning">{String(info.getValue())}</Badge>,
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    cell: (info) => formatDate(String(info.getValue()), true),
  },
]

export function DashboardPage() {
  const dashboardQuery = useDashboardData()

  return (
    <PageContainer>
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <PageHeader
          description="Operational overview with role-aware summaries, progressive loading, and mock-backed widgets ready for API replacement."
          eyebrow="Overview"
          title="Dashboard"
        />
      </div>

      {dashboardQuery.isLoading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-32" key={index} />
          ))}
        </section>
      ) : null}

      {dashboardQuery.isError ? (
        <ErrorState
          title="Unable to load dashboard"
          description="We could not load the dashboard right now. Please refresh and try again."
          onRetry={() => void dashboardQuery.refetch()}
        />
      ) : null}

      {dashboardQuery.data ? (
        <>
          <DashboardKpiGrid metrics={dashboardQuery.data.metrics} />
          <TableShell
            columns={columns}
            data={dashboardQuery.data.pendingActions}
            description="We could not load the pending actions right now. Please refresh and try again."
            title="Pending Actions"
          />
        </>
      ) : null}
    </PageContainer>
  )
}
