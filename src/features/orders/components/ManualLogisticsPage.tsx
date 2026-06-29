import {
  ArrowUpRight,
  Ban,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileUp,
  MessageSquarePlus,
  PackageCheck,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import {
  ListFilterBar,
  type ActiveFilterChip,
} from '../../../components/layout/ListFilterBar'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  DynamicTable,
  type DynamicTableColumn,
  type DynamicTableRowAction,
} from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { orderService } from '../services/order.service'
import {
  OrderActionModal,
  type OrderActionFormValues,
  type OrderActionSelection,
} from './OrderActionModal'
import type {
  AdminOrdersQueryParams,
  AdminOrdersSummary,
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminOrderSummary,
} from '../types/order.types'

const DEFAULT_PAGE_SIZE = 10

const logisticsStatusGroups = {
  all: [
    'VENDOR_ACCEPTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP_FROM_CUSTOMER',
    'HANDED_OVER_TO_VENDOR',
    'ITEM_RECEIVED_BY_VENDOR',
    'SERVICE_IN_PROGRESS',
    'SERVICE_COMPLETED',
    'COLLECTED_FROM_VENDOR',
    'OUT_FOR_DELIVERY',
    'DELIVERY_FAILED',
    'CUSTOMER_UNAVAILABLE',
    'ITEM_DAMAGED',
    'ITEM_LOST',
    'WRONG_ITEM',
  ],
  pickup: [
    'VENDOR_ACCEPTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP_FROM_CUSTOMER',
    'HANDED_OVER_TO_VENDOR',
  ],
  vendorWork: [
    'ITEM_RECEIVED_BY_VENDOR',
    'SERVICE_IN_PROGRESS',
    'SERVICE_COMPLETED',
  ],
  returnDelivery: ['COLLECTED_FROM_VENDOR', 'OUT_FOR_DELIVERY'],
  issues: [
    'DELIVERY_FAILED',
    'CUSTOMER_UNAVAILABLE',
    'ITEM_DAMAGED',
    'ITEM_LOST',
    'WRONG_ITEM',
  ],
} satisfies Record<string, AdminOrderStatus[]>

type LogisticsQueueKey = keyof typeof logisticsStatusGroups

interface LogisticsActionTarget {
  action: OrderActionSelection
  order: AdminOrderSummary
}

const queueOptions: {
  key: LogisticsQueueKey
  label: string
  meta: string
  tone: StatusTone
}[] = [
  {
    key: 'all',
    label: 'All logistics',
    meta: 'Active manual lifecycle',
    tone: 'info',
  },
  {
    key: 'pickup',
    label: 'Pickup',
    meta: 'Customer to vendor',
    tone: 'warning',
  },
  {
    key: 'vendorWork',
    label: 'Vendor work',
    meta: 'In service flow',
    tone: 'info',
  },
  {
    key: 'returnDelivery',
    label: 'Return delivery',
    meta: 'Vendor to customer',
    tone: 'success',
  },
  {
    key: 'issues',
    label: 'Issues',
    meta: 'Failed or damaged',
    tone: 'danger',
  },
]

const manualStatuses: AdminOrderStatus[] = [...logisticsStatusGroups.all]

const paymentStatuses: AdminOrderPaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'COD_PENDING',
]

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split(/[:_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
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

function isLogisticsQueueKey(value: string | null): value is LogisticsQueueKey {
  return Boolean(value && value in logisticsStatusGroups)
}

function queueLabel(queue: LogisticsQueueKey) {
  return queueOptions.find((option) => option.key === queue)?.label ?? queue
}

function buildPathWithParams(
  path: string,
  params: Record<string, string | number | null | undefined>,
) {
  const nextParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      nextParams.set(key, String(value))
    }
  })

  const queryString = nextParams.toString()

  return queryString ? `${path}?${queryString}` : path
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'

  try {
    return formatDate(value, true)
  } catch {
    return 'Not available'
  }
}

function formatPaise(value: number | null | undefined, currency = 'INR') {
  if (value == null) return 'Not available'
  return formatMoney(value / 100, currency)
}

