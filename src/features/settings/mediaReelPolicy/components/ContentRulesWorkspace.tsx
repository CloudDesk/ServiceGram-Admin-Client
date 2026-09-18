import { Plus, RefreshCcw } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { cn } from '../../../../utils/cn'
import type { PolicyRule } from '../../types/settings.types'
import { ContentRuleRow, contentRuleRowGridClassName } from './ContentRuleRow'

function ContentRulesRowsSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton className="h-16 w-full" key={index} />
      ))}
    </div>
  )
}

export function ContentRulesWorkspace({
  canReadAudit,
  canUpdateSettings,
  isError,
  isInitialLoading,
  isRefreshing,
  onCreate,
  onEdit,
  onOpenAudit,
  onPreview,
  onRefresh,
  onToggleStatus,
  rows,
  selectedRuleId,
}: {
  canReadAudit: boolean
  canUpdateSettings: boolean
  isError: boolean
  isInitialLoading: boolean
  isRefreshing: boolean
  onCreate: () => void
  onEdit: (rule: PolicyRule) => void
  onOpenAudit: (rule: PolicyRule) => void
  onPreview: (rule: PolicyRule) => void
  onRefresh: () => void
  onToggleStatus: (rule: PolicyRule, nextStatus: 'ACTIVATE' | 'ARCHIVE') => void
  rows: PolicyRule[]
  selectedRuleId?: string | null
}) {
  if (isError) {
    return (
      <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <ErrorState
          description="We could not load content rules."
          title="Content rules unavailable"
          onRetry={onRefresh}
        />
      </div>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <ContentRulesRowsSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col xl:min-h-0 xl:flex-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/40 px-3 py-2.5">
        <p className="text-sm text-muted">{rows.length} content rules</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!canUpdateSettings}
            size="sm"
            title={canUpdateSettings ? 'Create content rule' : 'Requires settings:update'}
            type="button"
            variant="primary"
            onClick={onCreate}
          >
            <Plus className="mr-2 size-4" />
            Content rule
          </Button>
          <Button size="sm" type="button" variant="secondary" onClick={onRefresh}>
            <RefreshCcw className={cn('mr-2 size-4', isRefreshing && 'animate-spin motion-reduce:animate-none')} />
            Refresh
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <EmptyState
            actionLabel={canUpdateSettings ? 'Create content rule' : undefined}
            description="No content rules have been configured yet."
            title="No content rules found"
            onAction={canUpdateSettings ? onCreate : undefined}
          />
        </div>
      ) : (
        <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
          <div className="min-w-[74rem]">
            <div
              className={cn(
                contentRuleRowGridClassName,
                'sticky top-0 z-30 border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)]',
              )}
            >
              <div>Rule</div>
              <div>Applies to</div>
              <div>Reel length</div>
              <div>Max size</div>
              <div>Resolution</div>
              <div>Effective</div>
              <div>Updated</div>
              <div className="text-right">Actions</div>
            </div>
            <div>
              {rows.map((rule) => (
                <ContentRuleRow
                  allRules={rows}
                  canReadAudit={canReadAudit}
                  canUpdateSettings={canUpdateSettings}
                  isPreviewed={selectedRuleId === rule.policyRuleId}
                  key={rule.policyRuleId}
                  rule={rule}
                  onEdit={onEdit}
                  onOpenAudit={onOpenAudit}
                  onPreview={onPreview}
                  onToggleStatus={onToggleStatus}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
