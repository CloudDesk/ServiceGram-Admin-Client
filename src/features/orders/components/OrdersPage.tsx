import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  MessageSquarePlus,
  Package,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
} from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
import type { LookupOption } from '../../../types/lookup.types'
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
  AdminOrderStatus,
  AdminOrderSummary,
} from '../types/order.types'

const DEFAULT_PAGE_SIZE = 10
const ORDER_DEFAULT_COLUMN_WIDTH = 220
const ORDER_GRID_COLUMN_GAP = 12
const ORDER_GRID_INLINE_PADDING = 24
const ORDER_ACTION_COLUMN_ID = 'actions'
const ORDER_ACTION_COLUMN_DEFAULT_WIDTH = 196
const ORDER_ACTION_COLUMN_MIN_WIDTH = 168
const ORDER_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.order.columnWidths.v1'

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

function toneClasses(tone: OrderTone) {
  if (tone === 'success') return 'border-border bg-surface text-success'
  if (tone === 'warning') return 'border-border bg-surface text-warning'
  if (tone === 'danger') return 'border-border bg-surface text-danger'
  if (tone === 'info') return 'border-border bg-surface text-primary'
  return 'border-border bg-surface text-muted'
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
    .includes(action)
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

  if (action === 'ADD_NOTE') return { kind: 'ADD_NOTE' }
  if (action === 'CANCEL' && hasOrderAction(order, 'CANCEL')) return { kind: 'CANCEL' }
  if (
    action === 'INITIATE_REFUND' &&
    hasOrderAction(order, 'INITIATE_REFUND')
  ) {
    return { kind: 'INITIATE_REFUND' }
  }

  if (
    action === 'GENERATE_DELIVERY_OTP' &&
    hasOrderAction(order, 'GENERATE_DELIVERY_OTP')
  ) {
    return { kind: 'GENERATE_DELIVERY_OTP' }
  }

  if (
    action === 'CONFIRM_DELIVERY_OTP' &&
    hasOrderAction(order, 'CONFIRM_DELIVERY_OTP')
  ) {
    return { kind: 'CONFIRM_DELIVERY_OTP' }
  }

  const targetStatus = statusFromRecommendedAction(action)

  if (targetStatus && hasOrderAction(order, 'UPDATE_STATUS')) {
    return { kind: 'UPDATE_STATUS', targetStatus }
  }

  return null
}

