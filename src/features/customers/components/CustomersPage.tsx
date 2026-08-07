import {
  ArrowUpRight,
  Ban,
  Clock3,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  MapPin,
  MessageSquarePlus,
  Phone,
  RefreshCcw,
  ReceiptText,
  ShieldAlert,
  SlidersHorizontal,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../../../components/ui/ListSelection'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import { featureFlags } from '../../../config/featureFlags'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { customerService } from '../services/customer.service'
import {
  CustomerActionModal,
  type CustomerActionFormValues,
  type CustomerActionKind,
  type CustomerActionSelection,
} from './CustomerActionModal'
import type {
  AdminCustomerListItem,
  AdminCustomersPagination,
  AdminCustomersQueryParams,
  AdminCustomerStatus,
} from '../types/customer.types'

const DEFAULT_PAGE_SIZE = 10
const CUSTOMER_DEFAULT_COLUMN_WIDTH = 220
const CUSTOMER_GRID_COLUMN_GAP = 8
const CUSTOMER_GRID_INLINE_PADDING = 20
const customerDataColumns = [
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: 300,
    minWidth: 220,
  },
  {
    id: 'location',
    label: 'Location',
    defaultWidth: 190,
    minWidth: 140,
  },
  {
    id: 'health',
    label: 'Signals',
    defaultWidth: 170,
    minWidth: 140,
  },
  {
    id: 'orders',
    label: 'Orders / Spend',
    defaultWidth: 170,
    minWidth: 135,
  },
  ...(featureFlags.customerWallet
    ? ([
        {
          id: 'wallet',
          label: 'Wallet',
          defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
          minWidth: 130,
        },
      ] as const)
    : []),
  {
    id: 'lastLogin',
    label: 'Login',
    defaultWidth: 140,
    minWidth: 100,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: CUSTOMER_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
] as const
const CUSTOMER_ACTION_COLUMN_ID = 'actions'
const CUSTOMER_ACTION_COLUMN_DEFAULT_WIDTH = 176
const CUSTOMER_ACTION_COLUMN_MIN_WIDTH = 156
const CUSTOMER_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.customer.columnWidths.v7'
const CUSTOMER_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

type CustomerColumnId = (typeof customerDataColumns)[number]['id']
type CustomerColumnWidthId = CustomerColumnId | typeof CUSTOMER_ACTION_COLUMN_ID
type CustomerColumnWidths = Partial<Record<CustomerColumnWidthId, number>>
type CustomerPreviewTab = 'summary' | 'activity' | 'signals'
const defaultCustomerColumns = customerDataColumns
  .filter(
    (column) =>
      column.id !== 'updatedAt' &&
      column.id !== 'wallet' &&
      column.id !== 'health',
  )
  .map((column) => column.id) as CustomerColumnId[]
type QueueKey =
  | 'all'
  | 'active'
  | 'blocked'
  | 'incomplete'
  | 'activeOrders'

interface ActionTarget {
  action: CustomerActionSelection
  customer: AdminCustomerListItem
}

interface CustomerGridStyle extends CSSProperties {
  '--customer-grid-template': string
  '--customer-grid-min-width': string
}

function getDefaultCustomerColumnWidths() {
  const widths: CustomerColumnWidths = {
    [CUSTOMER_ACTION_COLUMN_ID]: CUSTOMER_ACTION_COLUMN_DEFAULT_WIDTH,
  }

  customerDataColumns.forEach((column) => {
    widths[column.id] = column.defaultWidth
  })

  return widths
}

const defaultCustomerColumnWidths = getDefaultCustomerColumnWidths()

function getCustomerColumnMinWidth(columnId: CustomerColumnWidthId) {
  if (columnId === CUSTOMER_ACTION_COLUMN_ID) {
    return CUSTOMER_ACTION_COLUMN_MIN_WIDTH
  }

  return (
    customerDataColumns.find((column) => column.id === columnId)?.minWidth ?? 120
  )
}

function getCustomerColumnDefaultWidth(columnId: CustomerColumnWidthId) {
  return (
    defaultCustomerColumnWidths[columnId] ?? getCustomerColumnMinWidth(columnId)
  )
}

function getCustomerColumnWidth(
  columnWidths: CustomerColumnWidths,
  columnId: CustomerColumnWidthId,
) {
  return Math.max(
    getCustomerColumnMinWidth(columnId),
    columnWidths[columnId] ?? getCustomerColumnDefaultWidth(columnId),
  )
}

function normalizeCustomerColumnWidths(value: unknown) {
  const widths = { ...defaultCustomerColumnWidths }

  if (!value || typeof value !== 'object') {
    return widths
  }

  const record = value as Record<string, unknown>

  customerDataColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  const actionWidth = record[CUSTOMER_ACTION_COLUMN_ID]

  if (typeof actionWidth === 'number' && Number.isFinite(actionWidth)) {
    widths[CUSTOMER_ACTION_COLUMN_ID] = Math.max(
      CUSTOMER_ACTION_COLUMN_MIN_WIDTH,
      Math.round(actionWidth),
    )
  }

  return widths
}

function loadCustomerColumnWidths() {
  if (typeof window === 'undefined') {
    return defaultCustomerColumnWidths
  }

  try {
    return normalizeCustomerColumnWidths(
      JSON.parse(
        window.localStorage.getItem(CUSTOMER_COLUMN_WIDTH_STORAGE_KEY) ?? 'null',
      ),
    )
  } catch {
    return defaultCustomerColumnWidths
  }
}

function statusTone(status: AdminCustomerStatus) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'BLOCKED') return 'danger'
  return 'warning'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review customer'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function customerAvatarClass(customer: AdminCustomerListItem) {
  if (customer.status === 'BLOCKED') {
    return 'bg-danger/10 text-danger ring-1 ring-danger/20'
  }

  if (customer.status === 'INCOMPLETE') {
    return 'bg-warning/10 text-warning ring-1 ring-warning/20'
  }

  return 'bg-primary/10 text-primary ring-1 ring-primary/15'
}

