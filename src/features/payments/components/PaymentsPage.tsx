import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  SlidersHorizontal,
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
import { useAuthStore } from '../../../store/authStore'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import {
  searchCustomerLookupOptions,
  searchOrderLookupOptions,
  searchVendorLookupOptions,
} from '../../lookups/adminLookups'
import { paymentService } from '../services/payment.service'
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from './PaymentActionModal'
import type {
  AdminPaymentGateway,
  AdminFinancePagination,
  AdminPaymentMethod,
  AdminPaymentsQueryParams,
  AdminPaymentStatus,
  AdminPaymentSummary,
} from '../types/payment.types'

const DEFAULT_PAGE_SIZE = 10
const PAYMENT_DEFAULT_COLUMN_WIDTH = 220
const PAYMENT_GRID_COLUMN_GAP = 12
const PAYMENT_GRID_INLINE_PADDING = 24
const PAYMENT_ACTION_COLUMN_ID = 'actions'
const PAYMENT_ACTION_COLUMN_DEFAULT_WIDTH = 188
const PAYMENT_ACTION_COLUMN_MIN_WIDTH = 160
const PAYMENT_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.payment.columnWidths.v1'

const paymentStatuses: AdminPaymentStatus[] = [
  'CREATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
]

const paymentMethods: AdminPaymentMethod[] = [
  'UPI',
  'CARD',
  'NET_BANKING',
  ...(featureFlags.customerWallet ? (['WALLET'] as AdminPaymentMethod[]) : []),
  'COD',
]

const gateways: AdminPaymentGateway[] = [
  'RAZORPAY',
  'INTERNAL_COD',
  ...(featureFlags.customerWallet ? (['WALLET'] as AdminPaymentGateway[]) : []),
]

const paymentDataColumns = [
  {
    id: 'payment',
    label: 'Payment',
    defaultWidth: PAYMENT_DEFAULT_COLUMN_WIDTH,
    minWidth: 190,
  },
  {
    id: 'order',
    label: 'Order',
    defaultWidth: PAYMENT_DEFAULT_COLUMN_WIDTH,
    minWidth: 180,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'method',
    label: 'Method',
    defaultWidth: 180,
    minWidth: 145,
  },
  {
    id: 'parties',
    label: 'Customer / Vendor',
    defaultWidth: 260,
    minWidth: 220,
  },
  {
    id: 'amount',
    label: 'Amount',
    defaultWidth: 170,
    minWidth: 145,
  },
  {
    id: 'refunds',
    label: 'Refunds',
    defaultWidth: 190,
    minWidth: 160,
  },
  {
    id: 'gateway',
    label: 'Gateway',
    defaultWidth: 190,
    minWidth: 150,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: 170,
    minWidth: 150,
  },
] as const

type PaymentTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type PaymentColumnId = (typeof paymentDataColumns)[number]['id']
type PaymentColumnWidthId =
  | PaymentColumnId
  | typeof PAYMENT_ACTION_COLUMN_ID
type PaymentColumnWidths = Partial<Record<PaymentColumnWidthId, number>>
type PaymentQueueKey = 'all' | 'needsReview' | 'successful' | 'failed' | 'cancelled'

const defaultPaymentColumns: PaymentColumnId[] = [
  'payment',
  'order',
  'status',
  'method',
  'parties',
  'amount',
  'refunds',
]

interface PaymentGridStyle extends CSSProperties {
  '--payment-grid-template': string
  '--payment-grid-min-width': string
}

interface PaymentMetric {
  label: string
  meta: string
  tone: PaymentTone
  value: string
}

interface PaymentActionTarget {
  action: PaymentActionSelection
  payment: AdminPaymentSummary
}

function toneClasses(tone: PaymentTone) {
  if (tone === 'success') return 'border-border bg-surface text-success'
  if (tone === 'warning') return 'border-border bg-surface text-warning'
  if (tone === 'danger') return 'border-border bg-surface text-danger'
  if (tone === 'info') return 'border-border bg-surface text-primary'
  return 'border-border bg-surface text-muted'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

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

function formatPaise(value: number | null | undefined) {
  return formatMoney((value ?? 0) / 100)
}

function getPaymentStatusTone(status: AdminPaymentStatus): PaymentTone {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'CREATED' || status === 'PENDING') return 'warning'
  return 'neutral'
}