function primaryActionLabel(order: AdminOrderSummary) {
  const recommended = mapRecommendedAction(order)

  if (recommended?.kind === 'UPDATE_STATUS') {
    return `Mark ${humanizeCode(recommended.targetStatus)}`
  }

  if (recommended) return humanizeCode(recommended.kind)
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

function MetricCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: OrderTone
  value: string
}) {
  return (
    <button
      className={cn(
        'min-h-[4.35rem] rounded-[0.75rem] border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-surface',
        toneClasses(tone),
      )}
      type="button"
    >
      <span className="text-xs font-semibold uppercase tracking-normal opacity-80">
        {label}
      </span>
      <span className="mt-1 block text-lg font-semibold tracking-normal">
        {value}
      </span>
      <span className="mt-0.5 block text-xs leading-4 opacity-80">{meta}</span>
    </button>
  )
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

function OrderRow({
  isSelected,
  isSubmitting,
  onOpenAction,
  onSelect,
  onViewDetails,
  order,
  visibleColumns,
}: {
  isSelected: boolean
  isSubmitting: boolean
  onOpenAction: (order: AdminOrderSummary, selection: OrderActionSelection) => void
  onSelect: (order: AdminOrderSummary, selected: boolean) => void
  onViewDetails: (order: AdminOrderSummary) => void
  order: AdminOrderSummary
  visibleColumns: OrderColumnId[]
}) {
  const recommendedAction = mapRecommendedAction(order)
  const showColumn = (columnId: OrderColumnId) => visibleColumns.includes(columnId)
  const value = orderDisplayValue(order)
  const showAddNoteAction = recommendedAction?.kind !== 'ADD_NOTE'
  const showCancelAction =
    hasOrderAction(order, 'CANCEL') && recommendedAction?.kind !== 'CANCEL'
  const showRefundAction =
    hasOrderAction(order, 'INITIATE_REFUND') &&
    recommendedAction?.kind !== 'INITIATE_REFUND'
  const showDeliveryOtpAction =
    hasOrderAction(order, 'GENERATE_DELIVERY_OTP') &&
    recommendedAction?.kind !== 'GENERATE_DELIVERY_OTP'
  const showConfirmDeliveryOtpAction =
    hasOrderAction(order, 'CONFIRM_DELIVERY_OTP') &&
    recommendedAction?.kind !== 'CONFIRM_DELIVERY_OTP'

  return (
    <article
      aria-label={`Open details for ${order.publicOrderId}`}
      aria-selected={isSelected}
      className={cn(
        'grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2.5 transition last:border-b-0 hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--order-grid-template)] xl:items-center',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(order)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onViewDetails(order)
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
              'flex size-10 shrink-0 items-center justify-center rounded-full border bg-surface text-sm font-semibold',
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
            <p className="mt-1 text-xs text-muted">
              Created {formatDateSafe(order.createdAt)}
            </p>
            <p className="truncate text-xs text-muted">
              {order.category?.name ?? 'No category'}
            </p>
          </div>
        </div>
      ) : null}

      {showColumn('customer') ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{order.customer.fullName}</p>
          <p className="text-xs text-muted">
            {order.customer.mobileNumber ?? 'No mobile'}
          </p>
          <p className="truncate text-xs text-muted">
            {order.customer.city ?? 'No city'}
          </p>
        </div>
      ) : null}

      {showColumn('vendor') ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{order.vendor.shopName}</p>
          <p className="text-xs text-muted">{order.vendor.publicVendorId}</p>
          <p className="truncate text-xs text-muted">
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
          <p className="text-xs text-muted">Order status</p>
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

      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        {recommendedAction ? (
          <Button
            disabled={isSubmitting}
            size="sm"
            type="button"
            variant={recommendedAction.kind === 'CANCEL' ? 'danger' : 'primary'}
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, recommendedAction)
            }}
          >
            {recommendedAction.kind === 'ADD_NOTE' ? (
              <MessageSquarePlus className="mr-2 size-4" />
            ) : (
              <ArrowUpRight className="mr-2 size-4" />
            )}
            {primaryActionLabel(order)}
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
        {showCancelAction ? (
          <button
            aria-label={`Cancel ${order.publicOrderId}`}
            className="btn-icon text-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Cancel order"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, { kind: 'CANCEL' })
            }}
          >
            <Ban className="size-4" />
          </button>
        ) : null}
        {showRefundAction ? (
          <button
            aria-label={`Initiate refund for ${order.publicOrderId}`}
            className="btn-icon text-warning hover:text-warning disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Initiate refund"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, { kind: 'INITIATE_REFUND' })
            }}
          >
            <RotateCcw className="size-4" />
          </button>
        ) : null}
        {showDeliveryOtpAction ? (
          <button
            aria-label={`Generate delivery OTP for ${order.publicOrderId}`}
            className="btn-icon text-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Generate delivery OTP"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, { kind: 'GENERATE_DELIVERY_OTP' })
            }}
          >
            <ShieldCheck className="size-4" />
          </button>
        ) : null}
        {showConfirmDeliveryOtpAction ? (
          <button
            aria-label={`Confirm delivery OTP for ${order.publicOrderId}`}
            className="btn-icon text-success hover:text-success disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Confirm delivery OTP"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(order, { kind: 'CONFIRM_DELIVERY_OTP' })
            }}
          >
            <ShieldCheck className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  )
}