function formatOrderCount(value: number) {
  return `${value} ${value === 1 ? 'order' : 'orders'}`
}

function signalLabel(warning: string) {
  const labels: Record<string, string> = {
    CUSTOMER_BLOCKED: 'Customer blocked',
    HAS_ACTIVE_ORDERS: 'Active orders',
    HAS_WALLET_CREDIT: 'Wallet credit',
    PROFILE_INCOMPLETE: 'Profile incomplete',
    ZONE_MISSING: 'Zone missing',
  }

  return labels[warning] ?? humanizeCode(warning)
}

function customerNeedsAttention(customer: AdminCustomerListItem) {
  return (
    customer.status !== 'ACTIVE' ||
    visibleWarnings(customer.warnings).length > 0 ||
    Boolean(visibleRecommendedAction(customer))
  )
}

function customerHealth(customer: AdminCustomerListItem) {
  let score = 100

  if (customer.status === 'BLOCKED') score -= 55
  if (customer.status === 'INCOMPLETE') score -= 25
  if (!customer.zone) score -= 12
  if (customer.orderSummary.activeOrders > 0) score -= 8
  if (featureFlags.customerWallet && customer.walletSummary.creditBalancePaise > 0) score -= 5
  score -= Math.min(visibleWarnings(customer.warnings).length * 10, 30)

  return Math.max(18, Math.min(98, score))
}

function healthColor(score: number) {
  if (score >= 80) return 'bg-success'
  if (score >= 55) return 'bg-warning'
  return 'bg-danger'
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function formatPaise(value: number) {
  return formatMoney(value / 100)
}

function isWalletAction(action: string | null | undefined) {
  return action?.toUpperCase() === 'WALLET_CREDIT'
}

function visibleWarnings(warnings: string[]) {
  return featureFlags.customerWallet
    ? warnings
    : warnings.filter((warning) => warning !== 'HAS_WALLET_CREDIT')
}

function visibleRecommendedAction(customer: AdminCustomerListItem) {
  if (!featureFlags.customerWallet && isWalletAction(customer.nextRecommendedAction)) {
    return null
  }

  return customer.nextRecommendedAction
}

function visibleAvailableActions(actions: string[]) {
  return featureFlags.customerWallet
    ? actions
    : actions.filter((action) => action !== 'WALLET_CREDIT')
}

const customerUpdateActions = new Set([
  'ADD_NOTE',
  'BLOCK',
  'EDIT_PROFILE',
  'MANAGE_ADDRESSES',
  'UNBLOCK',
])

function canRunCustomerAction({
  action,
  canCreditWallet,
  canUpdateCustomer,
}: {
  action: string
  canCreditWallet: boolean
  canUpdateCustomer: boolean
}) {
  const normalizedAction = action.toUpperCase()

  if (customerUpdateActions.has(normalizedAction)) {
    return canUpdateCustomer
  }

  if (normalizedAction === 'WALLET_CREDIT') {
    return featureFlags.customerWallet && canCreditWallet
  }

  return false
}

function permittedAvailableActions(
  actions: string[],
  access: {
    canCreditWallet: boolean
    canUpdateCustomer: boolean
  },
) {
  return visibleAvailableActions(actions).filter((action) =>
    canRunCustomerAction({ action, ...access }),
  )
}

function primaryActionLabel(customer: AdminCustomerListItem) {
  const nextRecommendedAction = visibleRecommendedAction(customer)

  if (nextRecommendedAction) {
    return humanizeCode(nextRecommendedAction)
  }

  if (customer.status === 'BLOCKED') return 'Review block'
  if (visibleWarnings(customer.warnings).length > 0) return 'Review customer'

  return 'View details'
}

function mapRecommendedAction(
  customer: AdminCustomerListItem,
  access: {
    canCreditWallet: boolean
    canUpdateCustomer: boolean
  },
): CustomerActionKind | null {
  const action = customer.nextRecommendedAction?.toUpperCase()

  if (!featureFlags.customerWallet && action === 'WALLET_CREDIT') {
    return null
  }

  if (!action || !canRunCustomerAction({ action, ...access })) {
    return null
  }

  if (
    action === 'BLOCK' ||
    action === 'UNBLOCK' ||
    action === 'WALLET_CREDIT' ||
    action === 'ADD_NOTE'
  ) {
    if (action === 'ADD_NOTE' || customer.availableActions.includes(action)) {
      return action as CustomerActionKind
    }
  }

  return null
}

function getCustomerGridTemplate(
  visibleColumns: CustomerColumnId[],
  columnWidths: CustomerColumnWidths,
) {
  const selectedWidths = customerDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => {
      const width = getCustomerColumnWidth(columnWidths, column.id)

      return column.id === 'customer' ? `minmax(${width}px, 1fr)` : `${width}px`
    })

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${getCustomerColumnWidth(columnWidths, CUSTOMER_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getCustomerGridMinWidth(
  visibleColumns: CustomerColumnId[],
  columnWidths: CustomerColumnWidths,
) {
  const visibleColumnCount = visibleColumns.length
  const gridColumnCount = visibleColumnCount + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * CUSTOMER_GRID_COLUMN_GAP
  const visibleWidth = customerDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getCustomerColumnWidth(columnWidths, column.id),
      0,
    )

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    getCustomerColumnWidth(columnWidths, CUSTOMER_ACTION_COLUMN_ID) +
    gridGapWidth +
    CUSTOMER_GRID_INLINE_PADDING
  }px`
}

interface ActiveFilterChip {
  key: string
  label: string
  onClear: () => void
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[]
  onClearAll: () => void
}) {
  if (!chips.length) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={`Clear ${chip.label}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
            type="button"
            onClick={chip.onClear}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function CustomerPreviewField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </span>
    </div>
  )
}

