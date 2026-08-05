import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Filter,
  FileUp,
  MessageSquarePlus,
  Package,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
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
import { LookupMultiSelect } from '../../../components/ui/LookupMultiSelect'
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { featureFlags } from '../../../config/featureFlags'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { readLookupOptionsFromSearchParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import {
  searchCategoryLookupOptions,
  searchCustomerLookupOptions,
  searchVendorLookupOptions,
} from '../../lookups/adminLookups'
import { orderService } from '../services/order.service'
import {
  OrderActionModal,
  type OrderActionFormValues,
  type OrderActionSelection,
} from './OrderActionModal'
import type {
  AdminOrderPaymentMethod,
  AdminOrderPaymentStatus,
  AdminOrdersPagination,
  AdminOrdersQueryParams,
  AdminOrdersSummary,
  AdminOrderStatus,
  AdminOrderSummary,
} from '../types/order.types'

const DEFAULT_PAGE_SIZE = 10
const ORDER_DEFAULT_COLUMN_WIDTH = 220
const ORDER_GRID_COLUMN_GAP = 12
const ORDER_GRID_INLINE_PADDING = 24
const ORDER_ACTION_COLUMN_ID = 'actions'
const ORDER_ACTION_COLUMN_DEFAULT_WIDTH = 236
const ORDER_ACTION_COLUMN_MIN_WIDTH = 204
const ORDER_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.order.columnWidths.v1'
const ORDER_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

const orderStatuses: AdminOrderStatus[] = [
  'ORDER_PLACED',
  'VENDOR_ACCEPTANCE_PENDING',
  'PRICE_REVISION_PENDING_CUSTOMER',
  'VENDOR_ACCEPTED',
  'VENDOR_DECLINED',
  'PICKUP_SCHEDULED',
  'PICKED_UP_FROM_CUSTOMER',
  'HANDED_OVER_TO_VENDOR',
  'ITEM_RECEIVED_BY_VENDOR',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'COLLECTED_FROM_VENDOR',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'DELIVERY_FAILED',
  'CUSTOMER_UNAVAILABLE',
  'ITEM_DAMAGED',
  'ITEM_LOST',
  'WRONG_ITEM',
]

const paymentStatuses: AdminOrderPaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'COD_PENDING',
]

const paymentMethods: AdminOrderPaymentMethod[] = [
  'PREPAID',
  'COD',
  ...(featureFlags.customerWallet
    ? (['WALLET', 'MIXED'] as AdminOrderPaymentMethod[])
    : []),
]

const orderDataColumns = [
  {
    id: 'order',
    label: 'Order',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 190,
  },
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 180,
  },
  {
    id: 'vendor',
    label: 'Vendor',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 185,
  },
  {
    id: 'route',
    label: 'Route',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 165,
  },
  {
    id: 'orderStatus',
    label: 'Order Status',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 180,
  },
  {
    id: 'payment',
    label: 'Payment',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 165,
  },
  {
    id: 'value',
    label: 'Value',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 140,
  },
  {
    id: 'pickup',
    label: 'Pickup',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 165,
  },
  {
    id: 'counts',
    label: 'Counts',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: ORDER_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
] as const

type OrderTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type OrderColumnId = (typeof orderDataColumns)[number]['id']
type OrderColumnWidthId = OrderColumnId | typeof ORDER_ACTION_COLUMN_ID
type OrderColumnWidths = Partial<Record<OrderColumnWidthId, number>>
type OrderQueueKey =
  | 'all'
  | 'attention'
  | 'acceptance'
  | 'inProgress'
  | 'delivery'
  | 'payment'
  | 'completed'
  | 'cancelled'
type OrderPreviewTab = 'summary' | 'workflow' | 'links'

const orderQueueStatusFilters: Partial<Record<OrderQueueKey, AdminOrderStatus[]>> = {
  attention: ['PRICE_REVISION_PENDING_CUSTOMER'],
  acceptance: ['VENDOR_ACCEPTANCE_PENDING'],
  inProgress: [
    'VENDOR_ACCEPTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP_FROM_CUSTOMER',
    'HANDED_OVER_TO_VENDOR',
    'ITEM_RECEIVED_BY_VENDOR',
    'SERVICE_IN_PROGRESS',
    'SERVICE_COMPLETED',
  ],
  delivery: [
    'COLLECTED_FROM_VENDOR',
    'OUT_FOR_DELIVERY',
    'DELIVERY_FAILED',
    'CUSTOMER_UNAVAILABLE',
  ],
  completed: ['DELIVERED'],
  cancelled: ['CANCELLED'],
}

const orderPaymentReviewStatuses: AdminOrderPaymentStatus[] = [
  'PENDING',
  'FAILED',
  'COD_PENDING',
]

interface ActiveFilterChip {
  key: string
  label: string
  onClear: () => void
}

function readSearchValues(searchParams: URLSearchParams, key: string) {
  return Array.from(
    new Set(
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )
}

function readEnumSearchValues<T extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly T[],
) {
  const allowed = new Set<T>(allowedValues)

  return readSearchValues(searchParams, key).filter((value): value is T =>
    allowed.has(value as T),
  )
}

function hasSameFilterValues<T extends string>(
  currentValues: readonly T[],
  expectedValues: readonly T[],
) {
  if (currentValues.length !== expectedValues.length) return false

  const currentValueSet = new Set(currentValues)

  return expectedValues.every((value) => currentValueSet.has(value))
}

function queueKeyForOrderFilters(
  selectedOrderStatuses: AdminOrderStatus[],
  selectedPaymentStatuses: AdminOrderPaymentStatus[],
): OrderQueueKey {
  if (
    selectedOrderStatuses.length === 0 &&
    hasSameFilterValues(selectedPaymentStatuses, orderPaymentReviewStatuses)
  ) {
    return 'payment'
  }

  if (selectedOrderStatuses.length === 0 || selectedPaymentStatuses.length > 0) {
    return 'all'
  }

  const matchedQueue = (
    Object.entries(orderQueueStatusFilters) as [
      OrderQueueKey,
      AdminOrderStatus[],
    ][]
  ).find(([, statuses]) => hasSameFilterValues(selectedOrderStatuses, statuses))

  return matchedQueue?.[0] ?? 'all'
}

const defaultOrderColumns: OrderColumnId[] = [
  'order',
  'customer',
  'vendor',
  'orderStatus',
  'payment',
  'value',
]

interface OrderGridStyle extends CSSProperties {
  '--order-grid-template': string
  '--order-grid-min-width': string
}

