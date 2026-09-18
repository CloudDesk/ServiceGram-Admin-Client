import { Archive, ClipboardList, Edit3, Power, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import {
  QuickPreviewActions,
  QuickPreviewTabs,
  quickPreviewMediumPanelClassName,
  quickPreviewOverlayClassName,
  type QuickPreviewAction,
} from '../../../../components/ui/QuickPreview'
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

type PreviewTab = 'summary' | 'details'

export function ContentRulePreviewBody({
  allRules,
  canReadAudit,
  canUpdateSettings,
  isSubmitting,
  onClose,
  onEdit,
  onOpenAudit,
  onToggleStatus,
  rule,
}: {
  allRules: PolicyRule[]
  canReadAudit: boolean
  canUpdateSettings: boolean
  isSubmitting: boolean
  onClose: () => void
  onEdit: (rule: PolicyRule) => void
  onOpenAudit: (rule: PolicyRule) => void
  onToggleStatus: (rule: PolicyRule, nextStatus: 'ACTIVATE' | 'ARCHIVE') => void
  rule: PolicyRule
}) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('summary')
  const secondaryAction: 'ACTIVATE' | 'ARCHIVE' = rule.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVATE'
  const canEdit = canUpdateSettings && rule.availableActions.includes('EDIT')
  const canRunSecondary = canUpdateSettings && rule.availableActions.includes(secondaryAction)

  const secondaryStateAction: QuickPreviewAction = {
    disabled: isSubmitting,
    icon: secondaryAction === 'ARCHIVE' ? <Archive className="size-4" /> : <Power className="size-4" />,
    key: secondaryAction,
    label: secondaryAction === 'ARCHIVE' ? 'Archive rule' : 'Activate rule',
    onClick: () => onToggleStatus(rule, secondaryAction),
    variant: secondaryAction === 'ARCHIVE' ? 'danger' : 'secondary',
  }
  const primaryAction: QuickPreviewAction | null = canEdit
    ? {
        disabled: isSubmitting,
        icon: <Edit3 className="size-4" />,
        key: 'edit-content-rule',
        label: 'Edit rule',
        onClick: () => onEdit(rule),
        variant: 'primary',
      }
    : canRunSecondary && secondaryAction === 'ACTIVATE'
      ? secondaryStateAction
      : null
  const secondaryActions: QuickPreviewAction[] = []
  if (canRunSecondary && primaryAction?.key !== secondaryAction) {
    secondaryActions.push(secondaryStateAction)
  }
  if (canReadAudit) {
    secondaryActions.push({
      icon: <ClipboardList className="size-4" />,
      key: 'audit',
      label: 'Open audit',
      onClick: () => onOpenAudit(rule),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close content rule preview"
        className={quickPreviewOverlayClassName}
        type="button"
        onClick={onClose}
      />
      <aside className={quickPreviewMediumPanelClassName}>
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">{rule.displayName}</h2>
                <Badge tone={contentRuleStatusTone(rule.status)}>{rule.status}</Badge>
                {isAppliedFirst(rule, allRules) ? <Badge tone="info">Applied first</Badge> : null}
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {contentRuleScopeTypeLabel(rule)} / v{rule.version}
              </p>
            </div>
            <button
              aria-label="Close content rule preview panel"
              className="btn-icon shrink-0"
              title="Close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Content rule preview sections"
          tabs={[
            { key: 'summary', label: 'Summary' },
            { key: 'details', label: 'Details' },
          ]}
          onChange={(tab) => setActiveTab(tab as PreviewTab)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mx-auto w-24">
                  <div
                    className="mx-auto flex items-center justify-center rounded-[0.8rem] border-4 border-foreground/80 bg-surface-muted/40 p-1"
                    style={{ aspectRatio: '9 / 16', width: '100%' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <SummaryField label="Reel length" value={formatReelDurationSummary(rule)} />
                <SummaryField label="Max size" value={formatReelSizeSummary(rule)} />
                <SummaryField label="Resolution" value={formatReelResolutionSummary(rule)} />
                <SummaryField label="Daily uploads" value={formatDailyUploadLimitSummary(rule)} />
              </div>
            </div>
          ) : null}
          {activeTab === 'details' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <SummaryField label="Applies to" value={contentRuleScopeLabel(rule)} />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <SummaryField
                  label="Effective"
                  value={`${formatDate(rule.effectiveFrom, true)} - ${
                    rule.effectiveTo ? formatDate(rule.effectiveTo, true) : 'No end date'
                  }`}
                />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <SummaryField label="Rule order" value={`${rule.priority} (lower applies first)`} />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <SummaryField label="Last updated" value={formatDate(rule.updatedAt, true)} />
              </div>
            </div>
          ) : null}
        </div>
        <QuickPreviewActions primaryAction={primaryAction} secondaryActions={secondaryActions} />
      </aside>
    </>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
