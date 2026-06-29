import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Filter,
  ReceiptText,
  RefreshCcw,
  SlidersHorizontal,
  Store,
  UserRound,
  XCircle,
} from 'lucide-react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
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
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { readLookupOptionsFromSearchParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import {
  searchCustomerLookupOptions,
  searchOrderLookupOptions,
  searchPaymentLookupOptions,
  searchVendorLookupOptions,
} from '../../lookups/adminLookups'
import { paymentService } from '../services/payment.service'
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from './PaymentActionModal'
import type {
  AdminFinancePagination,
  AdminRefundStatus,
  AdminRefundSummary,
  AdminRefundsQueryParams,
} from '../types/payment.types'

const DEFAULT_PAGE_SIZE = 10
const REFUND_DEFAULT_COLUMN_WIDTH = 220
const REFUND_GRID_COLUMN_GAP = 12
const REFUND_GRID_INLINE_PADDING = 24
const REFUND_ACTION_COLUMN_ID = 'actions'
const REFUND_ACTION_COLUMN_DEFAULT_WIDTH = 210
const REFUND_ACTION_COLUMN_MIN_WIDTH = 180
const REFUND_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.refund.columnWidths.v1'

const refundStatuses: AdminRefundStatus[] = [
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'SUCCESS',
  'FAILED',
  'REJECTED',
]

const refundDataColumns = [
  {
    id: 'refund',
    label: 'Refund',
    defaultWidth: REFUND_DEFAULT_COLUMN_WIDTH,
    minWidth: 200,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 180,
    minWidth: 150,
  },
  {
    id: 'payment',
    label: 'Payment',
    defaultWidth: REFUND_DEFAULT_COLUMN_WIDTH,
    minWidth: 190,
  },
  {
    id: 'order',
    label: 'Order',
    defaultWidth: REFUND_DEFAULT_COLUMN_WIDTH,
    minWidth: 180,
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
    id: 'reason',
    label: 'Reason',
    defaultWidth: 280,
    minWidth: 220,
  },
  {
    id: 'review',
    label: 'Review',
    defaultWidth: 190,
    minWidth: 160,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: 170,
    minWidth: 150,
  },
] as const

type RefundTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type RefundColumnId = (typeof refundDataColumns)[number]['id']
type RefundColumnWidthId = RefundColumnId | typeof REFUND_ACTION_COLUMN_ID
type RefundColumnWidths = Partial<Record<RefundColumnWidthId, number>>
type RefundQueueKey =
  | 'all'
  | 'requested'
  | 'approved'
  | 'processing'
  | 'successful'
  | 'exceptions'

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

function queueKeyForRefundStatuses(
  selectedStatuses: AdminRefundStatus[],
): RefundQueueKey {
  if (selectedStatuses.length === 0) return 'all'
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'REQUESTED') {
    return 'requested'
  }
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'APPROVED') {
    return 'approved'
  }
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'PROCESSING') {
    return 'processing'
  }
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'SUCCESS') {
    return 'successful'
  }
  if (
    selectedStatuses.every((status) => ['FAILED', 'REJECTED'].includes(status))
  ) {
    return 'exceptions'
  }

  return 'all'
}

const defaultRefundColumns: RefundColumnId[] = [
  'refund',
  'status',
  'payment',
  'order',
  'parties',
  'amount',
  'review',
]

interface RefundGridStyle extends CSSProperties {
  '--refund-grid-template': string
  '--refund-grid-min-width': string
}

interface RefundMetric {
  label: string
  meta: string
  tone: RefundTone
  value: string
}

function toneClasses(tone: RefundTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
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

function getRefundStatusTone(status: AdminRefundStatus): RefundTone {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'REJECTED') return 'danger'
  if (status === 'REQUESTED' || status === 'APPROVED' || status === 'PROCESSING') {
    return 'warning'
  }

  return 'neutral'
}