interface OrderActionTarget {
  action: OrderActionSelection
  order: AdminOrderSummary
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review order'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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

function getOrderStatusTone(status: AdminOrderStatus): OrderTone {
  if (status === 'DELIVERED') return 'success'
  if (
    status === 'CANCELLED' ||
    status === 'ITEM_DAMAGED' ||
    status === 'ITEM_LOST' ||
    status === 'WRONG_ITEM'
  ) {
    return 'danger'
  }

  if (
    status === 'PRICE_REVISION_PENDING_CUSTOMER' ||
    status === 'VENDOR_ACCEPTANCE_PENDING' ||
    status === 'DELIVERY_FAILED' ||
    status === 'CUSTOMER_UNAVAILABLE'
  ) {
    return 'warning'
  }

  return 'info'
}

function getPaymentStatusTone(status: AdminOrderPaymentStatus): OrderTone {
  if (status === 'PAID' || status === 'REFUNDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PARTIALLY_REFUNDED') return 'info'
  return 'warning'
}

function orderDisplayValue(order: AdminOrderSummary) {
  const pendingRevision = order.pricing.pendingPriceRevision

  if (pendingRevision) {
    return {
      meta: `Was ${formatMoney(pendingRevision.previousPricePaise / 100)}`,
      value: formatMoney(pendingRevision.revisedPricePaise / 100),
    }
  }

  const amountPaise =
    order.pricing.finalPricePaise ??
    order.pricing.payableAmountPaise ??
    order.pricing.priceEstimatePaise

  return {
    meta: order.pricing.finalPricePaise ? 'Final value' : 'Estimate',
    value: formatMoney(amountPaise / 100),
  }
}

function getOrderInitials(order: AdminOrderSummary) {
  const source = order.customer.fullName || order.publicOrderId

  return source
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function visibleRecommendedAction(order: AdminOrderSummary) {
  const action = order.nextRecommendedAction?.toUpperCase()

  if (!action) return null

  return action
}

function hasOrderAction(order: AdminOrderSummary, action: string) {
  return order.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action.toUpperCase())
}

function hasActiveDeliveryOtp(order: AdminOrderSummary) {
  return (order.counts?.activeOtpCount ?? 0) > 0
}

function canGenerateDeliveryOtp(order: AdminOrderSummary) {
  return hasOrderAction(order, 'GENERATE_DELIVERY_OTP') && !hasActiveDeliveryOtp(order)
}

function canConfirmDeliveryOtp(order: AdminOrderSummary) {
  return order.orderStatus === 'OUT_FOR_DELIVERY' && hasActiveDeliveryOtp(order)
}

function statusFromRecommendedAction(action: string) {
  const normalized = action.toUpperCase()
  const markPrefix = 'MARK_'

  if (normalized.startsWith(markPrefix)) {
    const targetStatus = normalized.slice(markPrefix.length)

    if (orderStatuses.includes(targetStatus as AdminOrderStatus)) {
      return targetStatus as AdminOrderStatus
    }
  }

  return null
}

function mapRecommendedAction(order: AdminOrderSummary): OrderActionSelection | null {
  const action = visibleRecommendedAction(order)

  if (!action) return null

  if (action === 'ADD_NOTE' && hasOrderAction(order, 'ADD_NOTE')) {
    return { kind: 'ADD_NOTE' }
  }

  if (
    action === 'CREATE_PROOF_UPLOAD_INTENT' &&
    hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT')
  ) {
    return { kind: 'CREATE_PROOF_UPLOAD_INTENT' }
  }

  if (action === 'CANCEL' && hasOrderAction(order, 'CANCEL')) return { kind: 'CANCEL' }
  if (
    action === 'INITIATE_REFUND' &&
    hasOrderAction(order, 'INITIATE_REFUND')
  ) {
    return { kind: 'INITIATE_REFUND' }
  }

  if (
    action === 'GENERATE_DELIVERY_OTP' &&
    canGenerateDeliveryOtp(order)
  ) {
    return { kind: 'GENERATE_DELIVERY_OTP' }
  }

  if (
    action === 'CONFIRM_DELIVERY_OTP' &&
    canConfirmDeliveryOtp(order)
  ) {
    return { kind: 'CONFIRM_DELIVERY_OTP' }
  }

  const targetStatus = statusFromRecommendedAction(action)

  if (targetStatus && hasOrderAction(order, `MARK_${targetStatus}`)) {
    return { kind: 'UPDATE_STATUS', targetStatus }
  }

  return null
}

function canRunOrderAction(
  action: OrderActionSelection,
  canRefundPayments: boolean,
  canUpdateOrders: boolean,
) {
  if (action.kind === 'INITIATE_REFUND') return canRefundPayments
  return canUpdateOrders
}

function primaryActionLabel(order: AdminOrderSummary) {
  const recommended = mapRecommendedAction(order)

  if (recommended?.kind === 'UPDATE_STATUS') {
    return `Mark ${humanizeCode(recommended.targetStatus)}`
  }

  if (recommended?.kind === 'CREATE_PROOF_UPLOAD_INTENT') return 'Request proof'
  if (recommended?.kind === 'INITIATE_REFUND') return 'Start refund'
  if (recommended?.kind === 'GENERATE_DELIVERY_OTP') return 'Generate OTP'
  if (recommended?.kind === 'CONFIRM_DELIVERY_OTP') return 'Confirm OTP'
  if (recommended?.kind === 'ADD_NOTE') return 'Add note'
  if (recommended?.kind === 'CANCEL') return 'Cancel order'
  if (order.warnings.length) return 'Review order'

  return 'View details'
}

function orderNeedsAttention(order: AdminOrderSummary) {
  return (
    order.warnings.length > 0 ||
    Boolean(mapRecommendedAction(order)) ||
    order.orderStatus === 'PRICE_REVISION_PENDING_CUSTOMER' ||
    order.orderStatus === 'VENDOR_ACCEPTANCE_PENDING' ||
    order.paymentStatus === 'FAILED' ||
    order.paymentStatus === 'PENDING'
  )
}

function getDefaultOrderColumnWidths() {
  const widths: OrderColumnWidths = {
    [ORDER_ACTION_COLUMN_ID]: ORDER_ACTION_COLUMN_DEFAULT_WIDTH,
  }

  orderDataColumns.forEach((column) => {
    widths[column.id] = column.defaultWidth
  })

  return widths
}

const defaultOrderColumnWidths = getDefaultOrderColumnWidths()

function getOrderColumnMinWidth(columnId: OrderColumnWidthId) {
  if (columnId === ORDER_ACTION_COLUMN_ID) return ORDER_ACTION_COLUMN_MIN_WIDTH
  return orderDataColumns.find((column) => column.id === columnId)?.minWidth ?? 120
}

function getOrderColumnDefaultWidth(columnId: OrderColumnWidthId) {
  return defaultOrderColumnWidths[columnId] ?? getOrderColumnMinWidth(columnId)
}

function getOrderColumnWidth(
  columnWidths: OrderColumnWidths,
  columnId: OrderColumnWidthId,
) {
  return Math.max(
    getOrderColumnMinWidth(columnId),
    columnWidths[columnId] ?? getOrderColumnDefaultWidth(columnId),
  )
}

function normalizeOrderColumnWidths(value: unknown) {
  const widths = { ...defaultOrderColumnWidths }

  if (!value || typeof value !== 'object') return widths

  const record = value as Record<string, unknown>

  orderDataColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  const actionWidth = record[ORDER_ACTION_COLUMN_ID]

  if (typeof actionWidth === 'number' && Number.isFinite(actionWidth)) {
    widths[ORDER_ACTION_COLUMN_ID] = Math.max(
      ORDER_ACTION_COLUMN_MIN_WIDTH,
      Math.round(actionWidth),
    )
  }

  return widths
}

function loadOrderColumnWidths() {
  if (typeof window === 'undefined') return defaultOrderColumnWidths

  try {
    return normalizeOrderColumnWidths(
      JSON.parse(
        window.localStorage.getItem(ORDER_COLUMN_WIDTH_STORAGE_KEY) ?? 'null',
      ),
    )
  } catch {
    return defaultOrderColumnWidths
  }
}

function getOrderGridTemplate(
  visibleColumns: OrderColumnId[],
  columnWidths: OrderColumnWidths,
) {
  const selectedWidths = orderDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getOrderColumnWidth(columnWidths, column.id)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${getOrderColumnWidth(columnWidths, ORDER_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getOrderGridMinWidth(
  visibleColumns: OrderColumnId[],
  columnWidths: OrderColumnWidths,
) {
  const visibleColumnCount = visibleColumns.length
  const gridColumnCount = visibleColumnCount + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * ORDER_GRID_COLUMN_GAP
  const visibleWidth = orderDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getOrderColumnWidth(columnWidths, column.id),
      0,
    )

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    getOrderColumnWidth(columnWidths, ORDER_ACTION_COLUMN_ID) +
    gridGapWidth +
    ORDER_GRID_INLINE_PADDING
  }px`
}

function OrderRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-20 w-full rounded-[1rem]" key={index} />
      ))}
    </div>
  )
}

function OrderPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: AdminOrdersPagination
}) {
  if (!pagination) return null

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

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[]
  onClearAll: () => void
}) {
  if (!chips.length) return null

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

function OrderSummaryField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function OrderPreviewPanel({
  canReadCustomers,
  canReadVendors,
  canRefundPayments,
  canUpdateOrders,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenCustomer,
  onOpenDetails,
  onOpenVendor,
  order,
}: {
  canReadCustomers: boolean
  canReadVendors: boolean
  canRefundPayments: boolean
  canUpdateOrders: boolean
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (order: AdminOrderSummary, selection: OrderActionSelection) => void
  onOpenCustomer: (order: AdminOrderSummary) => void
  onOpenDetails: (order: AdminOrderSummary) => void
  onOpenVendor: (order: AdminOrderSummary) => void
  order: AdminOrderSummary
}) {
  const [activeTab, setActiveTab] = useState<OrderPreviewTab>('summary')
  const recommendedAction = mapRecommendedAction(order)
  const primaryAction =
    recommendedAction &&
    canRunOrderAction(recommendedAction, canRefundPayments, canUpdateOrders)
      ? recommendedAction
      : null
  const value = orderDisplayValue(order)
  const previewTabs: { key: OrderPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'workflow', label: 'Workflow' },
    { key: 'links', label: 'Links' },
  ]
  interface PreviewAction {
    kind: Exclude<OrderActionSelection['kind'], 'UPDATE_STATUS'>
    label: string
    tone: 'secondary' | 'danger'
  }
  const secondaryActions: PreviewAction[] = []

  if (
    canUpdateOrders &&
    hasOrderAction(order, 'ADD_NOTE') &&
    primaryAction?.kind !== 'ADD_NOTE'
  ) {
    secondaryActions.push({
      kind: 'ADD_NOTE',
      label: 'Add note',
      tone: 'secondary',
    })
  }

  if (
    canUpdateOrders &&
    canGenerateDeliveryOtp(order) &&
    primaryAction?.kind !== 'GENERATE_DELIVERY_OTP'
  ) {
    secondaryActions.push({
      kind: 'GENERATE_DELIVERY_OTP',
      label: 'Generate OTP',
      tone: 'secondary',
    })
  }

  if (
    canUpdateOrders &&
    canConfirmDeliveryOtp(order) &&
    primaryAction?.kind !== 'CONFIRM_DELIVERY_OTP'
  ) {
    secondaryActions.push({
      kind: 'CONFIRM_DELIVERY_OTP',
      label: 'Confirm OTP',
      tone: 'secondary',
    })
  }

  if (
    canUpdateOrders &&
    hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT') &&
    primaryAction?.kind !== 'CREATE_PROOF_UPLOAD_INTENT'
  ) {
    secondaryActions.push({
      kind: 'CREATE_PROOF_UPLOAD_INTENT',
      label: 'Request proof',
      tone: 'secondary',
    })
  }

  if (
    canRefundPayments &&
    hasOrderAction(order, 'INITIATE_REFUND') &&
    primaryAction?.kind !== 'INITIATE_REFUND'
  ) {
    secondaryActions.push({
      kind: 'INITIATE_REFUND',
      label: 'Start refund',
      tone: 'secondary',
    })
  }

  if (
    canUpdateOrders &&
    hasOrderAction(order, 'CANCEL') &&
    primaryAction?.kind !== 'CANCEL'
  ) {
    secondaryActions.push({
      kind: 'CANCEL',
      label: 'Cancel order',
      tone: 'danger',
    })
  }

  return (
    <>
      <button
        aria-label="Close order preview"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:sticky xl:inset-auto xl:top-3 xl:z-auto xl:max-h-[calc(100vh-var(--spacing-topbar)-2.5rem)]">
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                  {order.publicOrderId}
                </h2>
                <Badge tone={getOrderStatusTone(order.orderStatus)}>
                  {humanizeCode(order.orderStatus)}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {order.customer.fullName} / {order.vendor.shopName}
              </p>
            </div>
            <button
              aria-label="Close order preview panel"
              className="btn-icon shrink-0"
              title="Close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={getPaymentStatusTone(order.paymentStatus)}>
              {humanizeCode(order.paymentStatus)}
            </Badge>
            <Badge tone="neutral">{order.paymentMethod}</Badge>
            {order.warnings.length ? (
              <Badge tone="warning">
                {order.warnings.length} warning{order.warnings.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-b border-border bg-surface px-3">
          <div
            aria-label="Order preview sections"
            className="flex gap-4 overflow-x-auto"
            role="tablist"
          >
            {previewTabs.map((tab) => {
              const isActive = activeTab === tab.key

              return (
                <button
                  aria-selected={isActive}
                  className={cn(
                    'relative min-h-10 shrink-0 text-sm font-semibold transition',
                    isActive
                      ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                      : 'text-muted hover:text-foreground',
                  )}
                  key={tab.key}
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
                <OrderSummaryField label="Value" value={value.value} />
                <OrderSummaryField label="Pricing" value={value.meta} />
                <OrderSummaryField
                  label="Pickup"
                  value={formatDateSafe(order.schedule.pickupDate)}
                />
                <OrderSummaryField
                  label="Delivery"
                  value={formatDateSafe(order.schedule.expectedDeliveryAt)}
                />
              </div>
              <div className="space-y-2 rounded-[0.75rem] border border-border p-3">
                <OrderSummaryField
                  label="Category"
                  value={order.category?.name ?? 'No category'}
                />
                <OrderSummaryField
                  label="Items"
                  value={`${order.counts?.itemCount ?? 0} item${
                    (order.counts?.itemCount ?? 0) === 1 ? '' : 's'
                  }`}
                />
                <OrderSummaryField
                  label="Updated"
                  value={formatDateSafe(order.updatedAt)}
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'workflow' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Recommended next
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {order.nextRecommendedAction
                    ? humanizeCode(order.nextRecommendedAction)
                    : 'No immediate action'}
                </p>
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Signals
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {order.warnings.length ? (
                    order.warnings.map((warning) => (
                      <Badge key={warning} tone="warning">
                        {humanizeCode(warning)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No warnings</Badge>
                  )}
                </div>
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Counts
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <OrderSummaryField
                    label="Notes"
                    value={order.counts?.noteCount ?? 0}
                  />
                  <OrderSummaryField
                    label="Refunds"
                    value={order.counts?.refundCount ?? 0}
                  />
                  <OrderSummaryField
                    label="Logistics"
                    value={order.counts?.logisticsEventCount ?? 0}
                  />
                  <OrderSummaryField
                    label="Active OTP"
                    value={order.counts?.activeOtpCount ?? 0}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'links' ? (
            <div className="space-y-2">
              <div className="rounded-[0.75rem] border border-border p-3">
                <OrderSummaryField
                  label="Customer"
                  value={order.customer.fullName}
                />
                <p className="mt-1 text-xs text-muted">
                  {order.customer.mobileNumber ?? order.customer.email ?? 'No contact'}
                </p>
                {canReadCustomers ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onOpenCustomer(order)}
                  >
                    <UserRound className="mr-2 size-4" />
                    Open customer
                  </Button>
                ) : null}
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <OrderSummaryField label="Vendor" value={order.vendor.shopName} />
                <p className="mt-1 text-xs text-muted">
                  {order.vendor.publicVendorId} /{' '}
                  {order.vendor.zone?.zoneName ?? order.vendor.city}
                </p>
                {canReadVendors ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onOpenVendor(order)}
                  >
                    <Store className="mr-2 size-4" />
                    Open vendor
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <div className="space-y-2">
            {primaryAction ? (
              <Button
                className="w-full"
                disabled={isSubmitting}
                size="sm"
                type="button"
                variant={primaryAction.kind === 'CANCEL' ? 'danger' : 'primary'}
                onClick={() => onOpenAction(order, primaryAction)}
              >
                <ArrowUpRight className="mr-2 size-4" />
                {primaryActionLabel(order)}
              </Button>
            ) : null}

            {secondaryActions.length ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {secondaryActions.map((action) => (
                  <Button
                    disabled={isSubmitting}
                    key={action.kind}
                    size="sm"
                    type="button"
                    variant={action.tone}
                    onClick={() => onOpenAction(order, { kind: action.kind })}
                  >
                    {action.kind === 'ADD_NOTE' ? (
                      <MessageSquarePlus className="mr-2 size-4" />
                    ) : action.kind === 'INITIATE_REFUND' ? (
                      <RotateCcw className="mr-2 size-4" />
                    ) : action.kind === 'CANCEL' ? (
                      <Ban className="mr-2 size-4" />
                    ) : action.kind === 'CREATE_PROOF_UPLOAD_INTENT' ? (
                      <FileUp className="mr-2 size-4" />
                    ) : (
                      <ShieldCheck className="mr-2 size-4" />
                    )}
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}

            <Button
              className="w-full"
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onOpenDetails(order)}
            >
              <ArrowUpRight className="mr-2 size-4" />
              Open full detail
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

function OrderRow({
  canReadCustomers,
  canReadVendors,
  canRefundPayments,
  canUpdateOrders,
  isPreviewed,
  isSelected,
  isSubmitting,
  onOpenCustomer,
  onOpenAction,
  onPreview,
  onSelect,
  onViewDetails,
  onOpenVendor,
  order,
  visibleColumns,
}: {
  canReadCustomers: boolean
  canReadVendors: boolean
  canRefundPayments: boolean
  canUpdateOrders: boolean
  isPreviewed: boolean
  isSelected: boolean
  isSubmitting: boolean
  onOpenCustomer: (order: AdminOrderSummary) => void
  onOpenAction: (order: AdminOrderSummary, selection: OrderActionSelection) => void
  onPreview: (order: AdminOrderSummary) => void
  onSelect: (order: AdminOrderSummary, selected: boolean) => void
  onViewDetails: (order: AdminOrderSummary) => void
  onOpenVendor: (order: AdminOrderSummary) => void
  order: AdminOrderSummary
  visibleColumns: OrderColumnId[]
}) {
  const recommendedAction = mapRecommendedAction(order)
  const primaryAction =
    recommendedAction &&
    canRunOrderAction(recommendedAction, canRefundPayments, canUpdateOrders)
      ? recommendedAction
      : null
  const showColumn = (columnId: OrderColumnId) => visibleColumns.includes(columnId)
  const value = orderDisplayValue(order)
  const showAddNoteAction =
    canUpdateOrders &&
    hasOrderAction(order, 'ADD_NOTE') &&
    primaryAction?.kind !== 'ADD_NOTE'
  const primaryActionText = primaryAction ? primaryActionLabel(order) : ''

  return (
    <article
      aria-label={`Review ${order.publicOrderId}`}
      aria-selected={isSelected}
      className={cn(
        'grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2 transition last:border-b-0 hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--order-grid-template)] xl:items-center',
        isSelected && 'bg-surface-muted/70',
        isPreviewed && 'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onPreview(order)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onPreview(order)
        }
      }}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${order.publicOrderId}`}
          onChange={(selected) => onSelect(order, selected)}
        />
      </div>
      {showColumn('order') ? (
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full border bg-surface text-xs font-semibold',
              getOrderStatusTone(order.orderStatus) === 'danger'
                ? 'border-danger/25 text-danger'
                : orderNeedsAttention(order)
                  ? 'border-warning/25 text-warning'
                  : 'border-success/25 text-success',
            )}
          >
            {getOrderInitials(order)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {order.publicOrderId}
              </p>
              <Badge tone={getOrderStatusTone(order.orderStatus)}>
                {humanizeCode(order.orderStatus)}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted">
              Created {formatDateSafe(order.createdAt)} /{' '}
              {order.category?.name ?? 'No category'}
            </p>
          </div>
        </div>
      ) : null}