function buildPaymentMetrics(
  payments: AdminPaymentSummary[],
  pagination?: AdminFinancePagination,
): PaymentMetric[] {
  const total = pagination?.totalItems ?? payments.length
  const successfulAmount = payments
    .filter((payment) => payment.status === 'SUCCESS')
    .reduce((sum, payment) => sum + payment.amountPaise, 0)
  const needsReview = payments.filter(
    (payment) =>
      ['CREATED', 'PENDING', 'FAILED'].includes(payment.status) ||
      payment.warnings.length > 0,
  ).length
  const refundRequests = payments.reduce(
    (sum, payment) => sum + payment.refundSummary.requestedCount,
    0,
  )

  return [
    {
      label: 'Needs review',
      meta: 'Pending, failed, or warning payments',
      tone: needsReview > 0 ? 'warning' : 'neutral',
      value: String(needsReview),
    },
    {
      label: 'Successful value',
      meta: 'Successful amount in current result window',
      tone: 'success',
      value: formatPaise(successfulAmount),
    },
    {
      label: 'Refund requests',
      meta: 'Open refund requests in current result window',
      tone: refundRequests > 0 ? 'danger' : 'neutral',
      value: String(refundRequests),
    },
    {
      label: 'Visible payments',
      meta: 'Matching current filters',
      tone: 'info',
      value: String(total),
    },
  ]
}

function buildPaymentQueueItems(payments: AdminPaymentSummary[]) {
  return [
    {
      key: 'all' as const,
      label: 'All payments',
      count: payments.length,
    },
    {
      key: 'needsReview' as const,
      label: 'Needs review',
      count: payments.filter((payment) =>
        ['CREATED', 'PENDING', 'FAILED'].includes(payment.status),
      ).length,
    },
    {
      key: 'successful' as const,
      label: 'Successful',
      count: payments.filter((payment) => payment.status === 'SUCCESS').length,
    },
    {
      key: 'failed' as const,
      label: 'Failed',
      count: payments.filter((payment) => payment.status === 'FAILED').length,
    },
    {
      key: 'cancelled' as const,
      label: 'Cancelled',
      count: payments.filter((payment) => payment.status === 'CANCELLED').length,
    },
  ]
}

function getPaymentColumnDefaultWidth(columnId: PaymentColumnWidthId) {
  if (columnId === PAYMENT_ACTION_COLUMN_ID) {
    return PAYMENT_ACTION_COLUMN_DEFAULT_WIDTH
  }

  return (
    paymentDataColumns.find((column) => column.id === columnId)?.defaultWidth ??
    PAYMENT_DEFAULT_COLUMN_WIDTH
  )
}

function getPaymentColumnMinWidth(columnId: PaymentColumnWidthId) {
  if (columnId === PAYMENT_ACTION_COLUMN_ID) {
    return PAYMENT_ACTION_COLUMN_MIN_WIDTH
  }

  return (
    paymentDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
  )
}

function getPaymentColumnWidth(
  columnWidths: PaymentColumnWidths,
  columnId: PaymentColumnWidthId,
) {
  return columnWidths[columnId] ?? getPaymentColumnDefaultWidth(columnId)
}