function CustomerPreviewPanel({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenDetails,
}: {
  canCreditWallet: boolean
  canUpdateCustomer: boolean
  customer: AdminCustomerListItem
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onOpenDetails: (customer: AdminCustomerListItem) => void
}) {
  const health = customerHealth(customer)
  const actionAccess = {
    canCreditWallet,
    canUpdateCustomer,
  }
  const warnings = visibleWarnings(customer.warnings)
  const availableActions = permittedAvailableActions(
    customer.availableActions,
    actionAccess,
  )
  const recommendedAction = mapRecommendedAction(customer, actionAccess)
  const hasAction = (action: string) => availableActions.includes(action)
  const canBlock = hasAction('BLOCK')
  const canUnblock = hasAction('UNBLOCK')
  const canAddNote = hasAction('ADD_NOTE')
  const canCredit =
    featureFlags.customerWallet && canCreditWallet && hasAction('WALLET_CREDIT')
  const [activeTab, setActiveTab] = useState<CustomerPreviewTab>('summary')
  const previewTabs: { key: CustomerPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'activity', label: 'Activity' },
    { key: 'signals', label: 'Signals' },
  ]
  const priorityLabel = recommendedAction
    ? humanizeCode(recommendedAction)
    : warnings[0]
      ? signalLabel(warnings[0])
      : 'No active warning'
  const hasPrioritySignal = Boolean(recommendedAction || warnings.length)
  const signalMetaLabel = warnings.length
    ? `${warnings.length} signal${warnings.length === 1 ? '' : 's'}`
    : recommendedAction
      ? 'Action'
      : 'Clear'
  const primaryAction: QuickPreviewAction | null = recommendedAction
    ? {
        disabled: isSubmitting,
        icon: <ArrowUpRight className="size-4" />,
        key: recommendedAction,
        label: humanizeCode(recommendedAction),
        onClick: () => onOpenAction(customer, recommendedAction),
        variant: recommendedAction === 'BLOCK' ? 'danger' : 'primary',
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <Eye className="size-4" />,
    key: 'details',
    label: primaryAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(customer),
  }
  const secondaryActions: QuickPreviewAction[] = []

  if (canAddNote && recommendedAction !== 'ADD_NOTE') {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <MessageSquarePlus className="size-4" />,
      key: 'add-note',
      label: 'Add note',
      onClick: () => onOpenAction(customer, 'ADD_NOTE'),
      variant: 'secondary',
    })
  }

  if (canCredit && recommendedAction !== 'WALLET_CREDIT') {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <Wallet className="size-4" />,
      key: 'wallet-credit',
      label: 'Wallet credit',
      onClick: () => onOpenAction(customer, 'WALLET_CREDIT'),
      variant: 'secondary',
    })
  }

  if (canBlock && recommendedAction !== 'BLOCK') {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <Ban className="size-4" />,
      key: 'block',
      label: 'Block',
      onClick: () => onOpenAction(customer, 'BLOCK'),
      variant: 'danger',
    })
  }

  if (canUnblock && recommendedAction !== 'UNBLOCK') {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <UserCheck className="size-4" />,
      key: 'unblock',
      label: 'Unblock',
      onClick: () => onOpenAction(customer, 'UNBLOCK'),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close customer preview"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:inset-x-auto xl:bottom-6 xl:right-6 xl:top-[calc(var(--spacing-topbar)+0.75rem)] xl:z-40 xl:w-[22rem]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Customer preview
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-2.5">
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  customerAvatarClass(customer),
                )}
              >
                {getInitials(customer.fullName)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {customer.fullName}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Badge tone={statusTone(customer.status)}>
                    {customer.status}
                  </Badge>
                  {customerNeedsAttention(customer) ? (
                    <Badge tone="warning">Needs review</Badge>
                  ) : (
                    <Badge tone="success">Healthy</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            aria-label="Close preview"
            className="btn-icon shrink-0"
            title="Close preview"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Customer preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-2.5">
              <div
                className={cn(
                  'flex min-h-9 items-center justify-between gap-2 rounded-[0.65rem] border px-2.5 py-2',
                  hasPrioritySignal
                    ? 'border-warning/25 bg-warning/10'
                    : 'border-success/20 bg-success/10',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ShieldAlert
                    className={cn(
                      'size-4 shrink-0',
                      hasPrioritySignal ? 'text-warning' : 'text-success',
                    )}
                  />
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {priorityLabel}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                    hasPrioritySignal
                      ? 'bg-warning/15 text-warning'
                      : 'bg-success/15 text-success',
                  )}
                >
                  {signalMetaLabel}
                </span>
              </div>

              <QuickPreviewFactGrid>
                <QuickPreviewFact
                  label="Mobile"
                  value={customer.mobileNumber ?? 'No mobile'}
                />
                <QuickPreviewFact
                  label="Zone"
                  tone={customer.zone ? 'neutral' : 'warning'}
                  value={customer.zone?.zoneName ?? 'No zone'}
                />
                <QuickPreviewFact
                  label="Active orders"
                  value={customer.orderSummary.activeOrders}
                />
                {featureFlags.customerWallet ? (
                  <QuickPreviewFact
                    label="Wallet"
                    value={formatPaise(customer.walletSummary.creditBalancePaise)}
                  />
                ) : (
                  <QuickPreviewFact
                    label="Lifetime spend"
                    value={formatPaise(customer.orderSummary.lifetimeSpendPaise)}
                  />
                )}
              </QuickPreviewFactGrid>
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="size-4 text-muted" />
                  Contact
                </div>
                <CustomerPreviewField
                  label="Mobile"
                  value={customer.mobileNumber ?? 'No mobile'}
                />
                <CustomerPreviewField
                  label="Email"
                  value={customer.email ?? 'No email'}
                />
                <CustomerPreviewField
                  label="City"
                  value={customer.city || customer.zone?.city || 'No city'}
                />
                <CustomerPreviewField
                  label="Zone"
                  value={customer.zone?.zoneName ?? 'No zone'}
                />
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ReceiptText className="size-4 text-muted" />
                  Activity
                </div>
                <CustomerPreviewField
                  label="Orders"
                  value={`${customer.orderSummary.totalOrders} total / ${customer.orderSummary.activeOrders} active`}
                />
                <CustomerPreviewField
                  label="Last order"
                  value={formatDateSafe(customer.orderSummary.lastOrderAt)}
                />
                <CustomerPreviewField
                  label="Lifetime spend"
                  value={formatPaise(customer.orderSummary.lifetimeSpendPaise)}
                />
                <CustomerPreviewField
                  label="Last login"
                  value={formatDateSafe(customer.lastLoginAt)}
                />
                <CustomerPreviewField
                  label="Notes"
                  value={`${customer.noteSummary.totalNotes} total`}
                />
                {featureFlags.customerWallet ? (
                  <CustomerPreviewField
                    label="Wallet provider"
                    value={customer.walletSummary.providerStatus}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'signals' ? (
            <div className="rounded-[0.75rem] border border-border p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock3 className="size-4 text-muted" />
                  Signals
                </div>
                <span className="text-xs font-semibold text-muted">
                  Health {health}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-muted">
                <div
                  className={cn('h-2 rounded-full', healthColor(health))}
                  style={{ width: `${health}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {warnings.length ? (
                  warnings.map((warning) => (
                    <Badge key={warning} tone="warning">
                      {signalLabel(warning)}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="success">No warnings</Badge>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <QuickPreviewActions
          detailAction={detailAction}
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
        />
      </aside>
    </>
  )
}

function CustomerRow({
  canCreditWallet,
  canUpdateCustomer,
  customer,
  isPreviewed,
  isSelected,
  isSubmitting,
  onOpenAction,
  onPreview,
  onSelect,
  visibleColumns,
}: {
  canCreditWallet: boolean
  canUpdateCustomer: boolean
  customer: AdminCustomerListItem
  isPreviewed: boolean
  isSelected: boolean
  isSubmitting: boolean
  onOpenAction: (customer: AdminCustomerListItem, kind: CustomerActionKind) => void
  onPreview: (customer: AdminCustomerListItem) => void
  onSelect: (customer: AdminCustomerListItem, selected: boolean) => void
  visibleColumns: CustomerColumnId[]
}) {
  const health = customerHealth(customer)
  const actionAccess = {
    canCreditWallet,
    canUpdateCustomer,
  }
  const availableActions = permittedAvailableActions(
    customer.availableActions,
    actionAccess,
  )
  const hasAction = (action: string) => availableActions.includes(action)
  const recommendedAction = mapRecommendedAction(customer, actionAccess)
  const warningCount = visibleWarnings(customer.warnings).length
  const canBlock = hasAction('BLOCK')
  const canUnblock = hasAction('UNBLOCK')
  const showWalletAction =
    hasAction('WALLET_CREDIT') && recommendedAction !== 'WALLET_CREDIT'
  const showAddNoteAction =
    hasAction('ADD_NOTE') && recommendedAction !== 'ADD_NOTE'
  const showBlockAction = canBlock && recommendedAction !== 'BLOCK'
  const showUnblockAction = canUnblock && recommendedAction !== 'UNBLOCK'
  const showColumn = (columnId: CustomerColumnId) => visibleColumns.includes(columnId)

  const handlePrimaryAction = () => {
    if (!recommendedAction) return

    onOpenAction(customer, recommendedAction)
  }

  return (
    <article
      aria-selected={isPreviewed || isSelected}
      className={cn(
        'workbench-grid-row grid min-w-0 cursor-pointer gap-2 border-b border-border bg-surface px-3 py-2 transition last:border-b-0 hover:bg-surface-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--customer-grid-template)] xl:items-center',
        isPreviewed && 'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      aria-label={`Preview ${customer.fullName}`}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(customer)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPreview(customer)
        }
      }}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${customer.fullName}`}
          onChange={(selected) => onSelect(customer, selected)}
        />
      </div>
      {showColumn('customer') ? (
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              customerAvatarClass(customer),
            )}
          >
            {getInitials(customer.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                {customer.fullName}
              </p>
              <span className="shrink-0">
                <Badge tone={statusTone(customer.status)}>{customer.status}</Badge>
              </span>
              {warningCount > 0 && !showColumn('health') ? (
                <span
                  className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-warning/10 px-1.5 text-xs font-semibold text-warning"
                  title={visibleWarnings(customer.warnings).map(signalLabel).join(', ')}
                >
                  <ShieldAlert className="size-3" />
                  {warningCount}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 overflow-hidden text-xs text-muted">
              <span className="shrink-0">{customer.mobileNumber ?? 'No mobile'}</span>
              <span className="shrink-0 text-border">/</span>
              <span className="min-w-0 truncate">
                {customer.email ?? 'No email'}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {showColumn('location') ? (
        <div className="space-y-0.5 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-3.5 text-muted" />
            <span className="truncate">
              {customer.city || customer.zone?.city || 'No city'}
            </span>
          </div>
          <p className="truncate pl-5 text-xs text-muted">
            {customer.zone?.zoneName ?? 'No zone'}
          </p>
        </div>
      ) : null}

      {showColumn('health') ? (
        <div className="w-full min-w-0 space-y-1.5 xl:max-w-72">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted">
              {customer.orderSummary.activeOrders} active
            </span>
            <span className="font-semibold text-foreground">{health}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-muted">
            <div
              className={cn('h-1.5 rounded-full', healthColor(health))}
              style={{ width: `${health}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>{warningCount} warnings</span>
          </div>
        </div>
      ) : null}

      {showColumn('orders') ? (
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            {formatOrderCount(customer.orderSummary.totalOrders)}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatPaise(customer.orderSummary.lifetimeSpendPaise)} spend
          </p>
        </div>
      ) : null}

      {featureFlags.customerWallet && showColumn('wallet') ? (
        <div className="text-sm">
          <p className="font-semibold text-foreground">
            {formatPaise(customer.walletSummary.creditBalancePaise)}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {customer.walletSummary.providerStatus}
          </p>
        </div>
      ) : null}

      {showColumn('lastLogin') ? (
        <div className="text-sm">
          <p className="truncate text-foreground">
            {customer.lastLoginAt ? formatDateSafe(customer.lastLoginAt) : 'No login'}
          </p>
          <p className="mt-0.5 text-xs text-muted">Last login</p>
        </div>
      ) : null}

      {showColumn('updatedAt') ? (
        <div className="text-sm">
          <p className="text-foreground">{formatDateSafe(customer.updatedAt)}</p>
          <p className="mt-0.5 text-xs text-muted">Updated</p>
        </div>
      ) : null}

      <div className="workbench-sticky-action-cell flex flex-nowrap items-center gap-1.5 pl-2 xl:justify-end">
        {recommendedAction ? (
          <Button
            className="h-8 min-h-8 whitespace-nowrap px-2.5"
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant={
              recommendedAction === 'BLOCK'
                ? 'danger'
                : recommendedAction === 'ADD_NOTE'
                  ? 'secondary'
                  : 'primary'
            }
            onClick={(event) => {
              event.stopPropagation()
              handlePrimaryAction()
            }}
          >
            {recommendedAction === 'ADD_NOTE' ? (
              <MessageSquarePlus className="mr-1.5 size-3.5" />
            ) : (
              <ArrowUpRight className="mr-1.5 size-3.5" />
            )}
            {primaryActionLabel(customer)}
          </Button>
        ) : null}
        {showWalletAction ? (
          <button
            aria-label={`Wallet credit for ${customer.fullName}`}
            className="btn-icon size-8 min-h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Wallet credit"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'WALLET_CREDIT')
            }}
          >
            <Wallet className="size-3.5" />
          </button>
        ) : null}
        {showAddNoteAction ? (
          <button
            aria-label={`Add note for ${customer.fullName}`}
            className="btn-icon size-8 min-h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Add note"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'ADD_NOTE')
            }}
          >
            <MessageSquarePlus className="size-3.5" />
          </button>
        ) : null}
        {showBlockAction ? (
          <button
            aria-label={`Block ${customer.fullName}`}
            className="btn-icon size-8 min-h-8 shrink-0 text-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Block customer"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'BLOCK')
            }}
          >
            <Ban className="size-3.5" />
          </button>
        ) : null}
        {showUnblockAction ? (
          <button
            aria-label={`Unblock ${customer.fullName}`}
            className="btn-icon size-8 min-h-8 shrink-0 text-success hover:text-success disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Unblock customer"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(customer, 'UNBLOCK')
            }}
          >
            <UserCheck className="size-3.5" />
          </button>
        ) : null}
      </div>
    </article>
  )
}

function CustomerPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: AdminCustomersPagination
}) {
  if (!pagination) {
    return null
  }

  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {start}-{end} of {pagination.totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
            value={pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </span>
        <button
          aria-label="Next page"
          className="btn-icon"
          disabled={!pagination.hasNextPage}
          type="button"
          onClick={() =>
            onPageChange(Math.min(pagination.totalPages, pagination.page + 1))
          }
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

function CustomerRowsSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {Array.from({ length: 7 }, (_, index) => (
        <Skeleton className="h-16 w-full rounded-[0.8rem]" key={index} />
      ))}
    </div>
  )
}

export function CustomersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canCreditWallet = usePermission('customers:wallet_credit')
  const canUpdateCustomer = usePermission('customers:update')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [status, setStatus] = useState<'' | AdminCustomerStatus>('')
  const [city, setCity] = useState('')
  const [hasOrders, setHasOrders] = useState('')
  const [hasActiveOrders, setHasActiveOrders] = useState(false)
  const [hasWalletCredit, setHasWalletCredit] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<CustomerColumnId[]>(
    defaultCustomerColumns,
  )
  const [columnWidths, setColumnWidths] = useState<CustomerColumnWidths>(
    loadCustomerColumnWidths,
  )
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOMER_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is a convenience; the table still works without it.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && columnsMenuRef.current?.contains(target)) {
        return
      }

      setColumnsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColumnsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnsOpen])

  const startColumnResize = (
    columnId: CustomerColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getCustomerColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getCustomerColumnMinWidth(columnId),
          Math.round(nextWidth),
        ),
      }))
    }

    const stopResize = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', stopResize)
      document.removeEventListener('pointercancel', stopResize)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', stopResize)
    document.addEventListener('pointercancel', stopResize)
  }

  const resetColumnWidth = (columnId: CustomerColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getCustomerColumnDefaultWidth(columnId),
    }))
  }

  const adjustColumnWidth = (columnId: CustomerColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getCustomerColumnMinWidth(columnId),
        getCustomerColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<AdminCustomersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      hasOrders: hasOrders === '' ? undefined : hasOrders === 'true',
      hasActiveOrders: hasActiveOrders || undefined,
      hasWalletCredit:
        featureFlags.customerWallet && hasWalletCredit !== ''
          ? hasWalletCredit === 'true'
          : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      city,
      dateFrom,
      dateTo,
      hasActiveOrders,
      hasOrders,
      hasWalletCredit,
      limit,
      page,
      search,
      status,
    ],
  )

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customerService.getCustomerList(query),
  })
  const queueCountBaseQuery = useMemo<AdminCustomersQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [city, dateFrom, dateTo, search],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['customers', 'queue-counts', queueCountBaseQuery],
    queryFn: async (): Promise<CustomerQueueCounts> => {
      const summaryResponse = await customerService.getCustomerList(
        queueCountBaseQuery,
      )
      const queueSummary = summaryResponse.summary.queueSummary

      return {
        all:
          queueSummary?.allCustomers ?? summaryResponse.pagination.totalItems,
        active: queueSummary?.active ?? summaryResponse.summary.active,
        blocked: queueSummary?.blocked ?? summaryResponse.summary.blocked,
        incomplete: queueSummary?.incomplete ?? 0,
        activeOrders:
          queueSummary?.activeOrders ??
          summaryResponse.summary.withActiveOrders,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const customers = customersQuery.data?.data ?? []
  const pagination = customersQuery.data?.pagination
  const previewCustomer =
    customers.find((customer) => customer.customerId === previewCustomerId) ??
    null
  const customerSelection = useListSelection(
    customers,
    (customer) => customer.customerId,
  )
  const isInitialLoading = customersQuery.isLoading && !customersQuery.data
  const isRefreshing = customersQuery.isFetching && Boolean(customersQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(customersQuery.dataUpdatedAt)

  const queueItems = buildQueueItems({
    counts: queueCountsQuery.data,
  })

  const customerGridStyle = useMemo<CustomerGridStyle>(
    () => ({
      '--customer-grid-template': getCustomerGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--customer-grid-min-width': getCustomerGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )
  const hasWalletFilter = featureFlags.customerWallet && Boolean(hasWalletCredit)

  const hasActiveFilters = Boolean(
    search ||
      status ||
      city ||
      hasOrders ||
      hasActiveOrders ||
      hasWalletFilter ||
      dateFrom ||
      dateTo,
  )

  const hasAdvancedFilters = Boolean(
    city || hasWalletFilter || dateFrom || dateTo,
  )
  const showFilters = filtersOpen || hasAdvancedFilters

  const clearSeededCustomerParams = () => {
    if (!searchParams.has('search')) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('search')
    setSearchParams(nextParams, { replace: true })
  }

  const resetFilters = () => {
    clearSeededCustomerParams()
    setSearch('')
    setStatus('')
    setCity('')
    setHasOrders('')
    setHasActiveOrders(false)
    setHasWalletCredit('')
    setDateFrom('')
    setDateTo('')
    setFiltersOpen(false)
    setPage(1)
  }

  const toggleColumn = (columnId: CustomerColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const applyQueue = (queue: QueueKey) => {
    if (queue === 'all') {
      setStatus('')
      setHasOrders('')
      setHasActiveOrders(false)
      setHasWalletCredit('')
    }

    if (queue === 'active') {
      setStatus('ACTIVE')
      setHasOrders('')
      setHasActiveOrders(false)
      setHasWalletCredit('')
    }

    if (queue === 'blocked') {
      setStatus('BLOCKED')
      setHasOrders('')
      setHasActiveOrders(false)
      setHasWalletCredit('')
    }

    if (queue === 'incomplete') {
      setStatus('INCOMPLETE')
      setHasOrders('')
      setHasActiveOrders(false)
      setHasWalletCredit('')
    }

    if (queue === 'activeOrders') {
      setStatus('')
      setHasOrders('')
      setHasActiveOrders(true)
      setHasWalletCredit('')
    }

    setPage(1)
  }

  const isQueueActive = (queue: QueueKey) => {
    if (queue === 'all') {
      return !status && !hasOrders && !hasActiveOrders && !hasWalletFilter
    }
    if (queue === 'active') {
      return (
        status === 'ACTIVE' &&
        !hasOrders &&
        !hasActiveOrders &&
        !hasWalletFilter
      )
    }
    if (queue === 'blocked') {
      return (
        status === 'BLOCKED' &&
        !hasOrders &&
        !hasActiveOrders &&
        !hasWalletFilter
      )
    }
    if (queue === 'incomplete') {
      return (
        status === 'INCOMPLETE' &&
        !hasOrders &&
        !hasActiveOrders &&
        !hasWalletFilter
      )
    }

    return hasActiveOrders && !status && !hasOrders && !hasWalletFilter
  }

  const activeQueue = queueItems
    .filter((queue) => queue.key !== 'all')
    .find((queue) => isQueueActive(queue.key))
  const activeFilterChips: ActiveFilterChip[] = []

  if (search.trim()) {
    activeFilterChips.push({
      key: 'search',
      label: `Search: ${search.trim()}`,
      onClear: () => {
        clearSeededCustomerParams()
        setSearch('')
        setPage(1)
      },
    })
  }

  if (activeQueue) {
    activeFilterChips.push({
      key: `queue-${activeQueue.key}`,
      label: `Queue: ${activeQueue.label}`,
      onClear: () => {
        setStatus('')
        setHasOrders('')
        setHasActiveOrders(false)
        setHasWalletCredit('')
        setPage(1)
      },
    })
  } else if (status) {
    activeFilterChips.push({
      key: 'status',
      label: `Status: ${status}`,
      onClear: () => {
        setStatus('')
        setPage(1)
      },
    })
  }

  if (city.trim()) {
    activeFilterChips.push({
      key: 'city',
      label: `City: ${city.trim()}`,
      onClear: () => {
        setCity('')
        setPage(1)
      },
    })
  }

  if (hasOrders && !activeQueue) {
    activeFilterChips.push({
      key: 'hasOrders',
      label: `Has orders: ${hasOrders === 'true' ? 'Yes' : 'No'}`,
      onClear: () => {
        setHasOrders('')
        setPage(1)
      },
    })
  }

  if (hasWalletFilter) {
    activeFilterChips.push({
      key: 'wallet',
      label: `Wallet credit: ${hasWalletCredit === 'true' ? 'Yes' : 'No'}`,
      onClear: () => {
        setHasWalletCredit('')
        setPage(1)
      },
    })
  }

  if (dateFrom || dateTo) {
    activeFilterChips.push({
      key: 'created',
      label: `Created: ${dateFrom || 'Any'} - ${dateTo || 'Any'}`,
      onClear: () => {
        setDateFrom('')
        setDateTo('')
        setPage(1)
      },
    })
  }

  const openAction = (customer: AdminCustomerListItem, kind: CustomerActionKind) => {
    if (
      !canRunCustomerAction({
        action: kind,
        canCreditWallet,
        canUpdateCustomer,
      })
    ) {
      return
    }

    setActionError(null)
    setActionTarget({ action: { kind }, customer })
  }

  const viewDetails = (customer: AdminCustomerListItem) => {
    navigate(`${routePaths.customers}/${customer.customerId}`)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: ActionTarget
      values: CustomerActionFormValues
    }) => {
      const { customer, action } = target

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return customerService.addCustomerNote(customer.customerId, {
          note: values.note,
        })
      }

      if (action.kind === 'BLOCK') {
        if (!values.reason) throw new Error('Block reason is required.')

        return customerService.blockCustomer(customer.customerId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'UNBLOCK') {
        if (!values.reason) throw new Error('Unblock reason is required.')

        return customerService.unblockCustomer(customer.customerId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'WALLET_CREDIT') {
        if (!featureFlags.customerWallet) {
          throw new Error('Wallet credit is currently disabled.')
        }

        if (!values.reason) throw new Error('Wallet credit reason is required.')
        if (!values.amountPaise) throw new Error('Wallet credit amount is required.')

        return customerService.creditCustomerWallet(customer.customerId, {
          amountPaise: values.amountPaise,
          currency: values.currency,
          reason: values.reason,
          referenceId: values.referenceId,
        })
      }

      throw new Error('Unsupported customer action.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['customers'] })
      void queryClient.invalidateQueries({
        queryKey: ['customer-detail', variables.target.customer.customerId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Customer action failed.',
      )
    },
  })

  const submitAction = (values: CustomerActionFormValues) => {
    if (!actionTarget) return

    void actionMutation.mutateAsync({
      target: actionTarget,
      values,
    })
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Customers"
      />

      <main className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(11rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Customers</h2>
              <span
                className={cn(
                  'rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium',
                  isRefreshing ? 'text-primary' : 'text-muted',
                )}
              >
                {refreshStatusLabel}
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search customers..."
              value={search}
              onChange={(nextSearch) => {
                clearSeededCustomerParams()
                setSearch(nextSearch)
                resetToFirstPage()
              }}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                aria-expanded={showFilters}
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter className="mr-2 size-4" />
                Filters
                {activeFilterChips.length ? (
                  <span className="ml-1 size-2 rounded-full bg-primary" />
                ) : null}
              </Button>
              <div className="relative" ref={columnsMenuRef}>
                <Button
                  aria-expanded={columnsOpen}
                  aria-haspopup="menu"
                  className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setColumnsOpen((current) => !current)}
                >
                  <SlidersHorizontal className="mr-2 size-4" />
                  Columns
                  {visibleColumns.length ? (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                      {visibleColumns.length}
                    </span>
                  ) : null}
                </Button>

                {columnsOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                    role="menu"
                  >
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                      Visible columns
                    </p>
                    {customerDataColumns.map((column) => {
                      const isChecked = visibleColumns.includes(column.id)
                      const isRequiredLastColumn =
                        isChecked && visibleColumns.length === 1

                      return (
                        <label
                          className={cn(
                            'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                            isRequiredLastColumn && 'cursor-not-allowed opacity-60',
                          )}
                          key={column.id}
                        >
                          <input
                            checked={isChecked}
                            className="size-4 accent-[color:var(--adaptive-primary)]"
                            disabled={isRequiredLastColumn}
                            type="checkbox"
                            onChange={() => toggleColumn(column.id)}
                          />
                          <span>{column.label}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <Button
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void customersQuery.refetch()}
              >
                <RefreshCcw
                  className={cn(
                    'mr-2 size-4',
                    isRefreshing && 'animate-spin motion-reduce:animate-none',
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            {queueItems.map((queue) => {
              const isActive = isQueueActive(queue.key)

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queue.key}
                  type="button"
                  onClick={() => applyQueue(queue.key)}
                >
                  <span>{queue.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface text-muted',
                    )}
                  >
                    {queue.count ?? '...'}
                  </span>
                </button>
              )
            })}
          </div>

          <ActiveFilterChips
            chips={activeFilterChips}
            onClearAll={resetFilters}
          />

          {showFilters ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,0.8fr)_minmax(12rem,1fr)_minmax(9rem,0.8fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_auto] lg:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Status
                  </span>
                  <select
                    className={CUSTOMER_FILTER_CONTROL_CLASS_NAME}
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value as '' | AdminCustomerStatus)
                      setHasActiveOrders(false)
                      resetToFirstPage()
                    }}
                  >
                    <option value="">All</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="BLOCKED">BLOCKED</option>
                    <option value="INCOMPLETE">INCOMPLETE</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">City</span>
                  <Input
                    className={CUSTOMER_FILTER_CONTROL_CLASS_NAME}
                    placeholder="Bengaluru"
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Has orders
                  </span>
                  <select
                    className={CUSTOMER_FILTER_CONTROL_CLASS_NAME}
                    value={hasOrders}
                    onChange={(event) => {
                      setHasOrders(event.target.value)
                      setHasActiveOrders(false)
                      resetToFirstPage()
                    }}
                  >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Created from
                  </span>
                  <Input
                    className={CUSTOMER_FILTER_CONTROL_CLASS_NAME}
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Created to
                  </span>
                  <Input
                    className={CUSTOMER_FILTER_CONTROL_CLASS_NAME}
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>

                <Button
                  className="w-full lg:w-auto"
                  disabled={!hasActiveFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </div>

            {customersQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="Retry the customer list."
                  title="Customer data unavailable"
                  onRetry={() => void customersQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <CustomerRowsSkeleton />
              </div>
            ) : customers.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
                  description={
                    hasActiveFilters
                      ? 'No matches.'
                      : 'Directory is empty.'
                  }
                  title="No customers"
                  onAction={hasActiveFilters ? resetFilters : undefined}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'grid xl:min-h-0 xl:flex-1',
                  previewCustomer &&
                    'xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-3 xl:p-3',
                )}
              >
                <div className="flex min-w-0 flex-col xl:min-h-0">
                  <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                    <div
                      className="min-w-0 xl:min-w-[var(--customer-grid-min-width)]"
                      style={customerGridStyle}
                    >
                      <div className="sticky top-0 z-30 hidden gap-2 grid-cols-[var(--customer-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                        <div className="flex min-w-0 items-center">
                          <ListSelectionCheckbox
                            checked={customerSelection.allVisibleSelected}
                            indeterminate={customerSelection.someVisibleSelected}
                            label="Select visible customers"
                            onChange={customerSelection.setVisibleSelected}
                          />
                        </div>
                        {customerDataColumns
                          .filter((column) => visibleColumns.includes(column.id))
                          .map((column) => (
                            <div
                              className="relative flex min-w-0 items-center pr-3"
                              key={column.id}
                            >
                              <span className="truncate">{column.label}</span>
                              <button
                                aria-label={`Resize ${column.label} column`}
                                className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Drag to resize"
                                type="button"
                                onDoubleClick={(event) => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  resetColumnWidth(column.id)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'ArrowLeft') {
                                    event.preventDefault()
                                    adjustColumnWidth(column.id, -16)
                                  }

                                  if (event.key === 'ArrowRight') {
                                    event.preventDefault()
                                    adjustColumnWidth(column.id, 16)
                                  }
                                }}
                                onPointerDown={(event) =>
                                  startColumnResize(column.id, event)
                                }
                              >
                                <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                              </button>
                            </div>
                          ))}
                        <div className="workbench-sticky-action-head relative flex min-w-0 pr-3">
                          <span className="truncate">Actions</span>
                          <button
                            aria-label="Resize actions column"
                            className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Drag to resize"
                            type="button"
                            onDoubleClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              resetColumnWidth(CUSTOMER_ACTION_COLUMN_ID)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowLeft') {
                                event.preventDefault()
                                adjustColumnWidth(CUSTOMER_ACTION_COLUMN_ID, -16)
                              }

                              if (event.key === 'ArrowRight') {
                                event.preventDefault()
                                adjustColumnWidth(CUSTOMER_ACTION_COLUMN_ID, 16)
                              }
                            }}
                            onPointerDown={(event) =>
                              startColumnResize(CUSTOMER_ACTION_COLUMN_ID, event)
                            }
                          >
                            <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                          </button>
                        </div>
                      </div>
                      <ListSelectionToolbar
                        allVisibleSelected={customerSelection.allVisibleSelected}
                        selectedCount={customerSelection.selectedCount}
                        visibleCount={customerSelection.visibleCount}
                        onClear={customerSelection.clearSelection}
                        onSelectVisible={() =>
                          customerSelection.setVisibleSelected(true)
                        }
                      />

                      <div>
                        {customers.map((customer) => (
                          <CustomerRow
                            canCreditWallet={canCreditWallet}
                            canUpdateCustomer={canUpdateCustomer}
                            customer={customer}
                            isPreviewed={
                              previewCustomerId === customer.customerId
                            }
                            isSelected={customerSelection.isSelected(
                              customer.customerId,
                            )}
                            isSubmitting={actionMutation.isPending}
                            key={customer.customerId}
                            visibleColumns={visibleColumns}
                            onOpenAction={openAction}
                            onPreview={(previewCustomer) =>
                              setPreviewCustomerId(previewCustomer.customerId)
                            }
                            onSelect={(selectedCustomer, selected) =>
                              customerSelection.setItemSelected(
                                selectedCustomer.customerId,
                                selected,
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <CustomerPagination
                    pagination={pagination}
                    onPageChange={setPage}
                    onPageSizeChange={(nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    }}
                  />
                </div>

                {previewCustomer ? (
                  <CustomerPreviewPanel
                    canCreditWallet={canCreditWallet}
                    canUpdateCustomer={canUpdateCustomer}
                    customer={previewCustomer}
                    isSubmitting={actionMutation.isPending}
                    onClose={() => setPreviewCustomerId(null)}
                    onOpenAction={openAction}
                    onOpenDetails={viewDetails}
                  />
                ) : null}
              </div>
            )}
      </main>

      {actionTarget ? (
        <CustomerActionModal
          action={actionTarget.action}
          customer={actionTarget.customer}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionTarget(null)
              setActionError(null)
            }
          }}
          onSubmit={submitAction}
        />
      ) : null}
    </PageContainer>
  )
}

function buildQueueItems({
  counts,
}: {
  counts?: CustomerQueueCounts
}) {
  return [
    {
      key: 'all' as const,
      label: 'All customers',
      count: counts?.all,
    },
    {
      key: 'active' as const,
      label: 'Active',
      count: counts?.active,
    },
    {
      key: 'blocked' as const,
      label: 'Blocked',
      count: counts?.blocked,
    },
    {
      key: 'incomplete' as const,
      label: 'Incomplete',
      count: counts?.incomplete,
    },
    {
      key: 'activeOrders' as const,
      label: 'Active orders',
      count: counts?.activeOrders,
    },
    // Wallet credit queue can be restored here if the filter is needed again.
  ]
}

interface CustomerQueueCounts {
  all: number
  active: number
  blocked: number
  incomplete: number
  activeOrders: number
}
