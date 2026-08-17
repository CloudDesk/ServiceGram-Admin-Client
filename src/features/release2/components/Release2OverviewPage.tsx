import { useQuery } from '@tanstack/react-query'
import { ChevronRight, RefreshCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { buildPathWithQueryParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import {
  errorMessage,
  formatDateTime,
  isPermissionDenied,
  settingGroupLabel,
} from '../release2Presenters'
import { release2ClientAccess, type Release2ClientAccess } from '../appConfigAccess'
import { release2Service } from '../services/release2.service'
import type { StatusTone } from '../../../types/status.types'
import {
  Release2NextAction,
  Release2Notice,
  Release2PermissionPanel,
  Release2Warnings,
} from './Release2Feedback'

interface StatTileProps {
  label: string
  value: string
  tone?: StatusTone
  href?: string
}

/** One number per tile. Tiles link to the list that explains the number. */
function StatTile({ href, label, tone = 'neutral', value }: StatTileProps) {
  const body = (
    <>
      <span className="text-xs text-muted">{label}</span>
      <span
        className={cn(
          'text-xl font-semibold tabular-nums text-foreground',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </span>
    </>
  )

  const className =
    'flex flex-col gap-0.5 rounded-[0.75rem] border border-border bg-surface px-3 py-2.5'

  if (!href) {
    return <div className={className}>{body}</div>
  }

  return (
    <Link
      className={cn(className, 'transition hover:border-primary/40 hover:bg-surface-muted')}
      to={href}
    >
      {body}
    </Link>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
      {children}
    </h2>
  )
}

interface ClientConfigCardProps {
  access: Release2ClientAccess
  detail: string
  isLoading: boolean
  title: string
  unavailableTone: StatusTone
}

/** Availability comes from the backend `available` flag, never inferred. */
function ClientConfigCard({
  access,
  detail,
  isLoading,
  title,
  unavailableTone,
}: ClientConfigCardProps) {
  return (
    <Card className="!p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {isLoading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <Badge tone={access.available ? 'success' : unavailableTone}>
            {access.available ? 'Available' : 'Unavailable'}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
      {access.code ? (
        <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-wide text-muted">
          {access.code}
        </p>
      ) : null}
    </Card>
  )
}

export function Release2OverviewPage() {
  const overviewQuery = useQuery({
    queryKey: ['release2', 'overview'],
    queryFn: () => release2Service.getOverview(),
    retry: false,
  })

  /** Public and delivery configs are the only app-config routes an admin session can read. */
  const publicConfigQuery = useQuery({
    queryKey: ['release2', 'app-config', 'public'],
    queryFn: () => release2Service.getPublicAppConfig(),
    retry: false,
  })

  const deliveryConfigQuery = useQuery({
    queryKey: ['release2', 'app-config', 'delivery'],
    queryFn: () => release2Service.getDeliveryAppConfig(),
    retry: false,
  })

  const overview = overviewQuery.data?.data
  const flagSummary = overview?.flags.summary
  const settingsSummary = overview?.settings.summary
  const publicAccess = release2ClientAccess(publicConfigQuery.data)
  const deliveryAccess = release2ClientAccess(deliveryConfigQuery.data)

  const header = (
    <PageContextHeader
      actionNode={
        <Button
          aria-label="Refresh Release 2 overview"
          className="h-9"
          disabled={overviewQuery.isFetching}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => void overviewQuery.refetch()}
        >
          <RefreshCcw
            className={cn(
              'size-4 sm:mr-2',
              overviewQuery.isFetching && 'animate-spin motion-reduce:animate-none',
            )}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
      layout="document"
      placement="topbar"
      title="Release 2 Overview"
    />
  )

  if (overviewQuery.isLoading) {
    return (
      <PageContainer>
        {header}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-16" key={index} />
          ))}
        </div>
        <Skeleton className="h-40" />
      </PageContainer>
    )
  }

  if (overviewQuery.isError && isPermissionDenied(overviewQuery.error)) {
    return (
      <PageContainer>
        {header}
        <Release2PermissionPanel
          error={overviewQuery.error}
          required={['feature-flags:read', 'settings:read']}
          title="Release 2 overview needs both rollout permissions"
        />
      </PageContainer>
    )
  }

  if (overviewQuery.isError || !overview) {
    return (
      <PageContainer>
        {header}
        <ErrorState
          description={errorMessage(overviewQuery.error, 'Could not load the Release 2 overview.')}
          title="Overview unavailable"
          onRetry={() => void overviewQuery.refetch()}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-4">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Generated {formatDateTime(overview.generatedAt)}
        </p>
        <Release2NextAction action={overview.nextRecommendedAction} />
      </div>

      {overview.permissionGaps.length ? (
        <Release2Notice
          bullets={overview.permissionGaps}
          detail="These sections are hidden because the backend did not return them for your role."
          title="Partial view"
          tone="warning"
        />
      ) : null}

      <Release2Warnings warnings={overview.warnings} />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Feature flags</SectionTitle>
          {overview.flags.available ? (
            <Link
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              to={routePaths.featureFlags}
            >
              Open <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {overview.flags.available && flagSummary ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile
              href={routePaths.featureFlags}
              label="Total"
              value={String(flagSummary.totalFlags)}
            />
            <StatTile
              href={buildPathWithQueryParams(routePaths.featureFlags, {
                status: 'ENABLED',
              })}
              label="Enabled"
              tone="success"
              value={String(flagSummary.enabledCount)}
            />
            <StatTile
              href={buildPathWithQueryParams(routePaths.featureFlags, {
                status: 'DISABLED',
              })}
              label="Disabled"
              value={String(flagSummary.disabledCount)}
            />
            <StatTile
              href={buildPathWithQueryParams(routePaths.featureFlags, {
                status: 'ARCHIVED',
              })}
              label="Archived"
              value={String(flagSummary.archivedCount)}
            />
            <StatTile
              label="High-risk on"
              tone={flagSummary.highRiskEnabledCount > 0 ? 'danger' : 'neutral'}
              value={String(flagSummary.highRiskEnabledCount)}
            />
            <StatTile
              label="Expiring ≤7d"
              tone={flagSummary.expiringSoonCount > 0 ? 'warning' : 'neutral'}
              value={String(flagSummary.expiringSoonCount)}
            />
          </div>
        ) : (
          <Release2Notice
            detail="feature-flags:read is required to see rollout counts."
            title="Feature flag summary not available for your role"
            tone="warning"
          />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Release 2 settings</SectionTitle>
          {overview.settings.available ? (
            <Link
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              to={routePaths.release2Settings}
            >
              Open <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {overview.settings.available && settingsSummary ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Groups" value={String(settingsSummary.groupCount)} />
              <StatTile label="Settings" value={String(settingsSummary.itemCount)} />
              <StatTile
                label="High-risk"
                tone={settingsSummary.highRiskCount > 0 ? 'warning' : 'neutral'}
                value={String(settingsSummary.highRiskCount)}
              />
            </div>

            {overview.settings.groups.length ? (
              <Card className="!p-0">
                <ul className="divide-y divide-border">
                  {overview.settings.groups.map((group) => (
                    <li key={group.uiGroup}>
                      <Link
                        className="flex items-center justify-between gap-3 px-3 py-2.5 transition hover:bg-surface-muted"
                        to={`${routePaths.release2Settings}#${group.uiGroup}`}
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {settingGroupLabel(group.uiGroup)}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                          <span className="tabular-nums">{group.itemCount}</span>
                          {group.highRiskCount > 0 ? (
                            <Badge tone="warning">{group.highRiskCount} risk</Badge>
                          ) : null}
                          <span className="hidden sm:inline">
                            {formatDateTime(group.lastUpdatedAt)}
                          </span>
                          <ChevronRight className="size-4" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        ) : (
          <Release2Notice
            detail="settings:read is required to see Release 2 setting groups."
            title="Setting summary not available for your role"
            tone="warning"
          />
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle>Client rollout</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <ClientConfigCard
            access={publicAccess}
            detail={
              publicAccess.available
                ? `${publicAccess.enabledFeatureCount} of ${publicAccess.totalFeatureCount} public flags on · v${publicAccess.configVersion ?? '—'}`
                : errorMessage(publicConfigQuery.error, 'Not loaded.')
            }
            isLoading={publicConfigQuery.isLoading}
            title="Public config"
            unavailableTone="warning"
          />

          <ClientConfigCard
            access={deliveryAccess}
            detail={
              deliveryAccess.message ??
              errorMessage(deliveryConfigQuery.error, 'Not loaded.')
            }
            isLoading={deliveryConfigQuery.isLoading}
            title="Delivery config"
            unavailableTone="neutral"
          />
        </div>
      </section>
    </PageContainer>
  )
}