      {showColumn('customer') ? (
        <div className="space-y-1 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium text-foreground">
              {order.customer.fullName}
            </p>
            {canReadCustomers ? (
              <button
                aria-label={`Open customer ${order.customer.fullName}`}
                className="btn-icon size-7"
                title="Open customer"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenCustomer(order)
                }}
              >
                <UserRound className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted">
            {order.customer.mobileNumber ?? 'No mobile'} /{' '}
            {order.customer.city ?? 'No city'}
          </p>
        </div>
      ) : null}

      {showColumn('vendor') ? (
        <div className="space-y-1 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium text-foreground">
              {order.vendor.shopName}
            </p>
            {canReadVendors ? (
              <button
                aria-label={`Open vendor ${order.vendor.shopName}`}
                className="btn-icon size-7"
                title="Open vendor"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenVendor(order)
                }}
              >
                <Store className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted">
            {order.vendor.publicVendorId} /{' '}
            {order.vendor.zone?.zoneName ?? order.vendor.city}
          </p>
        </div>
      ) : null}

      {showColumn('route') ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Truck className="size-4 text-muted" />
            <span>{order.vendor.city || order.customer.city || 'No city'}</span>
          </div>
          <p className="pl-6 text-xs text-muted">
            {order.vendor.zone?.zoneName ?? 'No zone'}
          </p>
        </div>
      ) : null}

      {showColumn('orderStatus') ? (
        <div className="space-y-1 text-sm">
          <Badge tone={getOrderStatusTone(order.orderStatus)}>
            {humanizeCode(order.orderStatus)}
          </Badge>
          <p className="truncate text-xs text-muted">
            {order.warnings.length
              ? `${order.warnings.length} warning${order.warnings.length === 1 ? '' : 's'}`
              : 'No warnings'}
          </p>
        </div>
      ) : null}

      {showColumn('payment') ? (
        <div className="space-y-1 text-sm">
          <Badge tone={getPaymentStatusTone(order.paymentStatus)}>
            {humanizeCode(order.paymentStatus)}
          </Badge>
          <div className="flex items-center gap-2 text-xs text-muted">
            <CreditCard className="size-3.5" />
            <span>{order.paymentMethod}</span>
          </div>
        </div>
      ) : null}

      {showColumn('value') ? (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">{value.value}</p>
          <p className="text-xs text-muted">{value.meta}</p>
        </div>
      ) : null}

      {showColumn('pickup') ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <CalendarClock className="size-4 text-muted" />
            <span>{formatDateSafe(order.schedule.pickupDate)}</span>
          </div>
          <p className="pl-6 text-xs text-muted">
            {order.schedule.pickupSlotStart} - {order.schedule.pickupSlotEnd}
          </p>
        </div>
      ) : null}

      {showColumn('counts') ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <Package className="size-4 text-muted" />
            <span>{order.counts?.itemCount ?? 0} items</span>
          </div>
          <p className="pl-6 text-xs text-muted">
            {order.counts?.noteCount ?? 0} notes / {order.counts?.refundCount ?? 0} refunds
          </p>
        </div>
      ) : null}

      {showColumn('updatedAt') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Updated</p>
          <p className="text-foreground">{formatDateSafe(order.updatedAt)}</p>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 xl:sticky xl:right-0 xl:z-20 xl:justify-end xl:border-l xl:border-border xl:bg-inherit xl:pl-2 xl:shadow-[var(--sg-shadow-sticky-action)]">
        {primaryAction ? (
          <Button
            className="min-w-0 flex-1 overflow-hidden px-2.5"
            disabled={isSubmitting}
            size="sm"
            title={primaryActionText}
            type="button"
            variant={primaryAction.kind === 'CANCEL' ? 'danger' : 'primary'}
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, primaryAction)
            }}
          >
            {primaryAction.kind === 'ADD_NOTE' ? (
              <MessageSquarePlus className="mr-2 size-4 shrink-0" />
            ) : (
              <ArrowUpRight className="mr-2 size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">{primaryActionText}</span>
          </Button>
        ) : null}
        {showAddNoteAction ? (
          <button
            aria-label={`Add note for ${order.publicOrderId}`}
            className="btn-icon disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Add note"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, { kind: 'ADD_NOTE' })
            }}
          >
            <MessageSquarePlus className="size-4" />
          </button>
        ) : null}
        <button
          aria-label={`Open ${order.publicOrderId} details`}
          className="btn-icon"
          title="Open detail"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onViewDetails(order)
          }}
        >
          <Eye className="size-4" />
        </button>
      </div>
    </article>
  )
}

