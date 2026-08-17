import { useQuery } from '@tanstack/react-query'
import { ChevronRight, RefreshCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { RecordMetricStrip } from '../../../components/ui/RecordPage'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { cn } from '../../../utils/cn'
import {
  errorMessage,
  formatSettingValue,
  isPermissionDenied,
  riskTone,
  settingGroupLabel,
} from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import type { Release2Setting } from '../types/release2.types'
import { Release2PermissionPanel } from './Release2Feedback'

type RiskFilter = 'all' | 'risk'

function SettingRow({ setting }: { setting: Release2Setting }) {
  const unit =
    typeof setting.validation.unit === 'string' ? setting.validation.unit : undefined

  return (
    <li>
      <Link
        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-surface-muted"
        to={`${routePaths.release2Settings}/${encodeURIComponent(setting.settingKey)}`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {setting.displayName}
            </span>
            {setting.riskLevel === 'FINANCE' || setting.riskLevel === 'HIGH' ? (
              <Badge tone={riskTone(setting.riskLevel)}>{setting.riskLevel}</Badge>
            ) : null}
            {!setting.isEditable ? <Badge tone="neutral">Read-only</Badge> : null}
          </span>
          <span className="block truncate font-mono text-[0.7rem] text-muted">
            {setting.settingKey}
          </span>
        </span>

        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums text-foreground',
            setting.isValueMasked && 'text-muted',
          )}
        >
          {setting.isValueMasked ? 'Masked' : formatSettingValue(setting.value, unit)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted" />
      </Link>
    </li>
  )
}

export function Release2SettingsPage() {
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')

  const settingsQuery = useQuery({
    queryKey: ['release2', 'settings'],
    queryFn: () => release2Service.getRelease2Settings(),
    retry: false,
  })

  const summary = settingsQuery.data?.summary
  const groups = useMemo(() => settingsQuery.data?.data ?? [], [settingsQuery.data])

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase()

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((setting) => {
          const matchesRisk =
            riskFilter === 'all' ||
            setting.riskLevel === 'HIGH' ||
            setting.riskLevel === 'FINANCE'
          const matchesTerm =
            !term ||
            setting.settingKey.toLowerCase().includes(term) ||
            setting.displayName.toLowerCase().includes(term)

          return matchesRisk && matchesTerm
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, riskFilter, search])

  const header = (
    <PageContextHeader
      actionNode={
        <Button
          aria-label="Refresh Release 2 settings"
          className="h-9"
          disabled={settingsQuery.isFetching}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => void settingsQuery.refetch()}
        >
          <RefreshCcw
            className={cn(
              'size-4 sm:mr-2',
              settingsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
            )}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
      layout="document"
      placement="topbar"
      title="Release 2 Settings"
    />
  )

  if (settingsQuery.isLoading) {
    return (
      <PageContainer>
        {header}
        <Skeleton className="h-12" />
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-40" key={index} />
          ))}
        </div>
      </PageContainer>
    )
  }

  if (settingsQuery.isError && isPermissionDenied(settingsQuery.error)) {
    return (
      <PageContainer>
        {header}
        <Release2PermissionPanel
          error={settingsQuery.error}
          required={['settings:read']}
        />
      </PageContainer>
    )
  }

  if (settingsQuery.isError) {
    return (
      <PageContainer>
        {header}
        <ErrorState
          description={errorMessage(
            settingsQuery.error,
            'Could not load Release 2 settings.',
          )}
          title="Settings unavailable"
          onRetry={() => void settingsQuery.refetch()}
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-4">
      {header}

      {summary ? (
        <RecordMetricStrip
          ariaLabel="Release 2 settings summary"
          metrics={[
            { label: 'Groups', value: String(summary.groupCount) },
            { label: 'Settings', value: String(summary.itemCount) },
            {
              label: 'High-risk',
              value: String(summary.highRiskCount),
              tone: summary.highRiskCount > 0 ? 'warning' : undefined,
            },
          ]}
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            className="pl-9"
            placeholder="Search setting key or name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="btn-group flex shrink-0 gap-1">
          <Button
            size="sm"
            type="button"
            variant={riskFilter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setRiskFilter('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            type="button"
            variant={riskFilter === 'risk' ? 'primary' : 'secondary'}
            onClick={() => setRiskFilter('risk')}
          >
            High-risk only
          </Button>
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <EmptyState
          description="No Release 2 setting matches this search or filter."
          title="Nothing to show"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredGroups.map((group) => (
            <div id={group.uiGroup} key={group.uiGroup}>
              <Card className="!p-0">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  <h2 className="text-sm font-semibold text-foreground">
                    {settingGroupLabel(group.uiGroup)}
                  </h2>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <span className="tabular-nums">{group.itemCount}</span>
                    {group.highRiskCount > 0 ? (
                      <Badge tone="warning">{group.highRiskCount} risk</Badge>
                    ) : null}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {group.items.map((setting) => (
                    <SettingRow key={setting.settingKey} setting={setting} />
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  )
}
