import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { RecordMetricStrip } from '../../../components/ui/RecordPage'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import {
  formatDateTime,
  isPermissionDenied,
  phaseLabel,
  riskTone,
} from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import {
  FEATURE_FLAG_APP_TYPES,
  FEATURE_FLAG_PHASES,
  type FeatureFlagAppType,
  type FeatureFlagListRow,
  type FeatureFlagPhase,
  type FeatureFlagStatus,
  type FeatureFlagsQueryParams,
} from '../types/release2.types'
import { FeatureFlagFormModal } from './FeatureFlagFormModal'
import { Release2ErrorNotice, Release2PermissionPanel } from './Release2Feedback'

const FEATURE_FLAG_LIST_STORAGE_KEY = 'servicegram.release2.feature-flags.v1'
const DEFAULT_PAGE_SIZE = 50

type FlagQueueKey = 'all' | 'enabled' | 'disabled' | 'archived'

const FLAG_QUEUES: Record<
  FlagQueueKey,
  { label: string; status?: FeatureFlagStatus; tone?: 'neutral' | 'warning' | 'danger' }
> = {
  all: { label: 'All' },
  enabled: { label: 'Enabled', status: 'ENABLED' },
  disabled: { label: 'Disabled', status: 'DISABLED', tone: 'warning' },
  archived: { label: 'Archived', status: 'ARCHIVED' },
}

function queueForStatus(status: string | null): FlagQueueKey {
  const match = (Object.keys(FLAG_QUEUES) as FlagQueueKey[]).find(
    (key) => FLAG_QUEUES[key].status === status,
  )

  return match ?? 'all'
}

const filterControlClass =
  'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