function buildRefundMetrics(
  refunds: AdminRefundSummary[],
  pagination?: AdminFinancePagination,
): RefundMetric[] {
  const total = pagination?.totalItems ?? refunds.length
  const requested = refunds.filter((refund) => refund.status === 'REQUESTED').length
  const processing = refunds.filter((refund) =>
    ['APPROVED', 'PROCESSING'].includes(refund.status),
  ).length
  const approvedValue = refunds
    .filter((refund) =>
      ['APPROVED', 'PROCESSING', 'SUCCESS'].includes(refund.status),
    )
    .reduce((sum, refund) => sum + refund.amountPaise, 0)

  return [
    {
      label: 'Needs review',
      meta: 'Requested refunds in visible rows',
      tone: requested > 0 ? 'warning' : 'neutral',
      value: String(requested),
    },
    {
      label: 'Approved value',
      meta: 'Approved, processing, or completed value in visible rows',
      tone: approvedValue > 0 ? 'success' : 'neutral',
      value: formatPaise(approvedValue),
    },
    {
      label: 'In process',
      meta: 'Approved or processing refunds in visible rows',
      tone: processing > 0 ? 'info' : 'neutral',
      value: String(processing),
    },
    {
      label: 'Matched refunds',
      meta: 'Total matching current filters',
      tone: 'info',
      value: String(total),
    },
  ]
}

function buildRefundQueueItems(refunds: AdminRefundSummary[]) {
  return [
    {
      key: 'all' as const,
      label: 'All visible',
      count: refunds.length,
    },
    {
      key: 'requested' as const,
      label: 'Requested',
      count: refunds.filter((refund) => refund.status === 'REQUESTED').length,
    },
    {
      key: 'approved' as const,
      label: 'Approved',
      count: refunds.filter((refund) => refund.status === 'APPROVED').length,
    },
    {
      key: 'processing' as const,
      label: 'Processing',
      count: refunds.filter((refund) => refund.status === 'PROCESSING').length,
    },
    {
      key: 'successful' as const,
      label: 'Successful',
      count: refunds.filter((refund) => refund.status === 'SUCCESS').length,
    },
    {
      key: 'exceptions' as const,
      label: 'Failed / rejected',
      count: refunds.filter((refund) =>
        ['FAILED', 'REJECTED'].includes(refund.status),
      ).length,
    },
  ]
}

function getRefundColumnDefaultWidth(columnId: RefundColumnWidthId) {
  if (columnId === REFUND_ACTION_COLUMN_ID) {
    return REFUND_ACTION_COLUMN_DEFAULT_WIDTH
  }

  return (
    refundDataColumns.find((column) => column.id === columnId)?.defaultWidth ??
    REFUND_DEFAULT_COLUMN_WIDTH
  )
}

function getRefundColumnMinWidth(columnId: RefundColumnWidthId) {
  if (columnId === REFUND_ACTION_COLUMN_ID) {
    return REFUND_ACTION_COLUMN_MIN_WIDTH
  }

  return refundDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
}

function getRefundColumnWidth(
  columnWidths: RefundColumnWidths,
  columnId: RefundColumnWidthId,
) {
  return columnWidths[columnId] ?? getRefundColumnDefaultWidth(columnId)
}