function buildMetrics(
  orders: AdminOrderSummary[],
  pagination?: AdminOrdersPagination,
) {
  const attention = orders.filter(orderNeedsAttention).length
  const inProgress = orders.filter((order) =>
    [
      'PICKUP_SCHEDULED',
      'PICKED_UP_FROM_CUSTOMER',
      'HANDED_OVER_TO_VENDOR',
      'ITEM_RECEIVED_BY_VENDOR',
      'SERVICE_IN_PROGRESS',
      'SERVICE_COMPLETED',
      'COLLECTED_FROM_VENDOR',
      'OUT_FOR_DELIVERY',
    ].includes(order.orderStatus),
  ).length
  const paymentReview = orders.filter((order) =>
    ['PENDING', 'FAILED', 'COD_PENDING'].includes(order.paymentStatus),
  ).length

  return [
    {
      label: 'Needs review',
      value: String(attention),
      meta: 'Warnings, status, or payment work',
      tone: attention ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'In progress',
      value: String(inProgress),
      meta: 'Operational handoff stages',
      tone: 'info' as const,
    },
    {
      label: 'Payment review',
      value: String(paymentReview),
      meta: 'Pending, failed, or COD work',
      tone: paymentReview ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Visible orders',
      value: String(pagination?.totalItems ?? orders.length),
      meta: 'Matching current filters',
      tone: 'info' as const,
    },
  ]
}

function buildQueueItems(orders: AdminOrderSummary[]) {
  return [
    {
      key: 'all' as const,
      label: 'All orders',
      count: orders.length,
    },
    {
      key: 'attention' as const,
      label: 'Price review',
      count: orders.filter(
        (order) => order.orderStatus === 'PRICE_REVISION_PENDING_CUSTOMER',
      ).length,
    },
    {
      key: 'acceptance' as const,
      label: 'Vendor acceptance',
      count: orders.filter(
        (order) => order.orderStatus === 'VENDOR_ACCEPTANCE_PENDING',
      ).length,
    },
    {
      key: 'inProgress' as const,
      label: 'In progress',
      count: orders.filter((order) => order.orderStatus === 'SERVICE_IN_PROGRESS')
        .length,
    },
    {
      key: 'delivery' as const,
      label: 'Delivery',
      count: orders.filter((order) => order.orderStatus === 'OUT_FOR_DELIVERY')
        .length,
    },
    {
      key: 'payment' as const,
      label: 'Payment review',
      count: orders.filter((order) =>
        ['PENDING', 'FAILED', 'COD_PENDING'].includes(order.paymentStatus),
      ).length,
    },
    {
      key: 'completed' as const,
      label: 'Completed',
      count: orders.filter((order) => order.orderStatus === 'DELIVERED').length,
    },
    {
      key: 'cancelled' as const,
      label: 'Cancelled',
      count: orders.filter((order) => order.orderStatus === 'CANCELLED').length,
    },
  ]
}