function statusTone(status: AdminOrderStatus): StatusTone {
  if (status === 'DELIVERED' || status === 'SERVICE_COMPLETED') return 'success'

  if (
    [
      'CANCELLED',
      'DELIVERY_FAILED',
      'CUSTOMER_UNAVAILABLE',
      'ITEM_DAMAGED',
      'ITEM_LOST',
      'WRONG_ITEM',
      'VENDOR_DECLINED',
    ].includes(status)
  ) {
    return 'danger'
  }

  if (
    [
      'VENDOR_ACCEPTANCE_PENDING',
      'PRICE_REVISION_PENDING_CUSTOMER',
      'PICKUP_SCHEDULED',
      'OUT_FOR_DELIVERY',
    ].includes(status)
  ) {
    return 'warning'
  }

  return 'info'
}

function paymentTone(status: string): StatusTone {
  if (status === 'PAID' || status === 'REFUNDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PARTIALLY_REFUNDED') return 'info'
  return 'warning'
}

function hasOrderAction(order: AdminOrderSummary, action: string) {
  return order.availableActions.includes(action)
}

function hasActiveDeliveryOtp(order: AdminOrderSummary) {
  return (order.counts?.activeOtpCount ?? 0) > 0
}

function actionTargetStatus(action: string) {
  return action.replace(/^MARK_/, '') as AdminOrderStatus
}

function isKnownStatus(value: string): value is AdminOrderStatus {
  return manualStatuses.includes(value as AdminOrderStatus) || value === 'DELIVERED'
}

function mapRecommendedAction(order: AdminOrderSummary): OrderActionSelection | null {
  const recommended = order.nextRecommendedAction
  const markActions = order.availableActions.filter((action) =>
    action.startsWith('MARK_'),
  )
  const preferredMarkAction =
    recommended?.startsWith('MARK_') && markActions.includes(recommended)
      ? recommended
      : markActions[0]

  if (recommended === 'GENERATE_DELIVERY_OTP' && hasOrderAction(order, recommended)) {
    return { kind: 'GENERATE_DELIVERY_OTP' }
  }

  if (
    recommended === 'CONFIRM_DELIVERY_OTP' &&
    hasOrderAction(order, recommended) &&
    hasActiveDeliveryOtp(order)
  ) {
    return { kind: 'CONFIRM_DELIVERY_OTP' }
  }

  if (recommended === 'INITIATE_REFUND' && hasOrderAction(order, recommended)) {
    return { kind: 'INITIATE_REFUND' }
  }

  if (recommended === 'CANCEL' && hasOrderAction(order, recommended)) {
    return { kind: 'CANCEL' }
  }

  if (recommended === 'ADD_NOTE' && hasOrderAction(order, recommended)) {
    return { kind: 'ADD_NOTE' }
  }

  if (recommended === 'CREATE_PROOF_UPLOAD_INTENT' && hasOrderAction(order, recommended)) {
    return { kind: 'CREATE_PROOF_UPLOAD_INTENT' }
  }

  if (preferredMarkAction) {
    const targetStatus = actionTargetStatus(preferredMarkAction)

    if (isKnownStatus(targetStatus)) {
      return { kind: 'UPDATE_STATUS', targetStatus }
    }
  }

  return null
}

function actionLabel(action: OrderActionSelection | null) {
  if (!action) return 'Open logistics'
  if (action.kind === 'UPDATE_STATUS') return `Mark ${humanizeCode(action.targetStatus)}`
  return humanizeCode(action.kind)
}

function canRunAction(
  action: OrderActionSelection,
  canRefundPayments: boolean,
  canUpdateOrders: boolean,
) {
  if (action.kind === 'INITIATE_REFUND') return canRefundPayments
  return canUpdateOrders
}

function countStatuses(
  summary: AdminOrdersSummary | undefined,
  statuses: AdminOrderStatus[],
) {
  if (!summary) return null

  return statuses.reduce(
    (total, status) => total + (summary.byOrderStatus[status] ?? 0),
    0,
  )
}

function orderValue(order: AdminOrderSummary) {
  const amountPaise =
    order.pricing.finalPricePaise ??
    order.pricing.payableAmountPaise ??
    order.pricing.priceEstimatePaise

  return {
    label: order.pricing.finalPricePaise ? 'Final value' : 'Estimate',
    value: formatPaise(amountPaise, order.pricing.currency),
  }
}