export function FeatureFlagsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const canUpdateFlags = usePermission('feature-flags:update')

  const [search, setSearch] = useState('')
  const [queue, setQueue] = useState<FlagQueueKey>(() =>
    queueForStatus(searchParams.get('status')),
  )
  const [phase, setPhase] = useState<FeatureFlagPhase | ''>('')
  const [appType, setAppType] = useState<FeatureFlagAppType | ''>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [isCreateOpen, setCreateOpen] = useState(false)

  const query = useMemo<FeatureFlagsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: FLAG_QUEUES[queue].status,
      phase: phase || undefined,
      appType: appType || undefined,
    }),
    [appType, limit, page, phase, queue, search],
  )

  const flagsQuery = useQuery({
    queryKey: ['release2', 'feature-flags', query],
    queryFn: () => release2Service.getFeatureFlags(query),
    retry: false,
  })

  const rows = flagsQuery.data?.data ?? []
  const pagination = flagsQuery.data?.pagination
  const summary = flagsQuery.data?.summary

  /**
   * Counts come from the backend `summary`, which ignores the selected status
   * pill — so switching queues never rewrites the tab counts.
   */
  const queueTabs: DataListQueueTab[] = (
    Object.keys(FLAG_QUEUES) as FlagQueueKey[]
  ).map((key) => ({
    key,
    label: FLAG_QUEUES[key].label,
    count: summary
      ? {
          all: summary.totalFlags,
          enabled: summary.enabledCount,
          disabled: summary.disabledCount,
          archived: summary.archivedCount,
        }[key]
      : undefined,
    tone: FLAG_QUEUES[key].tone,
  }))

  const columns: DataListColumn<FeatureFlagListRow>[] = useMemo(
    () => [
      {
        id: 'flag',
        label: 'Flag',
        defaultWidth: 260,
        minWidth: 200,
        priority: 1,
        grow: true,
        locked: true,
        render: (row) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-foreground">
              {row.displayName}
            </span>
            <span className="truncate font-mono text-[0.7rem] text-muted">
              {row.featureKey}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        defaultWidth: 104,
        minWidth: 92,
        priority: 1,
        render: (row) => (
          <Badge tone={row.statusTone}>
            {row.status === 'ENABLED' ? 'On' : row.status === 'DISABLED' ? 'Off' : 'Archived'}
          </Badge>
        ),
      },
      {
        id: 'rollout',
        label: 'Rollout',
        defaultWidth: 110,
        minWidth: 96,
        priority: 1,
        align: 'right',
        render: (row) => (
          <span
            className={cn(
              'tabular-nums',
              row.status === 'ENABLED' && row.rolloutPercentage === 0 && 'text-warning',
            )}
          >
            {row.rolloutPercentage}%
          </span>
        ),
      },
      {
        id: 'default',
        label: 'Default',
        defaultWidth: 90,
        minWidth: 80,
        priority: 2,
        render: (row) => (
          <span className={row.defaultEnabled ? 'text-foreground' : 'text-muted'}>
            {row.defaultEnabled ? 'On' : 'Off'}
          </span>
        ),
      },
      {
        id: 'targets',
        label: 'Targets',
        defaultWidth: 88,
        minWidth: 76,
        priority: 2,
        align: 'right',
        render: (row) => (
          <span className={row.targetCount ? 'tabular-nums' : 'text-muted'}>
            {row.targetCount || '—'}
          </span>
        ),
      },
      {
        id: 'risk',
        label: 'Risk',
        defaultWidth: 100,
        minWidth: 88,
        priority: 2,
        render: (row) => <Badge tone={riskTone(row.riskLevel)}>{row.riskLevel}</Badge>,
      },
      {
        id: 'phase',
        label: 'Phase',
        defaultWidth: 78,
        minWidth: 70,
        priority: 3,
        render: (row) => <span className="text-muted">{phaseLabel(row.phase)}</span>,
      },
      {
        id: 'audience',
        label: 'Audience',
        defaultWidth: 96,
        minWidth: 84,
        priority: 3,
        render: (row) => (
          <span className="text-muted">{row.isPublic ? 'Public' : 'Signed-in'}</span>
        ),
      },
      {
        id: 'window',
        label: 'Window',
        defaultWidth: 150,
        minWidth: 110,
        priority: 4,
        defaultHidden: true,
        render: (row) => (
          <span className="truncate text-muted" title={row.effectiveWindowLabel}>
            {row.effectiveWindowLabel}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 130,
        minWidth: 104,
        priority: 3,
        render: (row) => (
          <span className="text-muted">{formatDateTime(row.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const header = (
    <PageContextHeader
      actionNode={
        <div className="flex items-center gap-2">
          <Button
            aria-label="Refresh feature flags"
            className="h-9"
            disabled={flagsQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void flagsQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                flagsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            className="h-9"
            disabled={!canUpdateFlags}
            size="sm"
            title={
              canUpdateFlags
                ? 'Create a feature flag'
                : 'Requires feature-flags:update'
            }
            type="button"
            variant="primary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">New flag</span>
          </Button>
        </div>
      }
      layout="workspace"
      placement="topbar"
      title="Feature Flags"
    />
  )

  if (flagsQuery.isError && isPermissionDenied(flagsQuery.error)) {
    return (
      <PageContainer>
        {header}
        <Release2PermissionPanel
          error={flagsQuery.error}
          required={['feature-flags:read']}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      {header}

      {summary ? (
        <RecordMetricStrip
          ariaLabel="Feature flag rollout summary"
          className="mb-3"
          metrics={[
            { label: 'Total', value: String(summary.totalFlags) },
            { label: 'On', value: String(summary.enabledCount), tone: 'success' },
            {
              label: 'High-risk on',
              value: String(summary.highRiskEnabledCount),
              tone: summary.highRiskEnabledCount > 0 ? 'danger' : undefined,
            },
            {
              label: 'Expiring ≤7d',
              value: String(summary.expiringSoonCount),
              tone: summary.expiringSoonCount > 0 ? 'warning' : undefined,
            },
          ]}
        />
      ) : null}

      {flagsQuery.isError ? (
        <Release2ErrorNotice className="mb-3" error={flagsQuery.error} />
      ) : null}

      <DataList
        activeQueue={queue}
        appliedFilterCount={[phase, appType].filter(Boolean).length}
        columns={columns}
        emptyHint="Adjust the search, phase, or app filter."
        emptyMessage="No feature flags match these filters"
        errorMessage="Could not load feature flags."
        filters={
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Phase</span>
              <select
                className={filterControlClass}
                value={phase}
                onChange={(event) => {
                  setPhase(event.target.value as FeatureFlagPhase | '')
                  setPage(1)
                }}
              >
                <option value="">All phases</option>
                {FEATURE_FLAG_PHASES.map((option) => (
                  <option key={option} value={option}>
                    {phaseLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                App target
              </span>
              <select
                className={filterControlClass}
                value={appType}
                onChange={(event) => {
                  setAppType(event.target.value as FeatureFlagAppType | '')
                  setPage(1)
                }}
              >
                <option value="">All apps</option>
                {FEATURE_FLAG_APP_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        getRowId={(row) => row.featureFlagId}
        isError={flagsQuery.isError}
        isLoading={flagsQuery.isLoading}
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
        queueTabs={queueTabs}
        rows={rows}
        search={search}
        searchPlaceholder="Search key or name…"
        storageKey={FEATURE_FLAG_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as FlagQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setPhase('')
          setAppType('')
          setPage(1)
        }}
        onRetry={() => void flagsQuery.refetch()}
        onRowClick={(row) =>
          navigate(`${routePaths.featureFlags}/${encodeURIComponent(row.featureKey)}`)
        }
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {isCreateOpen ? (
        <FeatureFlagFormModal
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSaved={(flag) => {
            setCreateOpen(false)
            void queryClient.invalidateQueries({
              queryKey: ['release2', 'feature-flags'],
            })
            navigate(
              `${routePaths.featureFlags}/${encodeURIComponent(flag.featureKey)}`,
            )
          }}
        />
      ) : null}
    </PageContainer>
  )
}