function getPaymentGridTemplate(
  visibleColumns: PaymentColumnId[],
  columnWidths: PaymentColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getPaymentColumnWidth(columnWidths, columnId)}px`,
    ),
    `${getPaymentColumnWidth(columnWidths, PAYMENT_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getPaymentGridMinWidth(
  visibleColumns: PaymentColumnId[],
  columnWidths: PaymentColumnWidths,
) {
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getPaymentColumnWidth(columnWidths, columnId),
    0,
  )
  const actionWidth = getPaymentColumnWidth(
    columnWidths,
    PAYMENT_ACTION_COLUMN_ID,
  )
  const columnCount = visibleColumns.length + 2
  const gapWidth = Math.max(0, columnCount - 1) * PAYMENT_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    actionWidth +
    gapWidth +
    PAYMENT_GRID_INLINE_PADDING
  }px`
}

function loadPaymentColumnWidths(): PaymentColumnWidths {
  try {
    const storedValue = window.localStorage.getItem(
      PAYMENT_COLUMN_WIDTH_STORAGE_KEY,
    )

    if (!storedValue) return {}

    const parsedValue = JSON.parse(storedValue) as PaymentColumnWidths

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, width]) => typeof width === 'number'),
    ) as PaymentColumnWidths
  } catch {
    return {}
  }
}

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return 'Not refreshed yet'

  return `Updated ${formatDate(new Date(updatedAt).toISOString(), true)}`
}

function MetricCard({ label, meta, tone, value }: PaymentMetric) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClasses(tone))}>
        {label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClasses(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function PaymentRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid gap-3 border-b border-border px-3 py-4 xl:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_1.2fr_0.8fr_0.8fr]"
          key={index}
        >
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <Skeleton className="h-9 w-full" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

function PaymentCell({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 min-w-0 text-sm text-foreground">{children}</div>
    </div>
  )
}

export function PaymentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canReconcile = useAuthStore((state) => state.can('payments:reconcile'))
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<AdminPaymentStatus[]>([])
  const [selectedMethods, setSelectedMethods] = useState<AdminPaymentMethod[]>([])
  const [selectedGateways, setSelectedGateways] = useState<AdminPaymentGateway[]>([])
  const [city, setCity] = useState('')
  const [selectedOrders, setSelectedOrders] = useState<LookupOption[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<LookupOption[]>([])
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmountPaise, setMinAmountPaise] = useState('')
  const [maxAmountPaise, setMaxAmountPaise] = useState('')
  const [queue, setQueue] = useState<PaymentQueueKey>('all')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<PaymentActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<PaymentColumnId[]>(defaultPaymentColumns)
  const [columnWidths, setColumnWidths] =
    useState<PaymentColumnWidths>(loadPaymentColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PAYMENT_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Column persistence is optional; the table still works without it.
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

  const statusOptions = useMemo<LookupOption[]>(
    () =>
      paymentStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const methodOptions = useMemo<LookupOption[]>(
    () =>
      paymentMethods.map((method) => ({
        label: humanizeCode(method),
        value: method,
      })),
    [],
  )
  const gatewayOptions = useMemo<LookupOption[]>(
    () =>
      gateways.map((gateway) => ({
        label: humanizeCode(gateway),
        value: gateway,
      })),
    [],
  )
  const orderIds = useMemo(
    () => selectedOrders.map((order) => order.value),
    [selectedOrders],
  )
  const customerIds = useMemo(
    () => selectedCustomers.map((customer) => customer.value),
    [selectedCustomers],
  )
  const vendorIds = useMemo(
    () => selectedVendors.map((vendor) => vendor.value),
    [selectedVendors],
  )

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<AdminPaymentsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      method: selectedMethods.length > 0 ? selectedMethods : undefined,
      gateway: selectedGateways.length > 0 ? selectedGateways : undefined,
      city: city.trim() || undefined,
      orderId: orderIds.length > 0 ? orderIds : undefined,
      customerId: customerIds.length > 0 ? customerIds : undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minAmountPaise: minAmountPaise ? Number(minAmountPaise) : undefined,
      maxAmountPaise: maxAmountPaise ? Number(maxAmountPaise) : undefined,
    }),
    [
      city,
      customerIds,
      dateFrom,
      dateTo,
      limit,
      maxAmountPaise,
      minAmountPaise,
      orderIds,
      page,
      search,
      selectedGateways,
      selectedMethods,
      selectedStatuses,
      vendorIds,
    ],
  )

  const paymentsQuery = useQuery({
    queryKey: ['payments', query],
    queryFn: () => paymentService.getPaymentList(query),
  })

  const payments = paymentsQuery.data?.data ?? []
  const pagination = paymentsQuery.data?.pagination
  const paymentSelection = useListSelection(payments, (payment) => payment.paymentId)
  const isInitialLoading = paymentsQuery.isLoading && !paymentsQuery.data
  const isRefreshing = paymentsQuery.isFetching && Boolean(paymentsQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(paymentsQuery.dataUpdatedAt)

  const metrics = buildPaymentMetrics(payments, pagination)
  const queueItems = buildPaymentQueueItems(payments)
  const paymentGridStyle = useMemo<PaymentGridStyle>(
    () => ({
      '--payment-grid-template': getPaymentGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--payment-grid-min-width': getPaymentGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )

  const hasActiveFilters = Boolean(
    search ||
      selectedStatuses.length > 0 ||
      selectedMethods.length > 0 ||
      selectedGateways.length > 0 ||
      city ||
      orderIds.length > 0 ||
      customerIds.length > 0 ||
      vendorIds.length > 0 ||
      dateFrom ||
      dateTo ||
      minAmountPaise ||
      maxAmountPaise ||
      queue !== 'all',
  )

  const clearPaymentFilters = () => {
    setQueue('all')
    setSearch('')
    setSelectedStatuses([])
    setSelectedMethods([])
    setSelectedGateways([])
    setCity('')
    setSelectedOrders([])
    setSelectedCustomers([])
    setSelectedVendors([])
    setDateFrom('')
    setDateTo('')
    setMinAmountPaise('')
    setMaxAmountPaise('')
    setPage(1)
  }

  const applyQueue = (nextQueue: PaymentQueueKey) => {
    setQueue(nextQueue)
    setSelectedStatuses([])

    if (nextQueue === 'needsReview') {
      setSelectedStatuses(['CREATED', 'PENDING', 'FAILED'])
    }

    if (nextQueue === 'successful') {
      setSelectedStatuses(['SUCCESS'])
    }

    if (nextQueue === 'failed') {
      setSelectedStatuses(['FAILED'])
    }

    if (nextQueue === 'cancelled') {
      setSelectedStatuses(['CANCELLED'])
    }

    setPage(1)
  }

  const startColumnResize = (
    columnId: PaymentColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getPaymentColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getPaymentColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: PaymentColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getPaymentColumnDefaultWidth(columnId),
    }))
  }

  const toggleColumn = (columnId: PaymentColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const showColumn = (columnId: PaymentColumnId) =>
    visibleColumns.includes(columnId)

  const viewDetails = (payment: AdminPaymentSummary) => {
    navigate(`${routePaths.payments}/${payment.paymentId}`)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PaymentActionSelection
      values: PaymentActionFormValues
    }) => {
      if (action.kind !== 'RECONCILE_PAYMENT') {
        throw new Error('Unsupported payment action from list view.')
      }

      return paymentService.reconcilePayment(action.payment.paymentId, {
        reason: values.reason,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: (_response, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      if (variables.action.kind === 'RECONCILE_PAYMENT') {
        void queryClient.invalidateQueries({
          queryKey: ['payment-detail', variables.action.payment.paymentId],
        })
      }
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Payment action failed.',
      )
    },
  })

  const openReconcile = (
    payment: AdminPaymentSummary,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()
    setActionError(null)
    setActionTarget({
      action: { kind: 'RECONCILE_PAYMENT', payment },
      payment,
    })
  }

  const renderPaymentCells = (payment: AdminPaymentSummary) => (
    <>
      {showColumn('payment') ? (
        <PaymentCell label="Payment">
          <p className="truncate font-semibold">{payment.publicPaymentId}</p>
          <p className="mt-1 truncate text-xs text-muted">{payment.paymentId}</p>
        </PaymentCell>
      ) : null}
      {showColumn('order') ? (
        <PaymentCell label="Order">
          <p className="truncate font-semibold">{payment.order.publicOrderId}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {humanizeCode(payment.order.orderStatus)}
          </p>
        </PaymentCell>
      ) : null}
      {showColumn('status') ? (
        <PaymentCell label="Status">
          <Badge tone={getPaymentStatusTone(payment.status)}>
            {humanizeCode(payment.status)}
          </Badge>
          {payment.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {payment.warnings.length} warning
              {payment.warnings.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </PaymentCell>
      ) : null}
      {showColumn('method') ? (
        <PaymentCell label="Method">
          <p className="font-semibold">{humanizeCode(payment.method)}</p>
          <p className="mt-1 text-xs text-muted">{humanizeCode(payment.gateway)}</p>
        </PaymentCell>
      ) : null}
      {showColumn('parties') ? (
        <PaymentCell label="Customer / Vendor">
          <p className="truncate font-semibold">{payment.customer.fullName}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {payment.vendor.shopName}
          </p>
        </PaymentCell>
      ) : null}
      {showColumn('amount') ? (
        <PaymentCell label="Amount">
          <p className="font-semibold">{formatPaise(payment.amountPaise)}</p>
          <p className="mt-1 text-xs text-muted">{payment.currency}</p>
        </PaymentCell>
      ) : null}
      {showColumn('refunds') ? (
        <PaymentCell label="Refunds">
          <Badge
            tone={
              payment.refundSummary.requestedCount > 0
                ? 'warning'
                : payment.refundSummary.refundCount > 0
                  ? 'info'
                  : 'neutral'
            }
          >
            {payment.refundSummary.refundCount} refund
            {payment.refundSummary.refundCount === 1 ? '' : 's'}
          </Badge>
          <p className="mt-1 text-xs text-muted">
            {formatPaise(payment.refundSummary.remainingRefundableAmountPaise)} left
          </p>
        </PaymentCell>
      ) : null}
      {showColumn('gateway') ? (
        <PaymentCell label="Gateway">
          <p className="truncate font-semibold">{humanizeCode(payment.gateway)}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {payment.razorpayPaymentId ?? payment.razorpayOrderId ?? 'No provider id'}
          </p>
        </PaymentCell>
      ) : null}
      {showColumn('updatedAt') ? (
        <PaymentCell label="Updated">
          <p className="font-semibold">{formatDateSafe(payment.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Created {formatDateSafe(payment.createdAt)}
          </p>
        </PaymentCell>
      ) : null}
    </>
  )

  const renderRowActions = (payment: AdminPaymentSummary) => (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {canReconcile && payment.availableActions.includes('RECONCILE') ? (
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={(event) => openReconcile(payment, event)}
        >
          <RefreshCcw className="mr-2 size-4" />
          Reconcile
        </Button>
      ) : null}
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation()
          viewDetails(payment)
        }}
      >
        <ArrowUpRight className="mr-2 size-4" />
        Open
      </Button>
    </div>
  )

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Review, reconcile, and trace backend payment records."
        placement="topbar"
        title="Payments"
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
                  aria-label="Expand payment filters"
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
                      aria-label="Collapse payment filters"
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
                          queue === queueItem.key
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
                        onClick={clearPaymentFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <MultiSelectFilter
                      label="Payment status"
                      options={statusOptions}
                      placeholder="All statuses"
                      values={selectedStatuses}
                      onChange={(values) => {
                        setSelectedStatuses(values as AdminPaymentStatus[])
                        setQueue('all')
                        resetToFirstPage()
                      }}
                    />
                    <MultiSelectFilter
                      label="Payment method"
                      options={methodOptions}
                      placeholder="All methods"
                      values={selectedMethods}
                      onChange={(values) => {
                        setSelectedMethods(values as AdminPaymentMethod[])
                        resetToFirstPage()
                      }}
                    />
                    <MultiSelectFilter
                      label="Gateway"
                      options={gatewayOptions}
                      placeholder="All gateways"
                      values={selectedGateways}
                      onChange={(values) => {
                        setSelectedGateways(values as AdminPaymentGateway[])
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
                      fetchOptions={searchOrderLookupOptions}
                      label="Order"
                      placeholder="Search order"
                      queryKey={['lookup', 'orders']}
                      selectedOptions={selectedOrders}
                      onChange={(options) => {
                        setSelectedOrders(options)
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
                    <LookupMultiSelect
                      fetchOptions={searchVendorLookupOptions}
                      label="Vendor"
                      placeholder="Search vendor"
                      queryKey={['lookup', 'vendors', 'payments']}
                      selectedOptions={selectedVendors}
                      onChange={(options) => {
                        setSelectedVendors(options)
                        resetToFirstPage()
                      }}
                    />
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Minimum amount
                      </span>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        placeholder="Paise"
                        value={minAmountPaise}
                        onChange={(event) => {
                          setMinAmountPaise(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Maximum amount
                      </span>
                      <Input
                        className="min-h-10"
                        inputMode="numeric"
                        placeholder="Paise"
                        value={maxAmountPaise}
                        onChange={(event) => {
                          setMaxAmountPaise(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
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
                  Payment operations
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} payments matching current filters`
                    : 'Search, filter, and reconcile backend payments.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search payment, order, customer, vendor"
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
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(routePaths.refunds)}
                >
                  <ArrowUpRight className="mr-2 size-4" />
                  Refund Queue
                </Button>
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
                      {paymentDataColumns.map((column) => {
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
                  onClick={() => void paymentsQuery.refetch()}
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

            {paymentsQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load payment data. Please retry."
                  title="Payment data unavailable"
                  onRetry={() => void paymentsQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <PaymentRowsSkeleton />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description="No payment records matched the current filters."
                  title="No payments found"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--payment-grid-min-width)]"
                    style={paymentGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--payment-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={paymentSelection.allVisibleSelected}
                          indeterminate={paymentSelection.someVisibleSelected}
                          label="Select visible payments"
                          onChange={paymentSelection.setVisibleSelected}
                        />
                      </div>
                      {paymentDataColumns
                        .filter((column) => visibleColumns.includes(column.id))
                        .map((column) => (
                          <div
                            className="relative flex min-w-0 items-center pr-3"
                            key={column.id}
                          >
                            <span className="truncate">{column.label}</span>
                            <button
                              aria-label={`Resize ${column.label} column`}
                              className="absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-l border-border transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="Drag to resize"
                              type="button"
                              onDoubleClick={() => resetColumnWidth(column.id)}
                              onPointerDown={(event) =>
                                startColumnResize(column.id, event)
                              }
                            />
                          </div>
                        ))}
                      <div className="relative flex min-w-0 items-center justify-end pr-3">
                        <span>Actions</span>
                        <button
                          aria-label="Resize actions column"
                          className="absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-l border-border transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Drag to resize"
                          type="button"
                          onDoubleClick={() =>
                            resetColumnWidth(PAYMENT_ACTION_COLUMN_ID)
                          }
                          onPointerDown={(event) =>
                            startColumnResize(PAYMENT_ACTION_COLUMN_ID, event)
                          }
                        />
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={paymentSelection.allVisibleSelected}
                      selectedCount={paymentSelection.selectedCount}
                      visibleCount={paymentSelection.visibleCount}
                      onClear={paymentSelection.clearSelection}
                      onSelectVisible={() => paymentSelection.setVisibleSelected(true)}
                    />

                    <div className="divide-y divide-border">
                      {payments.map((payment) => (
                        <div
                          aria-label={`Open payment ${payment.paymentId}`}
                          aria-selected={paymentSelection.isSelected(payment.paymentId)}
                          className={cn(
                            'grid w-full cursor-pointer gap-3 px-3 py-3 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--payment-grid-template)]',
                            paymentSelection.isSelected(payment.paymentId) &&
                              'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={payment.paymentId}
                          role="button"
                          style={paymentGridStyle}
                          tabIndex={0}
                          onClick={() => viewDetails(payment)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              viewDetails(payment)
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-start xl:items-center">
                            <ListSelectionCheckbox
                              checked={paymentSelection.isSelected(payment.paymentId)}
                              label={`Select payment ${payment.paymentId}`}
                              onChange={(selected) =>
                                paymentSelection.setItemSelected(
                                  payment.paymentId,
                                  selected,
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                            {renderPaymentCells(payment)}
                          </div>
                          <div className="flex min-w-0 items-center justify-start xl:justify-end">
                            {renderRowActions(payment)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {pagination ? (
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 text-sm text-muted">
                    <div className="flex items-center gap-2">
                      <span>
                        Showing {(pagination.page - 1) * pagination.limit + 1}-
                        {Math.min(
                          pagination.page * pagination.limit,
                          pagination.totalItems,
                        )}{' '}
                        of {pagination.totalItems}
                      </span>
                      <label className="flex items-center gap-2">
                        <span>Rows</span>
                        <select
                          className="h-9 rounded-[0.65rem] border border-border bg-surface px-2 text-foreground outline-none"
                          value={limit}
                          onChange={(event) => {
                            setLimit(Number(event.target.value))
                            setPage(1)
                          }}
                        >
                          {[10, 20, 50, 100].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label="Previous page"
                        className="btn-icon"
                        disabled={!pagination.hasPreviousPage}
                        type="button"
                        onClick={() => setPage((currentPage) => currentPage - 1)}
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      <span className="font-medium text-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        aria-label="Next page"
                        className="btn-icon"
                        disabled={!pagination.hasNextPage}
                        type="button"
                        onClick={() => setPage((currentPage) => currentPage + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </section>
      </div>

      <PaymentActionModal
        action={actionTarget?.action ?? null}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        onClose={() => {
          if (!actionMutation.isPending) {
            setActionTarget(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (!actionTarget) return

          void actionMutation.mutateAsync({
            action: actionTarget.action,
            values,
          })
        }}
      />
    </PageContainer>
  )
}