function getRefundGridTemplate(
  visibleColumns: RefundColumnId[],
  columnWidths: RefundColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getRefundColumnWidth(columnWidths, columnId)}px`,
    ),
    `${getRefundColumnWidth(columnWidths, REFUND_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getRefundGridMinWidth(
  visibleColumns: RefundColumnId[],
  columnWidths: RefundColumnWidths,
) {
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getRefundColumnWidth(columnWidths, columnId),
    0,
  )
  const actionWidth = getRefundColumnWidth(columnWidths, REFUND_ACTION_COLUMN_ID)
  const columnCount = visibleColumns.length + 2
  const gapWidth = Math.max(0, columnCount - 1) * REFUND_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    actionWidth +
    gapWidth +
    REFUND_GRID_INLINE_PADDING
  }px`
}

function loadRefundColumnWidths(): RefundColumnWidths {
  try {
    const storedValue = window.localStorage.getItem(REFUND_COLUMN_WIDTH_STORAGE_KEY)

    if (!storedValue) return {}

    const parsedValue = JSON.parse(storedValue) as RefundColumnWidths

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, width]) => typeof width === 'number'),
    ) as RefundColumnWidths
  } catch {
    return {}
  }
}

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return 'Not refreshed yet'

  return `Updated ${formatDate(new Date(updatedAt).toISOString(), true)}`
}

function MetricCard({ label, meta, tone, value }: RefundMetric) {
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

function RefundRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid gap-3 border-b border-border px-3 py-4 xl:grid-cols-[1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_1fr]"
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

function RefundCell({
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

export function RefundsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadPayments = usePermission('payments:read')
  const canReadOrders = usePermission('orders:read')
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canReviewRefunds = usePermission('payments:refund')
  const initialPaymentId = searchParams.get('paymentId') ?? ''
  const initialPaymentLabel = searchParams.get('paymentLabel') ?? initialPaymentId
  const seededStatuses = readEnumSearchValues(searchParams, 'status', refundStatuses)
  const initialStatuses =
    seededStatuses.length > 0
      ? seededStatuses
      : (['REQUESTED'] as AdminRefundStatus[])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [selectedStatuses, setSelectedStatuses] =
    useState<AdminRefundStatus[]>(() => initialStatuses)
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedPayments, setSelectedPayments] = useState<LookupOption[]>(() =>
    initialPaymentId
      ? [
          {
            label: initialPaymentLabel,
            value: initialPaymentId,
          },
        ]
      : [],
  )
  const [selectedOrders, setSelectedOrders] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'orderId', 'orderLabel'),
  )
  const [selectedCustomers, setSelectedCustomers] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'customerId', 'customerLabel'),
  )
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>(() =>
    readLookupOptionsFromSearchParams(searchParams, 'vendorId', 'vendorLabel'),
  )
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [minAmountPaise, setMinAmountPaise] = useState('')
  const [maxAmountPaise, setMaxAmountPaise] = useState('')
  const [queue, setQueue] = useState<RefundQueueKey>(() =>
    queueKeyForRefundStatuses(initialStatuses),
  )
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<PaymentActionSelection | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<RefundColumnId[]>(defaultRefundColumns)
  const [columnWidths, setColumnWidths] =
    useState<RefundColumnWidths>(loadRefundColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        REFUND_COLUMN_WIDTH_STORAGE_KEY,
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
      refundStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const paymentIds = useMemo(
    () => selectedPayments.map((payment) => payment.value),
    [selectedPayments],
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

  const clearSeededRefundParams = () => {
    const seededKeys = [
      'city',
      'customerId',
      'customerLabel',
      'dateFrom',
      'dateTo',
      'orderId',
      'orderLabel',
      'paymentId',
      'paymentLabel',
      'search',
      'status',
      'vendorId',
      'vendorLabel',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const query = useMemo<AdminRefundsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      city: city.trim() || undefined,
      paymentId: paymentIds.length > 0 ? paymentIds : undefined,
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
      paymentIds,
      search,
      selectedStatuses,
      vendorIds,
    ],
  )

  const refundsQuery = useQuery({
    queryKey: ['refunds', query],
    queryFn: () => paymentService.getRefundList(query),
  })

  const refunds = refundsQuery.data?.data ?? []
  const pagination = refundsQuery.data?.pagination
  const refundSelection = useListSelection(refunds, (refund) => refund.refundId)
  const isInitialLoading = refundsQuery.isLoading && !refundsQuery.data
  const isRefreshing = refundsQuery.isFetching && Boolean(refundsQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(refundsQuery.dataUpdatedAt)

  const metrics = buildRefundMetrics(refunds, pagination)
  const queueItems = buildRefundQueueItems(refunds)
  const refundGridStyle = useMemo<RefundGridStyle>(
    () => ({
      '--refund-grid-template': getRefundGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--refund-grid-min-width': getRefundGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )

  const hasActiveFilters = Boolean(
    search ||
      selectedStatuses.length > 0 ||
      city ||
      paymentIds.length > 0 ||
      orderIds.length > 0 ||
      customerIds.length > 0 ||
      vendorIds.length > 0 ||
      dateFrom ||
      dateTo ||
      minAmountPaise ||
      maxAmountPaise ||
      queue !== 'all',
  )

  const clearRefundFilters = () => {
    clearSeededRefundParams()
    setQueue('all')
    setSearch('')
    setSelectedStatuses([])
    setCity('')
    setSelectedPayments([])
    setSelectedOrders([])
    setSelectedCustomers([])
    setSelectedVendors([])
    setDateFrom('')
    setDateTo('')
    setMinAmountPaise('')
    setMaxAmountPaise('')
    setPage(1)
  }

  const applyQueue = (nextQueue: RefundQueueKey) => {
    clearSeededRefundParams()
    setQueue(nextQueue)
    setSelectedStatuses([])

    if (nextQueue === 'requested') {
      setSelectedStatuses(['REQUESTED'])
    }

    if (nextQueue === 'approved') {
      setSelectedStatuses(['APPROVED'])
    }

    if (nextQueue === 'processing') {
      setSelectedStatuses(['PROCESSING'])
    }

    if (nextQueue === 'successful') {
      setSelectedStatuses(['SUCCESS'])
    }

    if (nextQueue === 'exceptions') {
      setSelectedStatuses(['FAILED', 'REJECTED'])
    }

    setPage(1)
  }

  const startColumnResize = (
    columnId: RefundColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getRefundColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getRefundColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: RefundColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getRefundColumnDefaultWidth(columnId),
    }))
  }

  const toggleColumn = (columnId: RefundColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const showColumn = (columnId: RefundColumnId) =>
    visibleColumns.includes(columnId)

  const viewDetails = (refund: AdminRefundSummary) => {
    navigate(`${routePaths.refunds}/${refund.refundId}`)
  }

  const viewPayment = (refund: AdminRefundSummary) => {
    navigate(`${routePaths.payments}/${refund.payment.paymentId}`)
  }

  const viewOrder = (refund: AdminRefundSummary) => {
    navigate(`${routePaths.orders}/${refund.order.orderId}`)
  }

  const viewCustomer = (refund: AdminRefundSummary) => {
    navigate(`${routePaths.customers}/${refund.customer.customerId}`)
  }

  const viewVendor = (refund: AdminRefundSummary) => {
    navigate(`${routePaths.vendors}/${refund.vendor.vendorId}`)
  }

  const mutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PaymentActionSelection
      values: PaymentActionFormValues
    }) => {
      if (action.kind === 'APPROVE_REFUND') {
        if (!values.reason) throw new Error('Approval reason is required.')
        return paymentService.approveRefund(action.refund.refundId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT_REFUND') {
        if (!values.reason) throw new Error('Rejection reason is required.')
        return paymentService.rejectRefund(action.refund.refundId, {
          reason: values.reason,
        })
      }

      throw new Error('Unsupported refund action.')
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Refund updated.')
      void queryClient.invalidateQueries({ queryKey: ['refunds'] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })

      if (
        variables.action.kind === 'APPROVE_REFUND' ||
        variables.action.kind === 'REJECT_REFUND'
      ) {
        void queryClient.invalidateQueries({
          queryKey: ['refund-detail', variables.action.refund.refundId],
        })
        void queryClient.invalidateQueries({
          queryKey: ['payment-detail', variables.action.refund.paymentId],
        })
      }
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Refund action failed.',
      )
    },
  })

  const openRefundAction = (
    action: PaymentActionSelection,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()
    if (!canReviewRefunds) return

    setActionError(null)
    setSelectedAction(action)
  }

  const renderRefundCells = (refund: AdminRefundSummary) => (
    <>
      {showColumn('refund') ? (
        <RefundCell label="Refund">
          <p className="truncate font-semibold">{refund.refundId}</p>
          <p className="mt-1 truncate text-xs text-muted">
            Created {formatDateSafe(refund.createdAt)}
          </p>
        </RefundCell>
      ) : null}
      {showColumn('status') ? (
        <RefundCell label="Status">
          <Badge tone={getRefundStatusTone(refund.status)}>
            {humanizeCode(refund.status)}
          </Badge>
          {refund.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {refund.warnings.length} warning
              {refund.warnings.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </RefundCell>
      ) : null}
      {showColumn('payment') ? (
        <RefundCell label="Payment">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold">{refund.publicPaymentId}</p>
            {canReadPayments ? (
              <button
                aria-label={`Open payment ${refund.publicPaymentId}`}
                className="btn-icon size-7 shrink-0"
                title="Open payment"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  viewPayment(refund)
                }}
              >
                <CreditCard className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {humanizeCode(refund.payment.status)} · {humanizeCode(refund.payment.gateway)}
          </p>
        </RefundCell>
      ) : null}
      {showColumn('order') ? (
        <RefundCell label="Order">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold">{refund.order.publicOrderId}</p>
            {canReadOrders ? (
              <button
                aria-label={`Open order ${refund.order.publicOrderId}`}
                className="btn-icon size-7 shrink-0"
                title="Open order"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  viewOrder(refund)
                }}
              >
                <ReceiptText className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {humanizeCode(refund.order.orderStatus)}
          </p>
        </RefundCell>
      ) : null}
      {showColumn('parties') ? (
        <RefundCell label="Customer / Vendor">
          <div className="space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-semibold">{refund.customer.fullName}</p>
              {canReadCustomers ? (
                <button
                  aria-label={`Open customer ${refund.customer.fullName}`}
                  className="btn-icon size-7 shrink-0"
                  title="Open customer"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    viewCustomer(refund)
                  }}
                >
                  <UserRound className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-xs text-muted">{refund.vendor.shopName}</p>
              {canReadVendors ? (
                <button
                  aria-label={`Open vendor ${refund.vendor.shopName}`}
                  className="btn-icon size-7 shrink-0"
                  title="Open vendor"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    viewVendor(refund)
                  }}
                >
                  <Store className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </RefundCell>
      ) : null}
      {showColumn('amount') ? (
        <RefundCell label="Amount">
          <p className="font-semibold">{formatPaise(refund.amountPaise)}</p>
          <p className="mt-1 text-xs text-muted">{refund.currency}</p>
        </RefundCell>
      ) : null}
      {showColumn('reason') ? (
        <RefundCell label="Reason">
          <p className="line-clamp-2">{refund.reason}</p>
          {refund.rejectionReason ? (
            <p className="mt-1 line-clamp-1 text-xs text-danger">
              {refund.rejectionReason}
            </p>
          ) : null}
        </RefundCell>
      ) : null}
      {showColumn('review') ? (
        <RefundCell label="Review">
          <p className="font-semibold">
            {humanizeCode(refund.nextRecommendedAction)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Reviewed {formatDateSafe(refund.reviewedAt)}
          </p>
        </RefundCell>
      ) : null}
      {showColumn('updatedAt') ? (
        <RefundCell label="Updated">
          <p className="font-semibold">{formatDateSafe(refund.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Processed {formatDateSafe(refund.processedAt)}
          </p>
        </RefundCell>
      ) : null}
    </>
  )

  const renderRowActions = (refund: AdminRefundSummary) => (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {canReviewRefunds && refund.availableActions.includes('APPROVE') ? (
        <Button
          size="sm"
          type="button"
          variant="secondary"
          disabled={mutation.isPending}
          onClick={(event) =>
            openRefundAction({ kind: 'APPROVE_REFUND', refund }, event)
          }
        >
          <CheckCircle2 className="mr-2 size-4" />
          Approve
        </Button>
      ) : null}
      {canReviewRefunds && refund.availableActions.includes('REJECT') ? (
        <Button
          size="sm"
          type="button"
          variant="danger"
          disabled={mutation.isPending}
          onClick={(event) =>
            openRefundAction({ kind: 'REJECT_REFUND', refund }, event)
          }
        >
          <XCircle className="mr-2 size-4" />
          Reject
        </Button>
      ) : null}
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation()
          viewDetails(refund)
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
        description="Review, approve, reject, and trace refund requests."
        layout="workspace"
        placement="topbar"
        title="Refunds"
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

        {actionMessage ? (
          <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
            {actionMessage}
          </div>
        ) : null}

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
                  aria-label="Expand refund filters"
                  className="btn-icon"
                  title="Expand filters"
                  type="button"
                  onClick={() => setFiltersCollapsed(false)}
                >
                  <ChevronRight className="size-4" />
                </button>
                <span
                  aria-hidden="true"
                  className="inline-flex size-9 items-center justify-center rounded-[0.65rem] bg-surface-muted/70 text-muted"
                >
                  <Filter className="size-4" />
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
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        Visible queues
                      </h2>
                      <p className="text-xs text-muted">Counts are loaded rows.</p>
                    </div>
                    <button
                      aria-label="Collapse refund filters"
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
                        onClick={clearRefundFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <MultiSelectFilter
                      label="Refund status"
                      options={statusOptions}
                      placeholder="All statuses"
                      values={selectedStatuses}
                      onChange={(values) => {
                        clearSeededRefundParams()
                        setSelectedStatuses(values as AdminRefundStatus[])
                        setQueue('all')
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
                          clearSeededRefundParams()
                          setCity(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    <LookupMultiSelect
                      fetchOptions={searchPaymentLookupOptions}
                      label="Payment"
                      placeholder="Search payment"
                      queryKey={['lookup', 'payments', 'refunds']}
                      selectedOptions={selectedPayments}
                      onChange={(options) => {
                        setSelectedPayments(options)
                        clearSeededRefundParams()
                        resetToFirstPage()
                      }}
                    />
                    <LookupMultiSelect
                      fetchOptions={searchOrderLookupOptions}
                      label="Order"
                      placeholder="Search order"
                      queryKey={['lookup', 'orders', 'refunds']}
                      selectedOptions={selectedOrders}
                      onChange={(options) => {
                        clearSeededRefundParams()
                        setSelectedOrders(options)
                        resetToFirstPage()
                      }}
                    />
                    <LookupMultiSelect
                      fetchOptions={searchCustomerLookupOptions}
                      label="Customer"
                      placeholder="Search customer"
                      queryKey={['lookup', 'customers', 'refunds']}
                      selectedOptions={selectedCustomers}
                      onChange={(options) => {
                        clearSeededRefundParams()
                        setSelectedCustomers(options)
                        resetToFirstPage()
                      }}
                    />
                    <LookupMultiSelect
                      fetchOptions={searchVendorLookupOptions}
                      label="Vendor"
                      placeholder="Search vendor"
                      queryKey={['lookup', 'vendors', 'refunds']}
                      selectedOptions={selectedVendors}
                      onChange={(options) => {
                        clearSeededRefundParams()
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
                          clearSeededRefundParams()
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
                          clearSeededRefundParams()
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
                  Refund operations
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} refunds matching current filters`
                    : 'Search, filter, and review refund requests.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search refund, payment, order, customer, vendor"
                  value={search}
                  onChange={(nextSearch) => {
                    clearSeededRefundParams()
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
                  onClick={() => navigate(routePaths.payments)}
                >
                  <ArrowUpRight className="mr-2 size-4" />
                  Payments
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
                      {refundDataColumns.map((column) => {
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
                  onClick={() => void refundsQuery.refetch()}
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

            {refundsQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load refund data. Please retry."
                  title="Refund data unavailable"
                  onRetry={() => void refundsQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <RefundRowsSkeleton />
              </div>
            ) : refunds.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description="No refund records matched the current filters."
                  title="No refunds found"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--refund-grid-min-width)]"
                    style={refundGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--refund-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={refundSelection.allVisibleSelected}
                          indeterminate={refundSelection.someVisibleSelected}
                          label="Select visible refunds"
                          onChange={refundSelection.setVisibleSelected}
                        />
                      </div>
                      {refundDataColumns
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
                            resetColumnWidth(REFUND_ACTION_COLUMN_ID)
                          }
                          onPointerDown={(event) =>
                            startColumnResize(REFUND_ACTION_COLUMN_ID, event)
                          }
                        />
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={refundSelection.allVisibleSelected}
                      selectedCount={refundSelection.selectedCount}
                      visibleCount={refundSelection.visibleCount}
                      onClear={refundSelection.clearSelection}
                      onSelectVisible={() => refundSelection.setVisibleSelected(true)}
                    />

                    <div className="divide-y divide-border">
                      {refunds.map((refund) => (
                        <div
                          aria-label={`Open refund ${refund.refundId}`}
                          aria-selected={refundSelection.isSelected(refund.refundId)}
                          className={cn(
                            'grid w-full cursor-pointer gap-3 px-3 py-3 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--refund-grid-template)]',
                            refundSelection.isSelected(refund.refundId) &&
                              'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={refund.refundId}
                          role="button"
                          style={refundGridStyle}
                          tabIndex={0}
                          onClick={() => viewDetails(refund)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              viewDetails(refund)
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-start xl:items-center">
                            <ListSelectionCheckbox
                              checked={refundSelection.isSelected(refund.refundId)}
                              label={`Select refund ${refund.refundId}`}
                              onChange={(selected) =>
                                refundSelection.setItemSelected(
                                  refund.refundId,
                                  selected,
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                            {renderRefundCells(refund)}
                          </div>
                          <div className="flex min-w-0 items-center justify-start xl:justify-end">
                            {renderRowActions(refund)}
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
        action={selectedAction}
        error={actionError}
        isSubmitting={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (selectedAction) {
            void mutation.mutateAsync({ action: selectedAction, values })
          }
        }}
      />
    </PageContainer>
  )
}
