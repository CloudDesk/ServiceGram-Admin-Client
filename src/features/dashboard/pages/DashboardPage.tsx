import { PageContextHeader } from '../../../components/ui/PageHeader'
import type { DynamicTableColumn } from '../../../components/ui/Table'
import { DynamicTable } from '../../../components/ui/Table'
import { Skeleton } from '../../../components/ui/Skeleton'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import type { ModuleRecord } from '../../../types/common.types'
import { DashboardKpiGrid } from '../components/DashboardKpiGrid'
import { useDashboardData } from '../hooks/useDashboardData'

const columns: DynamicTableColumn<ModuleRecord>[] = [
  {
    key: 'name',
    label: 'Pending action',
    minWidth: 280,
    renderCell: (row: ModuleRecord) => (
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted">{row.subtitle}</p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: 'warning',
    minWidth: 140,
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function DashboardPage() {
  const dashboardQuery = useDashboardData()

  return (
    <PageContainer>
      <PageContextHeader title="Dashboard" />

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
          <DynamicTable
            bodyMaxHeight={420}
            columns={columns}
            data={dashboardQuery.data.pendingActions}
            description="We could not load the pending actions right now. Please refresh and try again."
            pagination={{
              page: 1,
              pageSize: dashboardQuery.data.pendingActions.length || 1,
              total: dashboardQuery.data.pendingActions.length,
            }}
            title="Pending Actions"
          />
        </>
      ) : null}
    </PageContainer>
  )
}