function SummarySkeleton() {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton className="h-24 rounded-[0.875rem]" key={index} />
      ))}
    </section>
  )
}

function toneClass(tone: StatusTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function MetricCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: StatusTone
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
        {label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SummaryRail({ summary }: { summary?: AdminOrdersSummary }) {
  if (!summary) return <SummarySkeleton />

  const issueCount = countStatuses(summary, logisticsStatusGroups.issues) ?? 0
  const movementCount =
    countStatuses(summary, [
      ...logisticsStatusGroups.pickup,
      ...logisticsStatusGroups.vendorWork,
      ...logisticsStatusGroups.returnDelivery,
    ]) ?? 0

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <MetricCard
        label="Logistics"
        meta="Active manual statuses"
        tone="info"
        value={String(summary.total)}
      />
      <MetricCard
        label="Needs attention"
        meta="Backend warning count"
        tone={summary.needsAttention ? 'warning' : 'success'}
        value={String(summary.needsAttention)}
      />
      <MetricCard
        label="In movement"
        meta="Pickup, service, return"
        tone="info"
        value={String(movementCount)}
      />
      <MetricCard
        label="Issues"
        meta="Failed, damaged, lost"
        tone={issueCount ? 'danger' : 'success'}
        value={String(issueCount)}
      />
      <MetricCard
        label="Value"
        meta={summary.currency}
        tone="neutral"
        value={formatPaise(summary.totalValuePaise, summary.currency)}
      />
    </section>
  )
}

function QueueRail({
  activeQueue,
  onSelectQueue,
  summary,
}: {
  activeQueue: LogisticsQueueKey
  onSelectQueue: (queue: LogisticsQueueKey) => void
  summary?: AdminOrdersSummary
}) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {queueOptions.map((queue) => {
        const count =
          queue.key === 'all'
            ? summary?.total
            : countStatuses(summary, logisticsStatusGroups[queue.key])

        return (
          <button
            className={cn(
              'min-h-[4.35rem] rounded-[0.75rem] border border-border bg-surface p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-surface',
              activeQueue === queue.key && 'border-primary/40 bg-primary/5',
            )}
            key={queue.key}
            type="button"
            onClick={() => onSelectQueue(queue.key)}
          >
            <span className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(queue.tone))}>
              {queue.label}
            </span>
            <span className="mt-1 block text-lg font-semibold tracking-normal text-foreground">
              {count == null ? '...' : count}
            </span>
            <span className="mt-0.5 block text-xs leading-4 text-muted">
              {queue.meta}
            </span>
          </button>
        )
      })}
    </section>
  )
}

