import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { auditService } from '../services/audit.service'
import type { AuditLog, AuditLogsQueryParams } from '../types/audit.types'

const DEFAULT_PAGE_SIZE = 20

const columns: DynamicTableColumn<AuditLog>[] = [
  {
    key: 'moduleCode',
    label: 'Action',
    minWidth: 260,
    renderCell: (log) => (
      <div>
        <p className="font-semibold text-foreground">{log.moduleCode}</p>
        <p className="text-xs text-muted">{log.actionCode}</p>
      </div>
    ),
  },
  {
    key: 'actor',
    label: 'Actor',
    minWidth: 220,
    renderCell: (log) => (
      <div>
        <p className="font-medium text-foreground">
          {log.actor.adminName ?? log.actor.email ?? log.actor.actorType}
        </p>
        <p className="text-xs text-muted">{log.actor.actorAdminId ?? log.actor.actorUserId}</p>
      </div>
    ),
  },
  {
    key: 'entityType',
    label: 'Entity',
    minWidth: 220,
    renderCell: (log) => (
      <div>
        <p className="font-medium text-foreground">{log.entityType}</p>
        <p className="text-xs text-muted">{log.entityId ?? 'No entity id'}</p>
      </div>
    ),
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 260,
    placeholder: 'No reason recorded',
  },
  {
    key: 'createdAt',
    label: 'Created',
    format: 'date',
    minWidth: 180,
  },
]

export function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [moduleCode, setModuleCode] = useState('')
  const [actionCode, setActionCode] = useState('')
  const [entityType, setEntityType] = useState('')
  const [entityId, setEntityId] = useState('')
  const [actorAdminId, setActorAdminId] = useState('')

  const query = useMemo<AuditLogsQueryParams>(
    () => ({
      page,
      limit,
      moduleCode: moduleCode.trim() || undefined,
      actionCode: actionCode.trim() || undefined,
      entityType: entityType.trim() || undefined,
      entityId: entityId.trim() || undefined,
      actorAdminId: actorAdminId.trim() || undefined,
    }),
    [actionCode, actorAdminId, entityId, entityType, limit, moduleCode, page],
  )

  const auditQuery = useQuery({
    queryKey: ['audit-logs', query],
    queryFn: () => auditService.getAuditLogs(query),
  })

  const logs = auditQuery.data?.data ?? []
  const pagination = auditQuery.data?.pagination
  const isLoading = auditQuery.isLoading || auditQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader title="Audit Logs" />

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Module</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                placeholder="vendors, payments, rbac"
                value={moduleCode}
                onChange={(event) => {
                  setModuleCode(event.target.value)
                  resetToFirstPage()
                }}
              />
            </div>
          </label>
          {[
            ['Action', actionCode, setActionCode],
            ['Entity Type', entityType, setEntityType],
            ['Entity ID', entityId, setEntityId],
            ['Actor Admin ID', actorAdminId, setActorAdminId],
          ].map(([label, value, setter]) => (
            <label className="space-y-1" key={label as string}>
              <span className="text-sm font-medium text-foreground">{label as string}</span>
              <Input
                value={value as string}
                onChange={(event) => {
                  ;(setter as (nextValue: string) => void)(event.target.value)
                  resetToFirstPage()
                }}
              />
            </label>
          ))}
        </div>

        {auditQuery.isError ? (
          <ErrorState
            description="We could not load audit logs."
            title="Audit logs unavailable"
            onRetry={() => void auditQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton columns={columns} hasFooter={Boolean(pagination)} rowCount={8} />
        ) : logs.length === 0 ? (
          <EmptyState description="No audit logs matched this filter." title="No audit logs" />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={columns}
            data={logs}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: setPage,
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : undefined
            }
            title="Audit Logs"
            getRowId={(log) => log.auditLogId}
          />
        )}

        {pagination ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={!pagination.hasPreviousPage || isLoading}
                size="sm"
                variant="secondary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                disabled={!pagination.hasNextPage || isLoading}
                size="sm"
                variant="secondary"
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </PageContainer>
  )
}
