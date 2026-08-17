import { Download, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { formatDate } from '../../../utils/formatDate'
import { auditService } from '../services/audit.service'
import type { AuditLog, AuditLogsQueryParams } from '../types/audit.types'

const AUDIT_LIST_STORAGE_KEY = 'servicegram.audit.list.v1'
const DEFAULT_PAGE_SIZE = 50

function humanizeCode(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return '—'

  try {
    return formatDate(value, true)
  } catch {
    return '—'
  }
}

/** Writes that change lifecycle state are worth spotting in a long stream. */
function actionTone(actionCode: string) {
  const code = actionCode.toUpperCase()

  if (/DELETE|REJECT|SUSPEND|BLOCK|CANCEL|REMOVE/.test(code)) return 'danger' as const
  if (/APPROVE|PUBLISH|VERIFY|REACTIVATE|UNBLOCK/.test(code)) return 'success' as const
  if (/UPDATE|CREATE|CREDIT|REFUND/.test(code)) return 'warning' as const

  return 'neutral' as const
}

function actorLabel(log: AuditLog) {
  return (
    log.actor.adminName ||
    log.actor.email ||
    log.actor.actorAdminId ||
    log.actor.actorUserId ||
    humanizeCode(log.actor.actorType)
  )
}

export function AuditLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [moduleCode, setModuleCode] = useState(
    () => searchParams.get('moduleCode') ?? '',
  )
  const [entityType, setEntityType] = useState(
    () => searchParams.get('entityType') ?? '',
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const query = useMemo<AuditLogsQueryParams>(
    () => ({
      page,
      limit,
      moduleCode: moduleCode.trim() || undefined,
      entityType: entityType.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, entityType, limit, moduleCode, page],
  )

  const logsQuery = useQuery({
    queryKey: ['audit-logs', query],
    queryFn: () => auditService.getAuditLogs(query),
  })

  const allLogs = useMemo(() => logsQuery.data?.data ?? [], [logsQuery.data])
  const pagination = logsQuery.data?.pagination

  /**
   * The endpoint has no free-text search, so the box filters the loaded page.
   * That is honest for a log stream — you page to a window, then narrow it —
   * but it is not a global search, hence the placeholder wording.
   */
  const logs = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allLogs

    return allLogs.filter((log) =>
      [
        log.actionCode,
        log.moduleCode,
        log.entityType,
        log.entityId,
        log.reason,
        log.requestId,
        actorLabel(log),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    )
  }, [allLogs, search])

  const clearSeededParams = () => {
    const seededKeys = ['search', 'moduleCode', 'entityType', 'actorAdminId']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const columns: DataListColumn<AuditLog>[] = useMemo(
    () => [
      {
        id: 'action',
        label: 'Action',
        defaultWidth: 200,
        minWidth: 160,
        priority: 1,
        grow: true,
        locked: true,
        render: (log) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="max-w-[60%] shrink-0 truncate font-medium text-foreground"
              title={humanizeCode(log.actionCode)}
            >
              {humanizeCode(log.actionCode)}
            </span>
            <span className="min-w-0 truncate text-xs text-muted">
              {humanizeCode(log.moduleCode)}
            </span>
          </div>
        ),
      },
      {
        id: 'severity',
        label: 'Type',
        defaultWidth: 96,
        minWidth: 84,
        priority: 1,
        render: (log) => {
          const tone = actionTone(log.actionCode)

          if (tone === 'neutral') return <span className="text-muted">—</span>

          return (
            <Badge tone={tone}>
              {tone === 'danger' ? 'Destructive' : tone === 'success' ? 'Approval' : 'Write'}
            </Badge>
          )
        },
      },
      {
        id: 'createdAt',
        label: 'When',
        defaultWidth: 150,
        minWidth: 130,
        priority: 1,
        render: (log) => (
          <span className="truncate text-muted">{formatDateSafe(log.createdAt)}</span>
        ),
      },
      {
        id: 'actor',
        label: 'Actor',
        defaultWidth: 160,
        minWidth: 130,
        priority: 2,
        render: (log) => (
          <span className="truncate text-foreground" title={actorLabel(log)}>
            {actorLabel(log)}
          </span>
        ),
      },
      {
        id: 'entity',
        label: 'Entity',
        defaultWidth: 160,
        minWidth: 130,
        priority: 2,
        render: (log) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 truncate text-foreground">
              {humanizeCode(log.entityType)}
            </span>
            <span
              className="min-w-0 truncate text-xs text-muted"
              title={log.entityId ?? undefined}
            >
              {log.entityId ?? ''}
            </span>
          </div>
        ),
      },
      {
        id: 'reason',
        label: 'Reason',
        defaultWidth: 200,
        minWidth: 150,
        priority: 3,
        render: (log) => (
          <span
            className={cn('truncate', log.reason ? 'text-foreground' : 'text-muted')}
            title={log.reason ?? undefined}
          >
            {log.reason || '—'}
          </span>
        ),
      },
      {
        id: 'request',
        label: 'Request',
        defaultWidth: 150,
        minWidth: 120,
        priority: 4,
        defaultHidden: true,
        render: (log) => (
          <span className="truncate text-muted" title={log.requestId}>
            {log.requestId}
          </span>
        ),
      },
      {
        id: 'ip',
        label: 'IP',
        defaultWidth: 120,
        minWidth: 100,
        priority: 4,
        defaultHidden: true,
        render: (log) => (
          <span className="truncate text-muted">{log.ipAddress ?? '—'}</span>
        ),
      },
    ],
    [],
  )

  const selectedLogs = useMemo(
    () => logs.filter((log) => selectedIds.includes(log.auditLogId)),
    [logs, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('audit-logs'), selectedLogs, [
      { header: 'Audit log ID', value: (log) => log.auditLogId },
      { header: 'Created', value: (log) => log.createdAt },
      { header: 'Module', value: (log) => log.moduleCode },
      { header: 'Action', value: (log) => log.actionCode },
      { header: 'Entity type', value: (log) => log.entityType },
      { header: 'Entity ID', value: (log) => log.entityId ?? '' },
      { header: 'Actor', value: (log) => actorLabel(log) },
      { header: 'Actor type', value: (log) => log.actor.actorType },
      { header: 'Reason', value: (log) => log.reason ?? '' },
      { header: 'Request ID', value: (log) => log.requestId },
      { header: 'IP address', value: (log) => log.ipAddress ?? '' },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh audit logs"
            className="h-9"
            disabled={logsQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void logsQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                logsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Audit"
      />

      <DataList
        appliedFilterCount={
          [moduleCode.trim(), entityType.trim(), dateFrom, dateTo].filter(Boolean)
            .length
        }
        columns={columns}
        emptyHint="Adjust the filters or page back through the stream."
        emptyMessage="No audit entries match these filters"
        errorMessage="Could not load audit logs."
        filters={
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Module</span>
              <input
                className={filterControlClass}
                placeholder="e.g. orders"
                value={moduleCode}
                onChange={(event) => {
                  setModuleCode(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Entity type
              </span>
              <input
                className={filterControlClass}
                placeholder="e.g. ORDER"
                value={entityType}
                onChange={(event) => {
                  setEntityType(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">From</span>
                <input
                  className={filterControlClass}
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">To</span>
                <input
                  className={filterControlClass}
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
            </div>
          </>
        }
        getRowId={(log) => log.auditLogId}
        isError={logsQuery.isError}
        isLoading={logsQuery.isLoading}
        pagination={{
          page,
          pageSize: limit,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        rows={logs}
        search={search}
        searchPlaceholder="Filter this page…"
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          ),
        }}
        storageKey={AUDIT_LIST_STORAGE_KEY}
        onResetFilters={() => {
          setModuleCode('')
          setEntityType('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        onRetry={() => void logsQuery.refetch()}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
        }}
      />
    </PageContainer>
  )
}