function countOrderStatuses(
  summary: AdminOrdersSummary | undefined,
  statuses: AdminOrderStatus[],
) {
  if (!summary) return 0

  return statuses.reduce(
    (total, status) => total + (summary.byOrderStatus[status] ?? 0),
    0,
  )
}

function buildQueueItems(summary: AdminOrdersSummary | undefined) {
  const queueSummary = summary?.queueSummary

  return [
    {
      key: 'all' as const,
      label: 'All orders',
      count: queueSummary?.allOrders ?? summary?.total ?? 0,
    },
    {
      key: 'attention' as const,
      label: 'Price review',
      count:
        queueSummary?.priceReview ??
        countOrderStatuses(summary, orderQueueStatusFilters.attention ?? []),
    },
    {
      key: 'acceptance' as const,
      label: 'Vendor acceptance',
      count:
        queueSummary?.vendorAcceptance ??
        countOrderStatuses(summary, orderQueueStatusFilters.acceptance ?? []),
    },
    {
      key: 'inProgress' as const,
      label: 'In progress',
      count:
        queueSummary?.inProgress ??
        countOrderStatuses(summary, orderQueueStatusFilters.inProgress ?? []),
    },
    {
      key: 'delivery' as const,
      label: 'Delivery',
      count:
        queueSummary?.delivery ??
        countOrderStatuses(summary, orderQueueStatusFilters.delivery ?? []),
    },
    {
      key: 'payment' as const,
      label: 'Payment review',
      count: queueSummary?.paymentReview ?? summary?.paymentReview ?? 0,
    },
    {
      key: 'completed' as const,
      label: 'Completed',
      count:
        queueSummary?.completed ??
        countOrderStatuses(summary, orderQueueStatusFilters.completed ?? []),
    },
    {
      key: 'cancelled' as const,
      label: 'Cancelled',
      count:
        queueSummary?.cancelled ??
        countOrderStatuses(summary, orderQueueStatusFilters.cancelled ?? []),
    },
  ]
}

