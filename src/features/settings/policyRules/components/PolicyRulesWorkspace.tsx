import { Archive, Calculator, ClipboardList, Edit3, Plus, Power } from 'lucide-react'
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
import type {
  PolicyFamily,
  PolicyRule,
  PolicyScopeType,
  PolicyStatus,
} from '../../types/settings.types'
import {
  getPolicyRuleScopeLabel,
  getPolicyRuleScopeTypeLabel,
  hasPolicyRuleAction,
  humanizeCode,
  policyRuleStatusTone,
} from '../utils/policyRulePresentation'

const FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

const POLICY_FAMILIES: PolicyFamily[] = [
  'CUSTOMER_CATEGORY_PLACEMENT',
  'NOTIFICATION_WORKFLOW',
  'MEDIA_REEL_RULE',
  'PRICING_RULE',
  'COMMISSION_RULE',
]
const POLICY_STATUSES: PolicyStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED']
const POLICY_SCOPE_TYPES: PolicyScopeType[] = ['GLOBAL', 'CATEGORY', 'CITY', 'ZONE', 'VENDOR']

export type PolicyRuleRowAction =
  | { action: 'EDIT' | 'ACTIVATE' | 'ARCHIVE'; record: PolicyRule }

export interface PolicyRulesWorkspaceProps {
  rows: PolicyRule[]
  canReadAudit: boolean
  canReadVendors: boolean
  canUpdateSettings: boolean
  isError: boolean
  isLoading: boolean
  onRetry: () => void

  search: string
  onSearchChange: (value: string) => void

  queueTabs: DataListQueueTab[]
  activeQueue: string
  onQueueChange: (key: string) => void

  policyFamily: string
  policyStatus: string
  policyScopeType: string
  onPolicyFamilyChange: (value: string) => void
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
  onPreviewPricing: () => void
  onSelectAction: (action: PolicyRuleRowAction) => void
  onOpenAudit: (rule: PolicyRule) => void
  onOpenCategory: (categoryId: string) => void
  onOpenZone: (zoneId: string) => void
  onOpenVendor: (vendorId: string) => void
}

export function PolicyRulesWorkspace({
  activeQueue,
  appliedFilterCount,
  canReadAudit,
  canReadVendors,
  canUpdateSettings,
  isError,
  isLoading,
  limit,
  onCreate,
  onOpenAudit,
  onOpenCategory,
  onOpenVendor,
  onOpenZone,
  onPageChange,
  onPageSizeChange,
  onPolicyFamilyChange,
  onPolicyScopeTypeChange,
  onPolicyStatusChange,
  onPreview,
  onPreviewPricing,
  onQueueChange,
  onResetFilters,
  onRetry,
  onSearchChange,
  onSelectAction,
  page,
  policyFamily,
  policyScopeType,
  policyStatus,
  queueTabs,
  rows,
  search,
}: PolicyRulesWorkspaceProps) {
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
  // The Edit pill only shows for rows the backend allows editing — reserving
  // room for it when nothing on the page has one leaves a dead gap in front
  // of "···".
  const rowActionsWidth =
    canUpdateSettings && pageRows.some((rule) => hasPolicyRuleAction(rule, 'EDIT')) ? 132 : 56

  const columns: DataListColumn<PolicyRule>[] = [
    {
      id: 'rule',
      label: 'Rule',
      defaultWidth: 360,
      minWidth: 260,
      priority: 1,
      grow: true,
      render: (rule) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground" title={rule.ruleKey}>
            {rule.displayName}
          </p>
          <p className="truncate text-xs text-muted">
            {humanizeCode(rule.family)} · v{rule.version}
          </p>
        </div>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      defaultWidth: 110,
      minWidth: 90,
      priority: 2,
      render: (rule) => (
        <Badge tone={policyRuleStatusTone(rule.status)}>{humanizeCode(rule.status)}</Badge>
      ),
    },
    {
      id: 'appliesTo',
      label: 'Applies to',
      defaultWidth: 280,
      minWidth: 220,
      priority: 2,
      render: (rule) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium text-foreground">
              {getPolicyRuleScopeTypeLabel(rule)}
            </p>
            {rule.scope.categoryId ? (
              <button
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenCategory(rule.scope.categoryId as string)
                }}
              >
                Category
              </button>
            ) : null}
            {rule.scope.zoneId ? (
              <button
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenZone(rule.scope.zoneId as string)
                }}
              >
                Zone
              </button>
            ) : null}
            {rule.scope.vendorId && canReadVendors ? (
              <button
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenVendor(rule.scope.vendorId as string)
                }}
              >
                Vendor
              </button>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted">
            {getPolicyRuleScopeLabel(rule)} · Order {rule.priority}
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
        <span className="text-xs font-semibold text-muted">Family</span>
        <select
          className={FILTER_CONTROL_CLASS_NAME}
          value={policyFamily}
          onChange={(event) => onPolicyFamilyChange(event.target.value)}
        >
          <option value="">All</option>
          {POLICY_FAMILIES.map((option) => (
            <option key={option} value={option}>
              {humanizeCode(option)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-muted">Status</span>
        <select
          className={FILTER_CONTROL_CLASS_NAME}
          value={policyStatus}
          onChange={(event) => onPolicyStatusChange(event.target.value)}
        >
          <option value="">All</option>
          {POLICY_STATUSES.map((option) => (
            <option key={option} value={option}>
              {humanizeCode(option)}
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
          {POLICY_SCOPE_TYPES.map((option) => (
            <option key={option} value={option}>
              {humanizeCode(option)}
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
      emptyMessage="No policy rules found"
      emptyHint={search.trim() ? 'No rules match your search.' : 'No policy rules matched the current filters.'}
      errorMessage="We could not load policy rules."
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
        const canEdit = canUpdateSettings && hasPolicyRuleAction(rule, 'EDIT')
        const canRunSecondary = canUpdateSettings && hasPolicyRuleAction(rule, secondaryAction)

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
            onClick: () => onSelectAction({ action: secondaryAction, record: rule }),
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
                title="Edit policy rule"
                type="button"
                variant="secondary"
                onClick={() => onSelectAction({ action: 'EDIT', record: rule })}
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
      search={search}
      searchPlaceholder="Search policy rules..."
      storageKey="servicegram.settings.policyRules.list.v1"
      showDensityControl={false}
      toolbarActions={
        <>
          <Button size="sm" type="button" variant="secondary" onClick={onPreviewPricing}>
            <Calculator className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Preview pricing</span>
          </Button>
          <Button
            disabled={!canUpdateSettings}
            size="sm"
            title={canUpdateSettings ? 'Create policy rule' : 'Requires settings:update'}
            type="button"
            variant="primary"
            onClick={onCreate}
          >
            <Plus className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">Policy rule</span>
          </Button>
        </>
      }
      rows={pageRows}
      onQueueChange={onQueueChange}
      onResetFilters={onResetFilters}
      onRetry={onRetry}
      onRowClick={onPreview}
      onSearchChange={onSearchChange}
      selection={{ selectedIds, onSelectionChange: setSelectedIds }}
    />
  )
}