function buildColumns(): DynamicTableColumn<AdminOrderSummary>[] {
  return [
    {
      key: 'order',
      label: 'Order',
      minWidth: 230,
      renderCell: (order) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">{order.publicOrderId}</p>
            <Badge tone={statusTone(order.orderStatus)}>
              {humanizeCode(order.orderStatus)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            Created {formatDateSafe(order.createdAt)}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {order.category?.name ?? 'No category'}
          </p>
        </div>
      ),
    },
    {
      key: 'parties',
      label: 'Customer / Vendor',
      minWidth: 250,
      renderCell: (order) => (
        <div className="space-y-2">
          <div className="flex min-w-0 items-start gap-2">
            <UserRound className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {order.customer.fullName}
              </p>
              <p className="text-xs text-muted">
                {order.customer.mobileNumber ?? order.customer.city ?? 'No customer contact'}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2">
            <Store className="mt-0.5 size-4 shrink-0 text-muted" />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {order.vendor.shopName}
              </p>
              <p className="text-xs text-muted">
                {order.vendor.zone?.zoneName ?? order.vendor.city}
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'movement',
      label: 'Movement',
      minWidth: 220,
      renderCell: (order) => (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Truck className="size-4 text-muted" />
            <span>{order.vendor.city || order.customer.city || 'No city'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={paymentTone(order.paymentStatus)}>
              {humanizeCode(order.paymentStatus)}
            </Badge>
            {order.counts?.activeOtpCount ? (
              <Badge tone="warning">
                {order.counts.activeOtpCount} active OTP
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted">
            {order.counts?.logisticsEventCount ?? 0} logistics events
          </p>
        </div>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      minWidth: 210,
      renderCell: (order) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <CalendarClock className="size-4 text-muted" />
            <span>{formatDateSafe(order.schedule.pickupDate)}</span>
          </div>
          <p className="pl-6 text-xs text-muted">
            {order.schedule.pickupSlotStart} - {order.schedule.pickupSlotEnd}
          </p>
          <p className="pl-6 text-xs text-muted">
            Due {formatDateSafe(order.schedule.expectedDeliveryAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'signals',
      label: 'Signals',
      minWidth: 240,
      renderCell: (order) => {
        const recommended = mapRecommendedAction(order)

        return (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {actionLabel(recommended)}
            </p>
            <div className="flex flex-wrap gap-2">
              {order.warnings.length ? (
                order.warnings.slice(0, 2).map((warning) => (
                  <Badge key={warning} tone="warning">
                    {humanizeCode(warning)}
                  </Badge>
                ))
              ) : (
                <Badge tone="success">No warnings</Badge>
              )}
              {order.warnings.length > 2 ? (
                <Badge tone="warning">+{order.warnings.length - 2}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted">
              {order.availableActions.length} available actions
            </p>
          </div>
        )
      },
    },
    {
      key: 'value',
      label: 'Value',
      minWidth: 170,
      renderCell: (order) => {
        const value = orderValue(order)

        return (
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{value.value}</p>
            <p className="text-xs text-muted">{value.label}</p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <CreditCard className="size-3.5" />
              <span>{order.paymentMethod}</span>
            </div>
          </div>
        )
      },
    },
  ]
}

export function ManualLogisticsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canReadPayments = usePermission('payments:read')
  const canRefundPayments = usePermission('payments:refund')
  const canUpdateOrders = usePermission('orders:update_status')
  const seededOrderStatuses = readEnumSearchValues(
    searchParams,
    'orderStatus',
    manualStatuses,
  )
  const seededPaymentStatuses = readEnumSearchValues(
    searchParams,
    'paymentStatus',
    paymentStatuses,
  )
  const queueParam = searchParams.get('queue')
  const seededQueue = isLogisticsQueueKey(queueParam) ? queueParam : 'all'
  const [actionError, setActionError] = useState<string | null>(null)
  const [activeQueue, setActiveQueue] =
    useState<LogisticsQueueKey>(seededQueue)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [customerId, setCustomerId] = useState(
    () => searchParams.get('customerId') ?? '',
  )
  const [dateFrom, setDateFrom] = useState(
    () => searchParams.get('dateFrom') ?? '',
  )
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [vendorId, setVendorId] = useState(
    () => searchParams.get('vendorId') ?? '',
  )
  const [orderStatus, setOrderStatus] = useState<'' | AdminOrderStatus>(
    () => seededOrderStatuses[0] ?? '',
  )
  const [paymentStatus, setPaymentStatus] = useState<
    '' | AdminOrderPaymentStatus
  >(() => seededPaymentStatuses[0] ?? '')
  const [selectedAction, setSelectedAction] =
    useState<LogisticsActionTarget | null>(null)

  const clearSeededLogisticsParams = () => {
    const seededKeys = [
      'city',
      'customerId',
      'dateFrom',
      'dateTo',
      'orderStatus',
      'paymentStatus',
      'queue',
      'search',
      'vendorId',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const baseFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      customerId: customerId.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      paymentStatus: paymentStatus || undefined,
      vendorId: vendorId.trim() || undefined,
    }),
    [city, customerId, dateFrom, dateTo, paymentStatus, search, vendorId],
  )

  const query = useMemo<AdminOrdersQueryParams>(
    () => ({
      ...baseFilters,
      page,
      limit,
      orderStatus: orderStatus || logisticsStatusGroups[activeQueue],
    }),
    [activeQueue, baseFilters, limit, orderStatus, page],
  )

  const summaryQuery = useMemo<AdminOrdersQueryParams>(
    () => ({
      ...baseFilters,
      page: 1,
      limit: 1,
      orderStatus: logisticsStatusGroups.all,
    }),
    [baseFilters],
  )

  const ordersQuery = useQuery({
    queryKey: ['manual-logistics', query],
    queryFn: () => orderService.getOrderList(query),
  })

  const summaryResultQuery = useQuery({
    queryKey: ['manual-logistics-summary', summaryQuery],
    queryFn: () => orderService.getOrderList(summaryQuery),
  })

  const orders = ordersQuery.data?.data ?? []
  const pagination = ordersQuery.data?.pagination
  const summary = summaryResultQuery.data?.summary
  const columns = useMemo(() => buildColumns(), [])
  const isLoading = ordersQuery.isLoading || ordersQuery.isFetching

  const refreshAll = async () => {
    await Promise.all([
      ordersQuery.refetch(),
      summaryResultQuery.refetch(),
    ])
  }

  const resetToFirstPage = () => setPage(1)
  const clearLogisticsFilters = () => {
    clearSeededLogisticsParams()
    setActiveQueue('all')
    setSearch('')
    setCity('')
    setCustomerId('')
    setDateFrom('')
    setDateTo('')
    setVendorId('')
    setOrderStatus('')
    setPaymentStatus('')
    setPage(1)
  }

  const activeFilters: ActiveFilterChip[] = []

  if (activeQueue !== 'all' && !orderStatus) {
    activeFilters.push({
      key: 'queue',
      label: `Queue: ${queueLabel(activeQueue)}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setActiveQueue('all')
        setPage(1)
      },
    })
  }

  if (search.trim()) {
    activeFilters.push({
      key: 'search',
      label: `Search: ${search.trim()}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setSearch('')
        setPage(1)
      },
    })
  }

  if (orderStatus) {
    activeFilters.push({
      key: 'orderStatus',
      label: `Status: ${humanizeCode(orderStatus)}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setOrderStatus('')
        setPage(1)
      },
    })
  }

  if (paymentStatus) {
    activeFilters.push({
      key: 'paymentStatus',
      label: `Payment: ${humanizeCode(paymentStatus)}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setPaymentStatus('')
        setPage(1)
      },
    })
  }

  if (city.trim()) {
    activeFilters.push({
      key: 'city',
      label: `City: ${city.trim()}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setCity('')
        setPage(1)
      },
    })
  }

  if (customerId.trim()) {
    activeFilters.push({
      key: 'customerId',
      label: `Customer: ${customerId.trim()}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setCustomerId('')
        setPage(1)
      },
    })
  }

  if (vendorId.trim()) {
    activeFilters.push({
      key: 'vendorId',
      label: `Vendor: ${vendorId.trim()}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setVendorId('')
        setPage(1)
      },
    })
  }

  if (dateFrom) {
    activeFilters.push({
      key: 'dateFrom',
      label: `From: ${dateFrom}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setDateFrom('')
        setPage(1)
      },
    })
  }

  if (dateTo) {
    activeFilters.push({
      key: 'dateTo',
      label: `To: ${dateTo}`,
      onRemove: () => {
        clearSeededLogisticsParams()
        setDateTo('')
        setPage(1)
      },
    })
  }

  const openLogistics = (order: AdminOrderSummary) => {
    navigate(`${routePaths.orders}/${order.orderId}/logistics`)
  }
  const openAction = (
    order: AdminOrderSummary,
    action: OrderActionSelection | null,
  ) => {
    if (!action) {
      openLogistics(order)
      return
    }

    if (!canRunAction(action, canRefundPayments, canUpdateOrders)) {
      return
    }

    setActionError(null)
    setSelectedAction({ action, order })
  }

  const actionMutation = useMutation({
    mutationFn: async (values: OrderActionFormValues) => {
      if (!selectedAction) {
        throw new Error('Order action is unavailable.')
      }

      const { action, order } = selectedAction

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
        if (!values.reason) {
          throw new Error('Cancellation reason is required.')
        }

        return orderService.cancelOrder(order.orderId, {
          reason: values.reason,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        })
      }

      if (action.kind === 'INITIATE_REFUND') {
        if (!values.reason) {
          throw new Error('Refund reason is required.')
        }

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
        if (!values.otpCode) {
          throw new Error('Delivery OTP is required.')
        }

        return orderService.confirmDeliveryOtp(order.orderId, {
          otpCode: values.otpCode,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) {
          throw new Error('Note is required.')
        }

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
    onSuccess: async () => {
      const orderId = selectedAction?.order.orderId

      setSelectedAction(null)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['manual-logistics'] }),
        queryClient.invalidateQueries({ queryKey: ['manual-logistics-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        orderId
          ? queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] })
          : Promise.resolve(),
      ])
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Order action failed.',
      )
    },
  })

  const rowActions = (order: AdminOrderSummary): DynamicTableRowAction<AdminOrderSummary>[] => {
    const recommended = mapRecommendedAction(order)
    const actions: DynamicTableRowAction<AdminOrderSummary>[] = []

    if (
      recommended &&
      canRunAction(recommended, canRefundPayments, canUpdateOrders)
    ) {
      actions.push({
        key: 'recommended',
        label: actionLabel(recommended),
        icon:
          recommended.kind === 'UPDATE_STATUS' ? (
            <Truck className="size-4" />
          ) : (
            <ArrowUpRight className="size-4" />
          ),
        onClick: () => openAction(order, recommended),
        placement: 'inline',
        variant: recommended.kind === 'CANCEL' ? 'danger' : 'primary',
      })
    }

    actions.push({
      key: 'open-logistics',
      label: 'Open',
      icon: <ArrowUpRight className="size-4" />,
      onClick: () => openLogistics(order),
      placement: 'inline',
      variant: 'secondary',
    })

    if (canReadCustomers) {
      actions.push({
        key: 'customer',
        label: 'Customer',
        icon: <UserRound className="size-4" />,
        onClick: () => navigate(`${routePaths.customers}/${order.customer.customerId}`),
        placement: 'menu',
      })
    }

    if (canReadVendors) {
      actions.push({
        key: 'vendor',
        label: 'Vendor',
        icon: <Store className="size-4" />,
        onClick: () => navigate(`${routePaths.vendors}/${order.vendor.vendorId}`),
        placement: 'menu',
      })
    }

    if (canReadPayments) {
      actions.push({
        key: 'payments',
        label: 'Payments',
        icon: <CreditCard className="size-4" />,
        onClick: () =>
          navigate(buildPathWithParams(routePaths.payments, {
            search: order.publicOrderId,
          })),
        placement: 'menu',
      })
    }

    if (canReadPayments && (order.counts?.refundCount ?? 0) > 0) {
      actions.push({
        key: 'refunds',
        label: `Refunds (${order.counts?.refundCount ?? 0})`,
        icon: <RotateCcw className="size-4" />,
        onClick: () =>
          navigate(buildPathWithParams(routePaths.refunds, {
            search: order.publicOrderId,
          })),
        placement: 'menu',
      })
    }

    if (canUpdateOrders && hasOrderAction(order, 'ADD_NOTE')) {
      actions.push({
        key: 'add-note',
        label: 'Add note',
        icon: <MessageSquarePlus className="size-4" />,
        onClick: () => openAction(order, { kind: 'ADD_NOTE' }),
        placement: 'menu',
      })
    }

    if (canUpdateOrders && hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT')) {
      actions.push({
        key: 'proof-upload',
        label: 'Proof upload',
        icon: <FileUp className="size-4" />,
        onClick: () => openAction(order, { kind: 'CREATE_PROOF_UPLOAD_INTENT' }),
        placement: 'menu',
      })
    }

    if (canUpdateOrders && hasOrderAction(order, 'GENERATE_DELIVERY_OTP')) {
      actions.push({
        key: 'generate-otp',
        label: 'Generate OTP',
        icon: <ShieldCheck className="size-4" />,
        onClick: () => openAction(order, { kind: 'GENERATE_DELIVERY_OTP' }),
        placement: 'menu',
      })
    }

    if (
      canUpdateOrders &&
      hasOrderAction(order, 'CONFIRM_DELIVERY_OTP') &&
      hasActiveDeliveryOtp(order)
    ) {
      actions.push({
        key: 'confirm-otp',
        label: 'Confirm OTP',
        icon: <PackageCheck className="size-4" />,
        onClick: () => openAction(order, { kind: 'CONFIRM_DELIVERY_OTP' }),
        placement: 'menu',
      })
    }

    if (canRefundPayments && hasOrderAction(order, 'INITIATE_REFUND')) {
      actions.push({
        key: 'refund',
        label: 'Initiate refund',
        icon: <RotateCcw className="size-4" />,
        onClick: () => openAction(order, { kind: 'INITIATE_REFUND' }),
        placement: 'menu',
      })
    }

    if (canUpdateOrders && hasOrderAction(order, 'CANCEL')) {
      actions.push({
        key: 'cancel',
        label: 'Cancel order',
        icon: <Ban className="size-4" />,
        onClick: () => openAction(order, { kind: 'CANCEL' }),
        placement: 'menu',
        variant: 'danger',
      })
    }

    return actions
  }

  return (
    <PageContainer>
      <PageContextHeader
        actionNode={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => navigate(routePaths.orders)}
            >
              <ClipboardList className="mr-2 size-4" />
              Orders
            </Button>
            <Button
              isLoading={ordersQuery.isFetching || summaryResultQuery.isFetching}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void refreshAll()}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        }
        description="Track admin-controlled pickup, vendor handoff, return delivery, proof, notes, and delivery OTP workflows."
        placement="topbar"
        title="Manual Logistics"
      />

      <SummaryRail summary={summary} />

      <QueueRail
        activeQueue={activeQueue}
        summary={summary}
        onSelectQueue={(queue) => {
          clearSeededLogisticsParams()
          setActiveQueue(queue)
          setOrderStatus('')
          setPage(1)
        }}
      />

      <div className="list-workspace">
        <ListFilterBar
          activeFilters={activeFilters}
          onClearAll={clearLogisticsFilters}
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    className="pl-9"
                    placeholder="Order, customer, vendor"
                    value={search}
                    onChange={(event) => {
                      clearSeededLogisticsParams()
                      setSearch(event.target.value)
                      resetToFirstPage()
                    }}
                  />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Queue status</span>
                <select
                  className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                  value={orderStatus}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    const nextStatus = event.target.value as '' | AdminOrderStatus
                    setOrderStatus(nextStatus)
                    if (nextStatus) {
                      setActiveQueue('all')
                    }
                    resetToFirstPage()
                  }}
                >
                  <option value="">Use selected queue</option>
                  {manualStatuses.map((status) => (
                    <option key={status} value={status}>
                      {humanizeCode(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">City</span>
                <Input
                  placeholder="Bengaluru"
                  value={city}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    setCity(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </label>
            </>
          }
          secondaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Customer ID</span>
                <Input
                  placeholder="UUID"
                  value={customerId}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    setCustomerId(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Vendor ID</span>
                <Input
                  placeholder="UUID"
                  value={vendorId}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    setVendorId(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Payment status</span>
                <select
                  className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                  value={paymentStatus}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    setPaymentStatus(
                      event.target.value as '' | AdminOrderPaymentStatus,
                    )
                    resetToFirstPage()
                  }}
                >
                  <option value="">All payments</option>
                  {paymentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {humanizeCode(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">From date</span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    setDateFrom(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">To date</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    clearSeededLogisticsParams()
                    setDateTo(event.target.value)
                    resetToFirstPage()
                  }}
                />
              </label>
            </>
          }
        />

        <section className="list-results-panel">
          <DynamicTable
            actionColumnMinWidth={240}
            actionColumnWidth={280}
            bodyMaxHeight={620}
            columns={columns}
            data={orders}
            emptyDescription="No orders matched the selected logistics queue and filters."
            emptyTitle="No logistics orders"
            error={
              ordersQuery.isError
                ? 'We could not load manual logistics orders.'
                : false
            }
            inlineActionLimit={2}
            loading={isLoading}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: setPage,
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : undefined
            }
            rowActions={rowActions}
            title="Manual Logistics Orders"
            getRowId={(order) => order.orderId}
            onRetry={() => void ordersQuery.refetch()}
            onRowClick={openLogistics}
          />
        </section>
      </div>

      {selectedAction ? (
        <OrderActionModal
          action={selectedAction.action}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          order={selectedAction.order}
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionError(null)
              setSelectedAction(null)
            }
          }}
          onSubmit={(values) => actionMutation.mutate(values)}
        />
      ) : null}
    </PageContainer>
  )
}