export function OrdersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canRefundPayments = usePermission('payments:refund')
  const canUpdateOrders = usePermission('orders:update_status')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const seededOrderStatuses = readEnumSearchValues(
    searchParams,
    'orderStatus',
    orderStatuses,
  )
  const seededPaymentStatuses = readEnumSearchValues(
    searchParams,
    'paymentStatus',
    paymentStatuses,
  )
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'categoryId', 'categoryLabel'),
  )
  const [selectedCustomers, setSelectedCustomers] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'customerId', 'customerLabel'),
  )
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [selectedOrderStatuses, setSelectedOrderStatuses] = useState<
    AdminOrderStatus[]
  >(() => seededOrderStatuses)
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    AdminOrderPaymentMethod[]
  >([])
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<
    AdminOrderPaymentStatus[]
  >(() => seededPaymentStatuses)
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'vendorId', 'vendorLabel'),
  )
  const [queue, setQueue] = useState<OrderQueueKey>(() =>
    queueKeyForOrderFilters(seededOrderStatuses, seededPaymentStatuses),
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<OrderActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewOrderId, setPreviewOrderId] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] =
    useState<OrderColumnId[]>(defaultOrderColumns)
  const [columnWidths, setColumnWidths] =
    useState<OrderColumnWidths>(loadOrderColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ORDER_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is optional; the table still works without storage.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) return

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
    columnId: OrderColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getOrderColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getOrderColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: OrderColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getOrderColumnDefaultWidth(columnId),
    }))
  }

  const adjustColumnWidth = (columnId: OrderColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getOrderColumnMinWidth(columnId),
        getOrderColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetToFirstPage = () => setPage(1)
  const clearSeededOrderParams = () => {
    const seededKeys = [
      'categoryId',
      'categoryLabel',
      'city',
      'customerId',
      'customerLabel',
      'dateFrom',
      'dateTo',
      'orderStatus',
      'paymentStatus',
      'queue',
      'search',
      'vendorId',
      'vendorLabel',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }
  const categoryIds = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  )
  const customerIds = useMemo(
    () => selectedCustomers.map((customer) => customer.value),
    [selectedCustomers],
  )
  const vendorIds = useMemo(
    () => selectedVendors.map((vendor) => vendor.value),
    [selectedVendors],
  )
  const orderStatusOptions = useMemo<LookupOption[]>(
    () =>
      orderStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const paymentStatusOptions = useMemo<LookupOption[]>(
    () =>
      paymentStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const paymentMethodOptions = useMemo<LookupOption[]>(
    () =>
      paymentMethods.map((method) => ({
        label: humanizeCode(method),
        value: method,
      })),
    [],
  )

  const query = useMemo<AdminOrdersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      customerId: customerIds.length > 0 ? customerIds : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      orderStatus:
        selectedOrderStatuses.length > 0 ? selectedOrderStatuses : undefined,
      paymentMethod:
        selectedPaymentMethods.length > 0 ? selectedPaymentMethods : undefined,
      paymentStatus:
        selectedPaymentStatuses.length > 0
          ? selectedPaymentStatuses
          : undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
    }),
    [
      categoryIds,
      city,
      customerIds,
      dateFrom,
      dateTo,
      limit,
      page,
      search,
      selectedOrderStatuses,
      selectedPaymentMethods,
      selectedPaymentStatuses,
      vendorIds,
    ],
  )

  const ordersQuery = useQuery({
    queryKey: ['orders', query],
    queryFn: () => orderService.getOrderList(query),
  })

  const queueSummaryQuery = useMemo<AdminOrdersQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      customerId: customerIds.length > 0 ? customerIds : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      paymentMethod:
        selectedPaymentMethods.length > 0 ? selectedPaymentMethods : undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
    }),
    [
      categoryIds,
      city,
      customerIds,
      dateFrom,
      dateTo,
      search,
      selectedPaymentMethods,
      vendorIds,
    ],
  )

  const queueSummaryResultQuery = useQuery({
    queryKey: ['orders-summary', queueSummaryQuery],
    queryFn: () => orderService.getOrderList(queueSummaryQuery),
    placeholderData: (previousData) => previousData,
  })

  const orders = ordersQuery.data?.data ?? []
  const pagination = ordersQuery.data?.pagination
  const currentSummary = ordersQuery.data?.summary
  const queueSummary =
    queueSummaryResultQuery.data?.summary ?? (queue === 'all' ? currentSummary : undefined)
  const previewOrder =
    orders.find((order) => order.orderId === previewOrderId) ?? null
  const orderSelection = useListSelection(orders, (order) => order.orderId)
  const isInitialLoading = ordersQuery.isLoading && !ordersQuery.data
  const isRefreshing = ordersQuery.isFetching && Boolean(ordersQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(ordersQuery.dataUpdatedAt)

  const queueItems = buildQueueItems(queueSummary)
  const selectedCategoryLabel =
    selectedCategories.length === 1 ? selectedCategories[0]?.label : ''

  const orderGridStyle = useMemo<OrderGridStyle>(
    () => ({
      '--order-grid-template': getOrderGridTemplate(visibleColumns, columnWidths),
      '--order-grid-min-width': getOrderGridMinWidth(visibleColumns, columnWidths),
    }),
    [columnWidths, visibleColumns],
  )

  const hasActiveFilters = Boolean(
    search ||
      city ||
      categoryIds.length > 0 ||
      customerIds.length > 0 ||
      dateFrom ||
      dateTo ||
      selectedOrderStatuses.length > 0 ||
      selectedPaymentMethods.length > 0 ||
      selectedPaymentStatuses.length > 0 ||
      vendorIds.length > 0 ||
      queue !== 'all',
  )

  const clearOrderFilters = () => {
    clearSeededOrderParams()
    setQueue('all')
    setSearch('')
    setCity('')
    setSelectedCategories([])
    setSelectedCustomers([])
    setDateFrom('')
    setDateTo('')
    setSelectedOrderStatuses([])
    setSelectedPaymentMethods([])
    setSelectedPaymentStatuses([])
    setSelectedVendors([])
    setPage(1)
  }

  const applyQueue = (nextQueue: OrderQueueKey) => {
    clearSeededOrderParams()
    setQueue(nextQueue)
    setSelectedOrderStatuses(orderQueueStatusFilters[nextQueue] ?? [])
    setSelectedPaymentStatuses([])

    if (nextQueue === 'payment') {
      setSelectedPaymentStatuses(orderPaymentReviewStatuses)
    }

    setPage(1)
  }

  const activeFilterChips: ActiveFilterChip[] = []
  const addActiveFilterChip = (
    condition: boolean,
    key: string,
    label: string,
    onClear: () => void,
  ) => {
    if (condition) activeFilterChips.push({ key, label, onClear })
  }
  const queueLabel = queueItems.find((queueItem) => queueItem.key === queue)?.label

  addActiveFilterChip(Boolean(search.trim()), 'search', `Search: ${search.trim()}`, () => {
    clearSeededOrderParams()
    setSearch('')
    resetToFirstPage()
  })
  addActiveFilterChip(queue !== 'all', 'queue', `Queue: ${queueLabel ?? queue}`, () => {
    applyQueue('all')
  })
  addActiveFilterChip(Boolean(city.trim()), 'city', `City: ${city.trim()}`, () => {
    clearSeededOrderParams()
    setCity('')
    resetToFirstPage()
  })
  addActiveFilterChip(
    selectedCategories.length > 0,
    'category',
    `Category: ${selectedCategories[0]?.label ?? selectedCategories[0]?.value}${
      selectedCategories.length > 1 ? ` +${selectedCategories.length - 1}` : ''
    }`,
    () => {
      clearSeededOrderParams()
      setSelectedCategories([])
      setSelectedVendors([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedCustomers.length > 0,
    'customer',
    `Customer: ${selectedCustomers[0]?.label ?? selectedCustomers[0]?.value}${
      selectedCustomers.length > 1 ? ` +${selectedCustomers.length - 1}` : ''
    }`,
    () => {
      clearSeededOrderParams()
      setSelectedCustomers([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedVendors.length > 0,
    'vendor',
    `Vendor: ${selectedVendors[0]?.label ?? selectedVendors[0]?.value}${
      selectedVendors.length > 1 ? ` +${selectedVendors.length - 1}` : ''
    }`,
    () => {
      clearSeededOrderParams()
      setSelectedVendors([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    queue === 'all' && selectedOrderStatuses.length > 0,
    'order-status',
    `Status: ${humanizeCode(selectedOrderStatuses[0] ?? '')}${
      selectedOrderStatuses.length > 1
        ? ` +${selectedOrderStatuses.length - 1}`
        : ''
    }`,
    () => {
      clearSeededOrderParams()
      setSelectedOrderStatuses([])
      setQueue('all')
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    queue === 'all' && selectedPaymentStatuses.length > 0,
    'payment-status',
    `Payment: ${humanizeCode(selectedPaymentStatuses[0] ?? '')}${
      selectedPaymentStatuses.length > 1
        ? ` +${selectedPaymentStatuses.length - 1}`
        : ''
    }`,
    () => {
      clearSeededOrderParams()
      setSelectedPaymentStatuses([])
      setQueue('all')
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedPaymentMethods.length > 0,
    'payment-method',
    `Method: ${humanizeCode(selectedPaymentMethods[0] ?? '')}${
      selectedPaymentMethods.length > 1
        ? ` +${selectedPaymentMethods.length - 1}`
        : ''
    }`,
    () => {
      setSelectedPaymentMethods([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(Boolean(dateFrom), 'date-from', `From: ${dateFrom}`, () => {
    clearSeededOrderParams()
    setDateFrom('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(dateTo), 'date-to', `To: ${dateTo}`, () => {
    clearSeededOrderParams()
    setDateTo('')
    resetToFirstPage()
  })

  const isQueueActive = (queueItem: OrderQueueKey) => queue === queueItem

  const toggleColumn = (columnId: OrderColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const viewDetails = (order: AdminOrderSummary) => {
    navigate(`${routePaths.orders}/${order.orderId}`)
  }

  const viewCustomer = (order: AdminOrderSummary) => {
    if (!canReadCustomers) return

    navigate(`${routePaths.customers}/${order.customer.customerId}`)
  }

  const viewVendor = (order: AdminOrderSummary) => {
    if (!canReadVendors) return

    navigate(`${routePaths.vendors}/${order.vendor.vendorId}`)
  }

  const openAction = (
    order: AdminOrderSummary,
    selection: OrderActionSelection,
  ) => {
    if (!canRunOrderAction(selection, canRefundPayments, canUpdateOrders)) {
      return
    }

    setActionError(null)
    setActionTarget({ action: selection, order })
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: OrderActionTarget
      values: OrderActionFormValues
    }) => {
      const { action, order } = target

      if (action.kind === 'UPDATE_STATUS') {
        if (!action.targetStatus) {
          throw new Error('Target status is required.')
        }

        return orderService.updateOrderStatus(order.orderId, {
          targetStatus: action.targetStatus,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
          issueType: values.issueType,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        })
      }

      if (action.kind === 'CANCEL') {
        if (!values.reason) throw new Error('Cancellation reason is required.')

        return orderService.cancelOrder(order.orderId, {
          reason: values.reason,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        })
      }

      if (action.kind === 'INITIATE_REFUND') {
        if (!values.reason) throw new Error('Refund reason is required.')

        return orderService.initiateOrderRefund(order.orderId, {
          paymentId: values.paymentId,
          amountPaise: values.amountPaise,
          reason: values.reason,
        })
      }

      if (action.kind === 'GENERATE_DELIVERY_OTP') {
        return orderService.generateDeliveryOtp(order.orderId, {
          expiresInMinutes: values.expiresInMinutes,
          notifyCustomer: values.notifyCustomer,
          reason: values.reason,
        })
      }

      if (action.kind === 'CONFIRM_DELIVERY_OTP') {
        if (!values.otpCode) throw new Error('Delivery OTP is required.')

        return orderService.confirmDeliveryOtp(order.orderId, {
          otpCode: values.otpCode,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Note is required.')

        return orderService.addOrderNote(order.orderId, {
          note: values.note,
          isPinned: values.isPinned,
        })
      }

      if (!values.purpose || !values.fileName || !values.mimeType || !values.sizeBytes) {
        throw new Error('Proof upload file details are required.')
      }

      return orderService.createProofUploadIntent(order.orderId, {
        purpose: values.purpose,
        fileName: values.fileName,
        mimeType: values.mimeType,
        sizeBytes: values.sizeBytes,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      void queryClient.invalidateQueries({ queryKey: ['orders-summary'] })
      void queryClient.invalidateQueries({ queryKey: ['manual-logistics'] })
      void queryClient.invalidateQueries({ queryKey: ['manual-logistics-summary'] })
      void queryClient.invalidateQueries({
        queryKey: ['order-detail', variables.target.order.orderId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Order action failed.',
      )
    },
  })

  const submitAction = (values: OrderActionFormValues) => {
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
        title="Orders"
      />

      <main className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(10rem,auto)_minmax(24rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Orders</h2>
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
              placeholder="Search orders, customers, vendors..."
              value={search}
              onChange={(nextSearch) => {
                clearSeededOrderParams()
                setSearch(nextSearch)
                resetToFirstPage()
              }}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                aria-expanded={filtersOpen}
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
                    {orderDataColumns.map((column) => {
                      const isChecked = visibleColumns.includes(column.id)
                      const isRequiredLastColumn =
                        isChecked && visibleColumns.length === 1

                      return (
                        <label
                          className={cn(
                            'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                            isRequiredLastColumn &&
                              'cursor-not-allowed opacity-60',
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
                onClick={() => void ordersQuery.refetch()}
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
            {queueItems.map((queueItem) => {
              const isActive = isQueueActive(queueItem.key)

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queueItem.key}
                  type="button"
                  onClick={() => applyQueue(queueItem.key)}
                >
                  <span>{queueItem.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface text-muted',
                    )}
                  >
                    {queueItem.count}
                  </span>
                </button>
              )
            })}
          </div>

          <ActiveFilterChips
            chips={activeFilterChips}
            onClearAll={clearOrderFilters}
          />

          {filtersOpen ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[repeat(5,minmax(10rem,1fr))_auto] 2xl:items-end">
                <MultiSelectFilter
                  label="Order status"
                  options={orderStatusOptions}
                  placeholder="All statuses"
                  values={selectedOrderStatuses}
                  onChange={(values) => {
                    clearSeededOrderParams()
                    setSelectedOrderStatuses(values as AdminOrderStatus[])
                    setQueue('all')
                    resetToFirstPage()
                  }}
                />
                <MultiSelectFilter
                  label="Payment status"
                  options={paymentStatusOptions}
                  placeholder="All payment statuses"
                  values={selectedPaymentStatuses}
                  onChange={(values) => {
                    clearSeededOrderParams()
                    setSelectedPaymentStatuses(
                      values as AdminOrderPaymentStatus[],
                    )
                    setQueue('all')
                    resetToFirstPage()
                  }}
                />
                <MultiSelectFilter
                  label="Payment method"
                  options={paymentMethodOptions}
                  placeholder="All payment methods"
                  values={selectedPaymentMethods}
                  onChange={(values) => {
                    setSelectedPaymentMethods(
                      values as AdminOrderPaymentMethod[],
                    )
                    resetToFirstPage()
                  }}
                />
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">City</span>
                  <Input
                    className={ORDER_FILTER_CONTROL_CLASS_NAME}
                    placeholder="Chennai"
                    value={city}
                    onChange={(event) => {
                      clearSeededOrderParams()
                      setCity(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>
                <LookupMultiSelect
                  fetchOptions={searchCategoryLookupOptions}
                  label="Category"
                  placeholder="Search category"
                  queryKey={['lookup', 'categories']}
                  selectedOptions={selectedCategories}
                  onChange={(options) => {
                    clearSeededOrderParams()
                    setSelectedCategories(options)
                    setSelectedVendors([])
                    resetToFirstPage()
                  }}
                />
                <LookupMultiSelect
                  fetchOptions={(nextSearch) =>
                    searchVendorLookupOptions(nextSearch, {
                      categoryIds,
                    })
                  }
                  label="Vendor"
                  emptyLabel={
                    categoryIds.length > 0
                      ? 'No vendors found for this category'
                      : 'No vendors found'
                  }
                  placeholder={
                    selectedCategoryLabel
                      ? `Search ${selectedCategoryLabel} vendors`
                      : selectedCategories.length > 1
                        ? 'Search selected categories vendors'
                        : 'Search vendor'
                  }
                  queryKey={[
                    'lookup',
                    'vendors',
                    categoryIds.length > 0 ? categoryIds.join(',') : 'all',
                  ]}
                  selectedOptions={selectedVendors}
                  onChange={(options) => {
                    clearSeededOrderParams()
                    setSelectedVendors(options)
                    resetToFirstPage()
                  }}
                />
                <LookupMultiSelect
                  fetchOptions={searchCustomerLookupOptions}
                  label="Customer"
                  placeholder="Search customer"
                  queryKey={['lookup', 'customers']}
                  selectedOptions={selectedCustomers}
                  onChange={(options) => {
                    clearSeededOrderParams()
                    setSelectedCustomers(options)
                    resetToFirstPage()
                  }}
                />
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Date from
                  </span>
                  <Input
                    className={ORDER_FILTER_CONTROL_CLASS_NAME}
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(event) => {
                      clearSeededOrderParams()
                      setDateFrom(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Date to
                  </span>
                  <Input
                    className={ORDER_FILTER_CONTROL_CLASS_NAME}
                    type="datetime-local"
                    value={dateTo}
                    onChange={(event) => {
                      clearSeededOrderParams()
                      setDateTo(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </label>
                <Button
                  className="w-full 2xl:w-auto"
                  disabled={!hasActiveFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearOrderFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {ordersQuery.isError ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <ErrorState
              description="Retry the order list."
              title="Order data unavailable"
              onRetry={() => void ordersQuery.refetch()}
            />
          </div>
        ) : isInitialLoading ? (
          <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <OrderRowsSkeleton />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
            <EmptyState
              actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
              description={
                hasActiveFilters ? 'No matches.' : 'Queue is empty.'
              }
              title="No orders"
              onAction={hasActiveFilters ? clearOrderFilters : undefined}
            />
          </div>
        ) : (
          <div
            className={cn(
              'grid xl:min-h-0 xl:flex-1',
              previewOrder &&
                'xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-3 xl:p-3',
            )}
          >
            <div className="flex min-w-0 flex-col xl:min-h-0">
              <div className="overflow-x-auto overscroll-contain xl:min-h-0 xl:flex-1 xl:overflow-auto">
                <div
                  className="min-w-0 xl:min-w-[var(--order-grid-min-width)]"
                  style={orderGridStyle}
                >
                  <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--order-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                    <div className="flex min-w-0 items-center">
                      <ListSelectionCheckbox
                        checked={orderSelection.allVisibleSelected}
                        indeterminate={orderSelection.someVisibleSelected}
                        label="Select visible orders"
                        onChange={orderSelection.setVisibleSelected}
                      />
                    </div>
                    {orderDataColumns
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
                    <div className="relative sticky right-0 z-40 flex min-w-0 items-center justify-end bg-surface-muted pr-3 text-right shadow-[var(--sg-shadow-sticky-action)]">
                      <span className="truncate">Actions</span>
                      <button
                        aria-label="Resize actions column"
                        className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Drag to resize"
                        type="button"
                        onDoubleClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          resetColumnWidth(ORDER_ACTION_COLUMN_ID)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowLeft') {
                            event.preventDefault()
                            adjustColumnWidth(ORDER_ACTION_COLUMN_ID, -16)
                          }

                          if (event.key === 'ArrowRight') {
                            event.preventDefault()
                            adjustColumnWidth(ORDER_ACTION_COLUMN_ID, 16)
                          }
                        }}
                        onPointerDown={(event) =>
                          startColumnResize(ORDER_ACTION_COLUMN_ID, event)
                        }
                      >
                        <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                      </button>
                    </div>
                  </div>
                  <ListSelectionToolbar
                    allVisibleSelected={orderSelection.allVisibleSelected}
                    selectedCount={orderSelection.selectedCount}
                    visibleCount={orderSelection.visibleCount}
                    onClear={orderSelection.clearSelection}
                    onSelectVisible={() => orderSelection.setVisibleSelected(true)}
                  />

                  <div>
                    {orders.map((order) => (
                      <OrderRow
                        canReadCustomers={canReadCustomers}
                        canReadVendors={canReadVendors}
                        canRefundPayments={canRefundPayments}
                        canUpdateOrders={canUpdateOrders}
                        isPreviewed={previewOrderId === order.orderId}
                        isSelected={orderSelection.isSelected(order.orderId)}
                        isSubmitting={actionMutation.isPending}
                        key={order.orderId}
                        order={order}
                        visibleColumns={visibleColumns}
                        onOpenAction={openAction}
                        onOpenCustomer={viewCustomer}
                        onOpenVendor={viewVendor}
                        onPreview={(previewedOrder) =>
                          setPreviewOrderId(previewedOrder.orderId)
                        }
                        onSelect={(selectedOrder, selected) =>
                          orderSelection.setItemSelected(
                            selectedOrder.orderId,
                            selected,
                          )
                        }
                        onViewDetails={viewDetails}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <OrderPagination
                pagination={pagination}
                onPageChange={setPage}
                onPageSizeChange={(nextLimit) => {
                  setLimit(nextLimit)
                  setPage(1)
                }}
              />
            </div>

            {previewOrder ? (
              <OrderPreviewPanel
                canReadCustomers={canReadCustomers}
                canReadVendors={canReadVendors}
                canRefundPayments={canRefundPayments}
                canUpdateOrders={canUpdateOrders}
                isSubmitting={actionMutation.isPending}
                order={previewOrder}
                onClose={() => setPreviewOrderId(null)}
                onOpenAction={openAction}
                onOpenCustomer={viewCustomer}
                onOpenDetails={viewDetails}
                onOpenVendor={viewVendor}
              />
            ) : null}
          </div>
        )}
      </main>

      {actionTarget ? (
        <OrderActionModal
          action={actionTarget.action}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          key={`${actionTarget.order.orderId}-${actionTarget.action.kind}-${actionTarget.action.targetStatus ?? 'order'}`}
          order={actionTarget.order}
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