export function OrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<LookupOption[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedOrderStatuses, setSelectedOrderStatuses] = useState<
    AdminOrderStatus[]
  >([])
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<
    AdminOrderPaymentMethod[]
  >([])
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<
    AdminOrderPaymentStatus[]
  >([])
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>([])
  const [queue, setQueue] = useState<OrderQueueKey>('all')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<OrderActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
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

  const orders = ordersQuery.data?.data ?? []
  const pagination = ordersQuery.data?.pagination
  const orderSelection = useListSelection(orders, (order) => order.orderId)
  const isInitialLoading = ordersQuery.isLoading && !ordersQuery.data
  const isRefreshing = ordersQuery.isFetching && Boolean(ordersQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(ordersQuery.dataUpdatedAt)

  const metrics = buildMetrics(orders, pagination)
  const queueItems = buildQueueItems(orders)
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
    setQueue(nextQueue)
    setSelectedOrderStatuses([])
    setSelectedPaymentStatuses([])

    if (nextQueue === 'acceptance') {
      setSelectedOrderStatuses(['VENDOR_ACCEPTANCE_PENDING'])
    }

    if (nextQueue === 'inProgress') {
      setSelectedOrderStatuses(['SERVICE_IN_PROGRESS'])
    }

    if (nextQueue === 'delivery') {
      setSelectedOrderStatuses(['OUT_FOR_DELIVERY'])
    }

    if (nextQueue === 'payment') {
      setSelectedPaymentStatuses(['PENDING', 'FAILED', 'COD_PENDING'])
    }

    if (nextQueue === 'completed') {
      setSelectedOrderStatuses(['DELIVERED'])
    }

    if (nextQueue === 'cancelled') {
      setSelectedOrderStatuses(['CANCELLED'])
    }

    if (nextQueue === 'attention') {
      setSelectedOrderStatuses(['PRICE_REVISION_PENDING_CUSTOMER'])
    }

    setPage(1)
  }

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

  const openAction = (
    order: AdminOrderSummary,
    selection: OrderActionSelection,
  ) => {
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

      throw new Error('Unsupported order action from list view.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
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
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Live orders moving through customer, vendor, payment, and delivery operations."
        placement="topbar"
        title="Orders"
      />

      <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
        <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              meta={metric.meta}
              tone={metric.tone}
              value={metric.value}
            />
          ))}
        </section>

        <section
          className={cn(
            'grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-stretch xl:overflow-hidden',
            filtersCollapsed && 'xl:grid-cols-[4.25rem_minmax(0,1fr)]',
          )}
        >
          <aside
            className={cn(
              'self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0',
              filtersCollapsed
                ? 'flex items-center justify-between gap-3 p-2.5 xl:flex-col xl:justify-start'
                : 'space-y-3 p-3 xl:overflow-y-auto',
            )}
          >
            {filtersCollapsed ? (
              <>
                <button
                  aria-label="Expand order filters"
                  className="btn-icon"
                  title="Expand filters"
                  type="button"
                  onClick={() => setFiltersCollapsed(false)}
                >
                  <ChevronRight className="size-4" />
                </button>
                <span className="text-xs font-semibold uppercase tracking-normal text-muted xl:[writing-mode:vertical-rl] xl:rotate-180">
                  Filters
                </span>
                {hasActiveFilters ? (
                  <span
                    aria-label="Active filters"
                    className="size-2 rounded-full bg-primary"
                    title="Active filters"
                  />
                ) : null}
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Review queues
                    </h2>
                    <button
                      aria-label="Collapse order filters"
                      className="btn-icon"
                      title="Collapse filters"
                      type="button"
                      onClick={() => setFiltersCollapsed(true)}
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {queueItems.map((queueItem) => (
                      <button
                        className={cn(
                          'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border px-3 text-left text-sm transition',
                          isQueueActive(queueItem.key)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                        )}
                        key={queueItem.key}
                        type="button"
                        onClick={() => applyQueue(queueItem.key)}
                      >
                        <span className="font-medium">{queueItem.label}</span>
                        <span className="text-xs font-semibold">
                          {queueItem.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Filter stack
                    </h3>
                    {hasActiveFilters ? (
                      <button
                        className="text-xs font-semibold text-primary"
                        type="button"
                        onClick={clearOrderFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <MultiSelectFilter
                      label="Order status"
                      options={orderStatusOptions}
                      placeholder="All statuses"
                      values={selectedOrderStatuses}
                      onChange={(values) => {
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
                      <span className="text-xs font-semibold text-muted">
                        City
                      </span>
                      <Input
                        className="min-h-10"
                        placeholder="Chennai"
                        value={city}
                        onChange={(event) => {
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
                        setSelectedCustomers(options)
                        resetToFirstPage()
                      }}
                    />
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Date from
                      </span>
                      <Input
                        className="min-h-10"
                        type="datetime-local"
                        value={dateFrom}
                        onChange={(event) => {
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
                        className="min-h-10"
                        type="datetime-local"
                        value={dateTo}
                        onChange={(event) => {
                          setDateTo(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                  </div>
                </div>
              </>
            )}
          </aside>

          <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Order operations
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} orders matching current filters`
                    : 'Search, filter, and manage orders from backend data.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search order, customer, vendor"
                  value={search}
                  onChange={(nextSearch) => {
                    setSearch(nextSearch)
                    resetToFirstPage()
                  }}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
                <div className="relative" ref={columnsMenuRef}>
                  <Button
                    aria-expanded={columnsOpen}
                    aria-haspopup="menu"
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
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
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

            {ordersQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load order data. Please retry."
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
                  description="No orders matched the current filters."
                  title="No orders found"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--order-grid-min-width)]"
                    style={orderGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--order-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
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
                      <div className="relative flex min-w-0 items-center justify-end pr-3 text-right">
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
                          isSelected={orderSelection.isSelected(order.orderId)}
                          isSubmitting={actionMutation.isPending}
                          key={order.orderId}
                          order={order}
                          visibleColumns={visibleColumns}
                          onOpenAction={openAction}
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
            )}
          </main>
        </section>
      </div>

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
