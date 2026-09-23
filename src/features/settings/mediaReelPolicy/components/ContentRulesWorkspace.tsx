import { Archive, ClipboardList, Edit3, Plus, Power } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import { Button } from '../../../../components/ui/Button'
import { DataList } from '../../../../components/ui/DataList'
import type {
  DataListColumn,
  DataListQueueTab,
} from '../../../../components/ui/DataList'
import { RowActionMenu, type RowActionMenuItem } from '../../../../components/ui/RowActionMenu'
import { formatCompactDateTime } from '../../../../utils/formatDate'
import type { PolicyRule, PolicyScopeType, PolicyStatus } from '../../types/settings.types'
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

const FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

const CONTENT_RULE_STATUSES: PolicyStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED']
const CONTENT_RULE_SCOPE_TYPES: PolicyScopeType[] = ['GLOBAL', 'CATEGORY', 'CITY', 'ZONE', 'VENDOR']

function humanize(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export interface ContentRulesWorkspaceProps {
  rows: PolicyRule[]
  canReadAudit: boolean
  canUpdateSettings: boolean
  isError: boolean
  isLoading: boolean
  onRetry: () => void

  search: string
  onSearchChange: (value: string) => void

  queueTabs: DataListQueueTab[]
  activeQueue: string
  onQueueChange: (key: string) => void

  policyStatus: string
  policyScopeType: string
  onPolicyStatusChange: (value: string) => void
  onPolicyScopeTypeChange: (value: string) => void
  appliedFilterCount: number
  onResetFilters: () => void

  page: number
  limit: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void

  onPreview: (rule: PolicyRule) => void
  onCreate: () => void
  onEdit: (rule: PolicyRule) => void
  onOpenAudit: (rule: PolicyRule) => void
  onToggleStatus: (rule: PolicyRule, nextStatus: 'ACTIVATE' | 'ARCHIVE') => void
}

export function ContentRulesWorkspace({
  activeQueue,
  appliedFilterCount,
  canReadAudit,
  canUpdateSettings,
  isError,
  isLoading,
  limit,
  onCreate,
  onEdit,
  onOpenAudit,
  onPageChange,
  onPageSizeChange,
  onPolicyScopeTypeChange,
  onPolicyStatusChange,
  onPreview,
  onQueueChange,
  onResetFilters,
  onRetry,
  onSearchChange,
  onToggleStatus,
  page,
  policyScopeType,
  policyStatus,
  queueTabs,
  rows,
  search,
}: ContentRulesWorkspaceProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const filtered = search.trim()
    ? rows.filter((rule) => {
        const needle = search.trim().toLowerCase()
        return (
          rule.displayName.toLowerCase().includes(needle) ||
          rule.ruleKey.toLowerCase().includes(needle)
        )
      })
    : rows
  const totalItems = filtered.length
  const totalPages = Math.max(Math.ceil(totalItems / limit), 1)
  const pageRows = filtered.slice((page - 1) * limit, page * limit)
  const rowActionsWidth =
    canUpdateSettings && pageRows.some((rule) => rule.availableActions.includes('EDIT'))
      ? 132
      : 56

  const columns: DataListColumn<PolicyRule>[] = [
    {
      id: 'rule',
      label: 'Rule',
      defaultWidth: 280,
      minWidth: 220,
      priority: 1,
      grow: true,
      render: (rule) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{rule.displayName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={contentRuleStatusTone(rule.status)}>{rule.status}</Badge>
            {isAppliedFirst(rule, rows) ? <Badge tone="info">Applied first</Badge> : null}
          </div>
        </div>
      ),
    },
    {
      id: 'appliesTo',
      label: 'Applies to',
      defaultWidth: 190,
      minWidth: 150,
      priority: 2,
      render: (rule) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{contentRuleScopeTypeLabel(rule)}</p>
          <p className="truncate text-xs text-muted">
            {contentRuleScopeLabel(rule) === contentRuleScopeTypeLabel(rule)
              ? `Order ${rule.priority}`
              : `${contentRuleScopeLabel(rule)} · Order ${rule.priority}`}
          </p>
        </div>
      ),
    },
    {
      id: 'uploadLimits',
      label: 'Upload limits',
      defaultWidth: 320,
      minWidth: 260,
      priority: 3,
      render: (rule) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {formatReelDurationSummary(rule)} · {formatReelSizeSummary(rule)}
          </p>
          <p className="truncate text-xs text-muted">
            {formatReelResolutionSummary(rule)} · {formatDailyUploadLimitSummary(rule)}
          </p>
        </div>
      ),
    },
    {
      id: 'schedule',
      label: 'Schedule',
      defaultWidth: 220,
      minWidth: 190,
      priority: 3,
      render: (rule) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            Starts {formatCompactDateTime(rule.effectiveFrom)}
          </p>
          <p className="truncate text-xs text-muted">
            {rule.effectiveTo
              ? `Ends ${formatCompactDateTime(rule.effectiveTo)}`
              : 'No end date'}
          </p>
        </div>
      ),
    },
  ]

  const filters = (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted">Status</span>
        <select
          className={FILTER_CONTROL_CLASS_NAME}
          value={policyStatus}
          onChange={(event) => onPolicyStatusChange(event.target.value)}
        >
          <option value="">All</option>
          {CONTENT_RULE_STATUSES.map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted">Scope</span>
        <select
          className={FILTER_CONTROL_CLASS_NAME}
          value={policyScopeType}
          onChange={(event) => onPolicyScopeTypeChange(event.target.value)}
        >
          <option value="">All</option>
          {CONTENT_RULE_SCOPE_TYPES.map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )

  return (
    <DataList<PolicyRule>
      activeQueue={activeQueue}
      appliedFilterCount={appliedFilterCount}
      columns={columns}
      defaultDensity="comfortable"
      emptyMessage="No content rules found"
      emptyHint={
        search.trim() ? 'No rules match your search.' : 'No content rules have been configured yet.'
      }
      errorMessage="We could not load content rules."
      filters={filters}
      getRowId={(rule) => rule.policyRuleId}
      isError={isError}
      isLoading={isLoading}
      pagination={{
        page,
        pageSize: limit,
        totalItems,
        totalPages,
        onPageChange,
        onPageSizeChange,
      }}
      queueTabs={queueTabs}
      rowActions={(rule) => {
        const secondaryAction: 'ACTIVATE' | 'ARCHIVE' = rule.status === 'ACTIVE' ? 'ARCHIVE' : 'ACTIVATE'
        const canEdit = canUpdateSettings && rule.availableActions.includes('EDIT')
        const canRunSecondary = canUpdateSettings && rule.availableActions.includes(secondaryAction)

        const overflowItems: RowActionMenuItem[] = []
        if (canRunSecondary) {
          overflowItems.push({
            key: secondaryAction,
            label: secondaryAction === 'ARCHIVE' ? 'Archive rule' : 'Activate rule',
            icon:
              secondaryAction === 'ARCHIVE' ? (
                <Archive className="size-3.5" />
              ) : (
                <Power className="size-3.5" />
              ),
            tone: secondaryAction === 'ARCHIVE' ? 'danger' : 'default',
            onClick: () => onToggleStatus(rule, secondaryAction),
          })
        }
        if (canReadAudit) {
          overflowItems.push({
            key: 'audit',
            label: 'Audit history',
            icon: <ClipboardList className="size-3.5" />,
            onClick: () => onOpenAudit(rule),
          })
        }

        return (
          <>
            {canEdit ? (
              <Button
                className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
                size="xs"
                title="Edit content rule"
                type="button"
                variant="secondary"
                onClick={() => onEdit(rule)}
              >
                <Edit3 className="mr-1 size-3" />
                Edit
              </Button>
            ) : null}
            <RowActionMenu
              ariaLabel={`More actions for ${rule.displayName}`}
              items={overflowItems}
            />
          </>
        )
      }}
      rowActionsWidth={rowActionsWidth}
      rowHeight={64}
      rows={pageRows}
      search={search}
      searchPlaceholder="Search content rules..."
      selection={{ selectedIds, onSelectionChange: setSelectedIds }}
      showDensityControl={false}
      storageKey="servicegram.settings.contentRules.list.v1"
      toolbarActions={
        <Button
          disabled={!canUpdateSettings}
          size="sm"
          title={canUpdateSettings ? 'Create content rule' : 'Requires settings:update'}
          type="button"
          variant="primary"
          onClick={onCreate}
        >
          <Plus className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Content rule</span>
        </Button>
      }
      onQueueChange={onQueueChange}
      onResetFilters={onResetFilters}
      onRetry={onRetry}
      onRowClick={onPreview}
      onSearchChange={onSearchChange}
    />
  )
}
