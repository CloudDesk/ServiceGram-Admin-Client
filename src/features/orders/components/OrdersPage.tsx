import { Download, MessageSquarePlus, MoreHorizontal, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { orderService } from '../services/order.service'
import {
  canRunOrderAction,
  compactOrderRowActionLabel,
  formatDateSafe,
  getOrderStatusTone,
  getPaymentStatusTone,
  hasOrderAction,
  humanizeCode,
  isHighRiskOrderAction,
  mapRecommendedAction,
  orderActionKey,
  orderDisplayValue,
  orderPaymentReviewStatuses,
  orderQueueStatusFilters,
} from '../orderPresenters'
import type {
  AdminOrderStatus,
  AdminOrderSummary,
  AdminOrdersQueryParams,
} from '../types/order.types'
import {
  OrderActionModal,
  type OrderActionFormValues,
  type OrderActionSelection,
} from './OrderActionModal'

const ORDER_LIST_STORAGE_KEY = 'servicegram.orders.list.v1'
const DEFAULT_PAGE_SIZE = 50

type OrderQueueKey =
  | 'all'
  | 'attention'
  | 'acceptance'
  | 'inProgress'
  | 'delivery'
  | 'payment'
  | 'completed'
  | 'cancelled'

interface OrderActionTarget {
  action: OrderActionSelection
  order: AdminOrderSummary
}

function toneClass(tone: ReturnType<typeof getOrderStatusTone>) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

interface RowActionsProps {
  order: AdminOrderSummary
  canRefundPayments: boolean
  canUpdateOrders: boolean
  onAction: (order: AdminOrderSummary, action: OrderActionSelection) => void
}

/**
 * The recommended action renders as a filled button in the row — this is the
 * pattern Orders already had and the reason an admin can clear a queue without
 * opening records. Everything else is behind the overflow.
 */
function RowActions({
  canRefundPayments,
  canUpdateOrders,
  onAction,
  order,
}: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const recommended = mapRecommendedAction(order)
  const primaryAction =
    recommended && canRunOrderAction(recommended, canRefundPayments, canUpdateOrders)
      ? recommended
      : null

  const menuActions: OrderActionSelection[] = []

  if (canUpdateOrders && hasOrderAction(order, 'ADD_NOTE') && primaryAction?.kind !== 'ADD_NOTE') {
    menuActions.push({ kind: 'ADD_NOTE' })
  }
  if (canRefundPayments && hasOrderAction(order, 'INITIATE_REFUND') && primaryAction?.kind !== 'INITIATE_REFUND') {
    menuActions.push({ kind: 'INITIATE_REFUND' })
  }
  if (canUpdateOrders && hasOrderAction(order, 'CANCEL') && primaryAction?.kind !== 'CANCEL') {
    menuActions.push({ kind: 'CANCEL' })
  }

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {primaryAction ? (
        <Button
          className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
          size="xs"
          type="button"
          variant={isHighRiskOrderAction(primaryAction) ? 'danger' : 'primary'}
          onClick={() => onAction(order, primaryAction)}
        >
          {compactOrderRowActionLabel(primaryAction)}
        </Button>
      ) : null}

      {menuActions.length ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for ${order.publicOrderId}`}
            className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-[0.4rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-3.5" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              {menuActions.map((action) => (
                <button
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                    isHighRiskOrderAction(action) && 'text-danger',
                  )}
                  key={orderActionKey(action)}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onAction(order, action)
                  }}
                >
                  {action.kind === 'ADD_NOTE' ? (
                    <MessageSquarePlus className="size-3.5" />
                  ) : null}
                  {compactOrderRowActionLabel(action)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function OrdersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canUpdateOrders = usePermission('orders:update_status')
  const canRefundPayments = usePermission('payments:refund')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<OrderQueueKey>('all')
  const [city, setCity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<OrderActionTarget | null>(null)

  const queueOrderStatuses = orderQueueStatusFilters[queue] as
    | AdminOrderStatus[]
    | undefined

  const query = useMemo<AdminOrdersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      orderStatus: queueOrderStatuses,
      paymentStatus: queue === 'payment' ? orderPaymentReviewStatuses : undefined,
    }),
    [city, dateFrom, dateTo, limit, page, queue, queueOrderStatuses, search],
  )

  const ordersQuery = useQuery({
    queryKey: ['orders', query],
    queryFn: () => orderService.getOrderList(query),
  })

  const orders = useMemo(() => ordersQuery.data?.data ?? [], [ordersQuery.data])
  const pagination = ordersQuery.data?.pagination

  /** Queue counts must span the result set, not the page. */
  const summaryQuery = useQuery({
    queryKey: [
      'orders-summary',
      { city: city.trim(), dateFrom, dateTo, search: search.trim() },
    ],
    queryFn: () =>
      orderService.getOrderList({
        page: 1,
        limit: 1,
        search: search.trim() || undefined,
        city: city.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    placeholderData: (previousData) => previousData,
  })

  const queueSummary = summaryQuery.data?.summary?.queueSummary
  const summary = summaryQuery.data?.summary

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: queueSummary?.allOrders ?? summary?.total },
    {
      key: 'attention',
      label: 'Price review',
      count: queueSummary?.priceReview,
      tone: 'warning',
    },
    {
      key: 'acceptance',
      label: 'Vendor acceptance',
      count: queueSummary?.vendorAcceptance,
      tone: 'warning',
    },
    { key: 'inProgress', label: 'In progress', count: queueSummary?.inProgress },
    { key: 'delivery', label: 'Delivery', count: queueSummary?.delivery },
    {
      key: 'payment',
      label: 'Payment review',
      count: queueSummary?.paymentReview ?? summary?.paymentReview,
      tone: 'danger',
    },
    { key: 'completed', label: 'Completed', count: queueSummary?.completed },
    { key: 'cancelled', label: 'Cancelled', count: queueSummary?.cancelled },
  ]

  const appliedFilterCount = [city.trim(), dateFrom, dateTo].filter(Boolean).length

  const clearSeededParams = () => {
    const seededKeys = ['search', 'orderStatus', 'paymentStatus', 'queue', 'vendorId', 'customerId']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const openAction = (order: AdminOrderSummary, action: OrderActionSelection) => {
    if (!canRunOrderAction(action, canRefundPayments, canUpdateOrders)) return

    setActionError(null)
    setActionTarget({ action, order })
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
        if (!action.targetStatus) throw new Error('Target status is required.')

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
      setActionError(error instanceof Error ? error.message : 'Order action failed.')
    },
  })

  const columns: DataListColumn<AdminOrderSummary>[] = useMemo(
    () => [
      {
        id: 'order',
        label: 'Order',
        defaultWidth: 210,
        minWidth: 170,
        priority: 1,
        grow: true,
        locked: true,
        render: (order) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">
              {order.publicOrderId}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {formatDateSafe(order.createdAt)}
            </span>
          </div>
        ),
      },
      {
        id: 'orderStatus',
        label: 'Status',
        defaultWidth: 140,
        minWidth: 120,
        priority: 1,
        render: (order) => (
          <span className="min-w-0 truncate" title={humanizeCode(order.orderStatus)}>
            <Badge tone={toneClass(getOrderStatusTone(order.orderStatus))}>
              {humanizeCode(order.orderStatus)}
            </Badge>
          </span>
        ),
      },
      {
        id: 'signals',
        label: 'Signals',
        defaultWidth: 70,
        minWidth: 62,
        priority: 1,
        render: (order) =>
          order.warnings.length ? (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-[0.35rem] bg-warning/12 px-1.5 text-xs font-semibold tabular-nums text-warning"
              title={order.warnings.join(', ')}
            >
              {order.warnings.length}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        id: 'customer',
        label: 'Customer',
        defaultWidth: 150,
        minWidth: 120,
        priority: 3,
        render: (order) => (
          <span className="truncate text-foreground">
            {order.customer.fullName || '—'}
          </span>
        ),
      },
      {
        id: 'vendor',
        label: 'Vendor',
        defaultWidth: 140,
        minWidth: 115,
        priority: 3,
        render: (order) => (
          <span className="truncate text-foreground">
            {order.vendor.shopName || '—'}
          </span>
        ),
      },
      {
        id: 'payment',
        label: 'Payment',
        defaultWidth: 120,
        minWidth: 105,
        priority: 2,
        render: (order) => (
          <span className="min-w-0 truncate" title={humanizeCode(order.paymentStatus)}>
            <Badge tone={toneClass(getPaymentStatusTone(order.paymentStatus))}>
              {humanizeCode(order.paymentStatus)}
            </Badge>
          </span>
        ),
      },
      {
        id: 'value',
        label: 'Value',
        defaultWidth: 100,
        minWidth: 88,
        priority: 2,
        align: 'right',
        render: (order) => {
          const { value } = orderDisplayValue(order)
          return <span>{value}</span>
        },
      },
      {
        id: 'pickup',
        label: 'Pickup',
        defaultWidth: 110,
        minWidth: 96,
        priority: 3,
        render: (order) => (
          <span className="text-muted">
            {formatDateSafe(order.schedule.pickupDate)}
          </span>
        ),
      },
      {
        id: 'route',
        label: 'Route',
        defaultWidth: 140,
        minWidth: 115,
        priority: 3,
        defaultHidden: true,
        render: (order) => (
          <span className="truncate text-muted">
            {order.vendor.city || order.customer.city || '—'}
          </span>
        ),
      },
      {
        id: 'counts',
        label: 'Notes / refunds',
        defaultWidth: 120,
        minWidth: 105,
        priority: 4,
        align: 'right',
        defaultHidden: true,
        render: (order) => (
          <span className="text-muted">
            {order.counts?.noteCount ?? 0} / {order.counts?.refundCount ?? 0}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (order) => (
          <span className="text-muted">{formatDateSafe(order.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.orderId)),
    [orders, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('orders'), selectedOrders, [
      { header: 'Order ID', value: (order) => order.publicOrderId },
      { header: 'Created', value: (order) => order.createdAt },
      { header: 'Status', value: (order) => order.orderStatus },
      { header: 'Payment status', value: (order) => order.paymentStatus },
      { header: 'Payment method', value: (order) => order.paymentMethod ?? '' },
      { header: 'Customer', value: (order) => order.customer.fullName },
      { header: 'Customer mobile', value: (order) => order.customer.mobileNumber ?? '' },
      { header: 'Vendor', value: (order) => order.vendor.shopName },
      { header: 'Vendor ID', value: (order) => order.vendor.publicVendorId },
      { header: 'City', value: (order) => order.vendor.city ?? order.customer.city ?? '' },
      {
        header: 'Value (INR)',
        value: (order) =>
          (order.pricing.finalPricePaise ??
            order.pricing.payableAmountPaise ??
            order.pricing.priceEstimatePaise) / 100,
      },
      { header: 'Pickup date', value: (order) => order.schedule.pickupDate ?? '' },
      { header: 'Signals', value: (order) => order.warnings.join('; ') },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh orders"
            className="h-9"
            disabled={ordersQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void ordersQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                ordersQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Orders"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint="Try a different search term or clear the active filters."
        emptyMessage="No orders match these filters"
        errorMessage="Could not load orders."
        filters={
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">City</span>
              <input
                className={filterControlClass}
                placeholder="Any city"
                value={city}
                onChange={(event) => {
                  setCity(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Created from</span>
                <input
                  className={filterControlClass}
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Created to</span>
                <input
                  className={filterControlClass}
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
            </div>
          </>
        }
        getRowId={(order) => order.orderId}
        isError={ordersQuery.isError}
        isLoading={ordersQuery.isLoading}
        pagination={{
          page,
          pageSize: limit,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        queueTabs={queueTabs}
        rowActions={(order) => (
          <RowActions
            canRefundPayments={canRefundPayments}
            canUpdateOrders={canUpdateOrders}
            order={order}
            onAction={openAction}
          />
        )}
        rowActionsWidth={130}
        rows={orders}
        search={search}
        searchPlaceholder="Search order, customer, vendor…"
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          ),
        }}
        storageKey={ORDER_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as OrderQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setCity('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        onRetry={() => void ordersQuery.refetch()}
        onRowClick={(order) => navigate(`${routePaths.orders}/${order.orderId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

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
          onSubmit={(values) =>
            void actionMutation.mutateAsync({ target: actionTarget, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
