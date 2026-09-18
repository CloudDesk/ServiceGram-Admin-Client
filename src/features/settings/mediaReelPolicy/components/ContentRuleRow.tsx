import { Archive, ClipboardList, Edit3, Power } from 'lucide-react'
import { Badge } from '../../../../components/ui/Badge'
import { Button } from '../../../../components/ui/Button'
import { cn } from '../../../../utils/cn'
import { formatDate } from '../../../../utils/formatDate'
import type { PolicyRule } from '../../types/settings.types'
import {
  contentRuleScopeLabel,
  contentRuleScopeTypeLabel,
  contentRuleStatusTone,
  formatDailyUploadLimitSummary,
  formatReelDurationSummary,
  formatReelResolutionSummary,
  formatReelSizeSummary,
  isAppliedFirst,
} from '../utils/contentRulePresentation'

export const contentRuleRowGridClassName =
  'grid grid-cols-[minmax(15rem,1.2fr)_9rem_8rem_7rem_11rem_10rem_9rem_11rem] gap-3'

export function ContentRuleRow({
  allRules,
  canReadAudit,
  canUpdateSettings,
  isPreviewed,
  onEdit,
  onOpenAudit,
  onToggleStatus,
  onPreview,
  rule,
}: {
  allRules: PolicyRule[]
  canReadAudit: boolean
  canUpdateSettings: boolean
  isPreviewed: boolean
  onEdit: (rule: PolicyRule) => void
  onOpenAudit: (rule: PolicyRule) => void
  onToggleStatus: (rule: PolicyRule, nextStatus: 'ACTIVATE' | 'ARCHIVE') => void
  onPreview: (rule: PolicyRule) => void
  rule: PolicyRule
}) {
  const secondaryAction: 'ACTIVATE' | 'ARCHIVE' = rule.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVATE'
  const canEdit = canUpdateSettings && rule.availableActions.includes('EDIT')
  const canRunSecondary = canUpdateSettings && rule.availableActions.includes(secondaryAction)
  const appliedFirst = isAppliedFirst(rule, allRules)

  return (
    <div
      aria-label={`Preview content rule ${rule.displayName}`}
      aria-selected={isPreviewed}
      className={cn(
        contentRuleRowGridClassName,
        'workbench-grid-row cursor-pointer border-b border-border bg-surface px-3 py-2.5 transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isPreviewed && 'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(rule)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPreview(rule)
        }
      }}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{rule.displayName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge tone={contentRuleStatusTone(rule.status)}>{rule.status}</Badge>
          {appliedFirst ? <Badge tone="info">Applied first</Badge> : null}
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{contentRuleScopeTypeLabel(rule)}</p>
        <p className="truncate text-xs text-muted">{contentRuleScopeLabel(rule)}</p>
      </div>
      <div className="text-sm text-foreground">{formatReelDurationSummary(rule)}</div>
      <div className="text-sm text-foreground">{formatReelSizeSummary(rule)}</div>
      <div className="min-w-0 text-sm text-foreground">
        <p className="truncate">{formatReelResolutionSummary(rule)}</p>
        <p className="text-xs text-muted">{formatDailyUploadLimitSummary(rule)}</p>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{formatDate(rule.effectiveFrom, true)}</p>
        <p className="mt-1 text-xs text-muted">
          {rule.effectiveTo ? formatDate(rule.effectiveTo, true) : 'No end date'}
        </p>
      </div>
      <div className="text-sm text-muted">{formatDate(rule.updatedAt, true)}</div>
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 pl-2">
        <Button
          className="w-[6.5rem] shrink-0 overflow-hidden px-2.5"
          disabled={!canEdit}
          size="sm"
          title={canEdit ? 'Edit content rule' : 'Requires settings:update'}
          type="button"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(rule)
          }}
        >
          <Edit3 className="mr-2 size-4 shrink-0" />
          <span className="min-w-0 truncate">Edit</span>
        </Button>
        <Button
          aria-label={secondaryAction === 'ARCHIVE' ? 'Archive content rule' : 'Activate content rule'}
          className="size-9 shrink-0 px-0"
          disabled={!canRunSecondary}
          size="sm"
          title={canRunSecondary ? undefined : 'Requires settings:update'}
          type="button"
          variant={secondaryAction === 'ARCHIVE' ? 'danger' : 'secondary'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleStatus(rule, secondaryAction)
          }}
        >
          {secondaryAction === 'ARCHIVE' ? (
            <Archive className="size-4 shrink-0" />
          ) : (
            <Power className="size-4 shrink-0" />
          )}
        </Button>
        {canReadAudit ? (
          <button
            className="btn-icon shrink-0"
            title="Open audit history"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAudit(rule)
            }}
          >
            <ClipboardList className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
