import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, History, Pencil, RefreshCcw, Target } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import { RecordField, RecordFieldList } from '../../../components/ui/RecordPage'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import {
  errorMessage,
  formatDateTime,
  humanizeCode,
  isPermissionDenied,
  phaseLabel,
  riskTone,
  targetSummary,
} from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import type { FeatureFlagDetail } from '../types/release2.types'
import { FeatureFlagEvaluatePanel } from './FeatureFlagEvaluatePanel'
import { FeatureFlagFormModal } from './FeatureFlagFormModal'
import { FeatureFlagTargetsModal } from './FeatureFlagTargetsModal'
import {
  Release2ErrorNotice,
  Release2NextAction,
  Release2Notice,
  Release2PermissionPanel,
  Release2Warnings,
} from './Release2Feedback'
import { Release2ReasonModal } from './Release2ReasonModal'

const HISTORY_PAGE_SIZE = 10

function SectionCard({
  action,
  children,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  title: string
}) {
  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

function TargetsTable({ flag }: { flag: FeatureFlagDetail }) {
  if (!flag.targets.length) {
    return (
      <p className="rounded-[0.75rem] border border-dashed border-border p-4 text-center text-sm text-muted">
        No target rules. Default {flag.defaultEnabled ? 'on' : 'off'} and{' '}
        {flag.rolloutPercentage}% rollout decide the outcome.
      </p>
    )
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-1 pb-2 font-medium">Effect</th>
            <th className="px-1 pb-2 font-medium">Match</th>
            <th className="px-1 pb-2 text-right font-medium">Priority</th>
            <th className="px-1 pb-2 text-right font-medium">State</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {flag.targets.map((target) => (
            <tr key={target.targetId}>
              <td className="px-1 py-2">
                <Badge tone={target.effect === 'DENY' ? 'danger' : 'success'}>
                  {target.effect}
                </Badge>
              </td>
              <td className="px-1 py-2">
                <span className="text-foreground">{targetSummary(target)}</span>
              </td>
              <td className="px-1 py-2 text-right tabular-nums text-muted">
                {target.priority}
              </td>
              <td className="px-1 py-2 text-right">
                <span className={target.isActive ? 'text-foreground' : 'text-muted'}>
                  {target.isActive ? 'Active' : 'Paused'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FeatureFlagDetailPage() {
  const { featureKey = '' } = useParams()
  const queryClient = useQueryClient()
  const canUpdateFlags = usePermission('feature-flags:update')
  const canReadAudit = usePermission('audit:read')

  const [isEditOpen, setEditOpen] = useState(false)
  const [isTargetsOpen, setTargetsOpen] = useState(false)
  const [isArchiveOpen, setArchiveOpen] = useState(false)
  const [isHistoryOpen, setHistoryOpen] = useState(false)

  const flagQuery = useQuery({
    queryKey: ['release2', 'feature-flag', featureKey],
    queryFn: () => release2Service.getFeatureFlag(featureKey),
    enabled: Boolean(featureKey),
    retry: false,
  })

  const historyQuery = useQuery({
    queryKey: ['release2', 'feature-flag-history', featureKey],
    queryFn: () =>
      release2Service.getFeatureFlagHistory(featureKey, {
        page: 1,
        limit: HISTORY_PAGE_SIZE,
      }),
    enabled: isHistoryOpen && Boolean(featureKey),
    retry: false,
  })

  const flag = flagQuery.data?.data

  const archiveMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!flag) throw new Error('Flag not loaded.')

      const response = await release2Service.archiveFeatureFlag(flag.featureKey, {
        expectedVersion: flag.version,
        reason,
      })

      return response.data
    },
    onSuccess: () => {
      setArchiveOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['release2'] })
    },
  })

  const availableActions = useMemo(
    () => new Set(flag?.availableActions ?? []),
    [flag?.availableActions],
  )

  const refreshFlag = () => {
    void queryClient.invalidateQueries({ queryKey: ['release2'] })
  }

  if (flagQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </PageContainer>
    )
  }

  if (flagQuery.isError && isPermissionDenied(flagQuery.error)) {
    return (
      <PageContainer>
        <Release2PermissionPanel
          error={flagQuery.error}
          required={['feature-flags:read']}
        />
      </PageContainer>
    )
  }

  if (flagQuery.isError || !flag) {
    return (
      <PageContainer>
        <ErrorState
          description={errorMessage(flagQuery.error, 'Could not load this feature flag.')}
          title="Feature flag unavailable"
          onRetry={() => void flagQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const isArchived = flag.status === 'ARCHIVED'
  const disabledTitle = canUpdateFlags
    ? isArchived
      ? 'Archived flags cannot be changed'
      : undefined
    : 'Requires feature-flags:update'

  return (
    <PageContainer className="space-y-4">
      <DetailPageHeader
        actionNode={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label="Refresh flag"
              className="h-9 px-2.5"
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void flagQuery.refetch()}
            >
              <RefreshCcw
                className={cn(
                  'size-4',
                  flagQuery.isFetching && 'animate-spin motion-reduce:animate-none',
                )}
              />
            </Button>
            <Button
              className="h-9"
              disabled={!canUpdateFlags || !availableActions.has('UPDATE')}
              size="sm"
              title={disabledTitle}
              type="button"
              variant="primary"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              className="h-9"
              disabled={!canUpdateFlags || !availableActions.has('REPLACE_TARGETS')}
              size="sm"
              title={disabledTitle}
              type="button"
              variant="secondary"
              onClick={() => setTargetsOpen(true)}
            >
              <Target className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Targets</span>
            </Button>
            <Button
              className="h-9"
              disabled={!canUpdateFlags || !availableActions.has('ARCHIVE')}
              size="sm"
              title={disabledTitle}
              type="button"
              variant="danger"
              onClick={() => setArchiveOpen(true)}
            >
              <Archive className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Archive</span>
            </Button>
          </div>
        }
        listHref={routePaths.featureFlags}
        listLabel="Feature Flags"
        recordName={flag.displayName}
        title={flag.displayName}
        titleMetaNode={
          <>
            <Badge tone={flag.statusTone}>
              {flag.status}
            </Badge>
            <Badge tone={riskTone(flag.riskLevel)}>{flag.riskLevel}</Badge>
            <span className="font-mono text-xs text-muted">{flag.featureKey}</span>
            <Release2NextAction action={flag.nextRecommendedAction} />
          </>
        }
      />

      {isArchived ? (
        <Release2Notice
          detail="Create a new flag if this capability is needed again."
          title="This flag is archived and read-only"
          tone="info"
        />
      ) : null}

      <Release2Warnings warnings={flag.warnings} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <SectionCard title="Rollout">
            <div className="grid gap-x-6 sm:grid-cols-2">
              <RecordFieldList>
                <RecordField label="Status" value={humanizeCode(flag.status)} />
                <RecordField
                  label="Default"
                  value={flag.defaultEnabled ? 'On' : 'Off'}
                />
                <RecordField
                  label="Rollout"
                  value={`${flag.rolloutPercentage}%`}
                />
                <RecordField label="Phase" value={phaseLabel(flag.phase)} />
                <RecordField label="Risk" value={flag.riskLevel} />
              </RecordFieldList>
              <RecordFieldList>
                <RecordField
                  label="Audience"
                  value={flag.isPublic ? 'Public config' : 'Signed-in only'}
                />
                <RecordField label="Window" value={flag.effectiveWindowLabel} />
                <RecordField
                  label="Effective from"
                  value={formatDateTime(flag.effectiveFrom)}
                />
                <RecordField
                  label="Effective to"
                  value={formatDateTime(flag.effectiveTo)}
                />
                <RecordField label="Owner" value={flag.ownerTeam ?? '—'} />
              </RecordFieldList>
            </div>
            {flag.description ? (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
                {flag.description}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            action={
              <span className="text-xs text-muted">
                {flag.targetCount} rule{flag.targetCount === 1 ? '' : 's'}
              </span>
            }
            title="Targets"
          >
            <TargetsTable flag={flag} />
          </SectionCard>

          <SectionCard
            action={
              <div className="flex items-center gap-2">
                {canReadAudit ? (
                  <Link
                    className="text-xs font-semibold text-primary"
                    to={buildPathWithQueryParams(routePaths.audit, {
                      entityType: 'feature_flag',
                      moduleCode: 'feature_flags',
                    })}
                  >
                    Audit log
                  </Link>
                ) : null}
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setHistoryOpen((open) => !open)}
                >
                  <History className="mr-1.5 size-3.5" />
                  {isHistoryOpen ? 'Hide' : 'Show'}
                </Button>
              </div>
            }
            title="Change history"
          >
            {!isHistoryOpen ? (
              <p className="text-sm text-muted">
                Create, update, archive and retarget entries for this flag.
              </p>
            ) : historyQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : historyQuery.isError ? (
              <Release2ErrorNotice error={historyQuery.error} />
            ) : !historyQuery.data?.data.length ? (
              <p className="text-sm text-muted">No history recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {historyQuery.data.data.map((entry) => (
                  <li
                    className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                    key={entry.auditLogId}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {humanizeCode(entry.actionCode)}
                        <span className="ml-2 text-xs font-normal text-muted">
                          {entry.actor.adminName ?? entry.actor.actorType}
                        </span>
                      </p>
                      {entry.reason ? (
                        <p className="truncate text-xs text-muted">{entry.reason}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-3">
          <FeatureFlagEvaluatePanel featureKey={flag.featureKey} />

          <Card className="!p-4">
            <h3 className="text-sm font-semibold text-foreground">Record</h3>
            <RecordFieldList className="mt-2">
              <RecordField label="Version" value={String(flag.version)} />
              <RecordField label="Created" value={formatDateTime(flag.createdAt)} />
              <RecordField label="Updated" value={formatDateTime(flag.updatedAt)} />
              <RecordField
                label="Actions"
                value={flag.availableActions.join(', ') || '—'}
              />
            </RecordFieldList>
          </Card>
        </div>
      </div>

      {isEditOpen ? (
        <FeatureFlagFormModal
          flag={flag}
          mode="edit"
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            refreshFlag()
          }}
        />
      ) : null}

      {isTargetsOpen ? (
        <FeatureFlagTargetsModal
          flag={flag}
          onClose={() => setTargetsOpen(false)}
          onSaved={() => {
            setTargetsOpen(false)
            refreshFlag()
          }}
        />
      ) : null}

      {isArchiveOpen ? (
        <Release2ReasonModal
          confirmLabel="Archive flag"
          error={archiveMutation.error}
          isDestructive
          isSubmitting={archiveMutation.isPending}
          subtitle={flag.featureKey}
          title="Archive this feature flag?"
          warnings={[
            'Archiving is permanent. The flag becomes read-only and stops evaluating.',
          ]}
          onClose={() => setArchiveOpen(false)}
          onSubmit={(reason) => archiveMutation.mutate(reason)}
        />
      ) : null}
    </PageContainer>
  )
}
