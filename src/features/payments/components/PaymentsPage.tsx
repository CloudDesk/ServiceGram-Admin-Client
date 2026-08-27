import { Download, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { paymentService } from '../services/payment.service'
import {
  canReconcilePayment,
  formatDateSafe,
  formatPaise,
  getPaymentStatusTone,
  humanizeCode,
  paymentReviewStatuses,
  paymentSignal,
  type PaymentTone,
} from '../paymentPresenters'
import type {
  AdminPaymentStatus,
  AdminPaymentSummary,
  AdminPaymentsQueryParams,
} from '../types/payment.types'
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from './PaymentActionModal'

const PAYMENT_LIST_STORAGE_KEY = 'servicegram.payments.list.v1'
const DEFAULT_PAGE_SIZE = 50

type PaymentQueueKey = 'all' | 'needsReview' | 'successful' | 'failed' | 'cancelled'

const PAYMENT_QUEUES: Record<
  PaymentQueueKey,
  { label: string; status?: AdminPaymentStatus[]; tone?: 'neutral' | 'warning' | 'danger' }
> = {
  all: { label: 'All' },
  needsReview: { label: 'Needs review', status: paymentReviewStatuses, tone: 'warning' },
  successful: { label: 'Successful', status: ['SUCCESS'] },
  failed: { label: 'Failed', status: ['FAILED'], tone: 'danger' },
  cancelled: { label: 'Cancelled', status: ['CANCELLED'], tone: 'danger' },
}

function badgeTone(tone: PaymentTone) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

export function PaymentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReconcile = usePermission('payments:reconcile')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<PaymentQueueKey>('all')
  const [city, setCity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<PaymentActionSelection | null>(null)

  const query = useMemo<AdminPaymentsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: PAYMENT_QUEUES[queue].status,
      city: city.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [city, dateFrom, dateTo, limit, page, queue, search],
  )

  const paymentsQuery = useQuery({
    queryKey: ['payments', query],
    queryFn: () => paymentService.getPaymentList(query),
  })

  const payments = useMemo(
    () => paymentsQuery.data?.data ?? [],
    [paymentsQuery.data],
  )
  const pagination = paymentsQuery.data?.pagination

  /** Queue counts span the result set, not the page. */
  const summaryQuery = useQuery({
    queryKey: [
      'payments',
      'queue-counts',
      { city: city.trim(), dateFrom, dateTo, search: search.trim() },
    ],
    queryFn: () =>
      paymentService.getPaymentList({
        page: 1,
        limit: 1,
        search: search.trim() || undefined,
        city: city.trim() || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    placeholderData: (previousData) => previousData,
  })

  const summary = summaryQuery.data?.summary
  const queueSummary = summary?.queueSummary

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: queueSummary?.allPayments ?? summary?.total },
    {
      key: 'needsReview',
      label: 'Needs review',
      count: queueSummary?.needsReview,
      tone: 'warning',
    },
    {
      key: 'successful',
      label: 'Successful',
      count: queueSummary?.successful ?? summary?.successful,
    },
    {
      key: 'failed',
      label: 'Failed',
      count: queueSummary?.failed ?? summary?.failed,
      tone: 'danger',
    },
    {
      key: 'cancelled',
      label: 'Cancelled',
      count: queueSummary?.cancelled ?? summary?.cancelled,
      tone: 'danger',
    },
  ]

  const appliedFilterCount = [city.trim(), dateFrom, dateTo].filter(Boolean).length

  const clearSeededParams = () => {
    const seededKeys = ['search', 'status', 'method', 'gateway', 'orderId', 'customerId', 'vendorId']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
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
      setActionError(error instanceof Error ? error.message : 'Payment action failed.')
    },
  })

  const columns: DataListColumn<AdminPaymentSummary>[] = useMemo(
    () => [
      {
        id: 'payment',
        label: 'Payment',
        defaultWidth: 200,
        minWidth: 160,
        priority: 1,
        grow: true,
        locked: true,
        render: (payment) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">
              {payment.publicPaymentId}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {formatDateSafe(payment.createdAt)}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        defaultWidth: 110,
        minWidth: 96,
        priority: 1,
        render: (payment) => (
          <Badge tone={badgeTone(getPaymentStatusTone(payment.status))}>
            {humanizeCode(payment.status)}
          </Badge>
        ),
      },
      {
        id: 'signal',
        label: 'Signal',
        defaultWidth: 150,
        minWidth: 120,
        priority: 1,
        render: (payment) => {
          const signal = paymentSignal(payment)

          if (!signal) return <span className="text-muted">—</span>

          return (
            <span
              className={cn(
                'truncate text-xs',
                signal.tone === 'danger' && 'text-danger',
                signal.tone === 'warning' && 'text-warning',
              )}
              title={signal.label}
            >
              {signal.label}
            </span>
          )
        },
      },
      {
        id: 'amount',
        label: 'Amount',
        defaultWidth: 100,
        minWidth: 88,
        priority: 2,
        align: 'right',
        render: (payment) => <span>{formatPaise(payment.amountPaise)}</span>,
      },
      {
        id: 'method',
        label: 'Method',
        defaultWidth: 110,
        minWidth: 96,
        priority: 2,
        render: (payment) => (
          <span className="truncate text-muted">{humanizeCode(payment.method)}</span>
        ),
      },
      {
        id: 'order',
        label: 'Order',
        defaultWidth: 160,
        minWidth: 130,
        priority: 2,
        render: (payment) => (
          <span className="truncate text-muted">
            {payment.order?.publicOrderId ?? '—'}
          </span>
        ),
      },
      {
        id: 'refunds',
        label: 'Refunds',
        defaultWidth: 90,
        minWidth: 80,
        priority: 3,
        align: 'right',
        render: (payment) => (
          <span
            className={cn(
              'tabular-nums',
              payment.refundSummary.requestedCount > 0 && 'text-warning',
            )}
          >
            {payment.refundSummary.refundCount || '—'}
          </span>
        ),
      },
      {
        id: 'parties',
        label: 'Customer',
        defaultWidth: 150,
        minWidth: 120,
        priority: 3,
        render: (payment) => (
          <span className="truncate text-muted">
            {payment.customer?.fullName ?? '—'}
          </span>
        ),
      },
      {
        id: 'gateway',
        label: 'Gateway',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (payment) => (
          <span className="truncate text-muted">{humanizeCode(payment.gateway)}</span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (payment) => (
          <span className="text-muted">{formatDateSafe(payment.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedPayments = useMemo(
    () => payments.filter((payment) => selectedIds.includes(payment.paymentId)),
    [payments, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('payments'), selectedPayments, [
      { header: 'Payment ID', value: (payment) => payment.publicPaymentId },
      { header: 'Created', value: (payment) => payment.createdAt },
      { header: 'Status', value: (payment) => payment.status },
      { header: 'Method', value: (payment) => payment.method },
      { header: 'Gateway', value: (payment) => payment.gateway },
      { header: 'Amount (INR)', value: (payment) => (payment.amountPaise ?? 0) / 100 },
      { header: 'Order', value: (payment) => payment.order?.publicOrderId ?? '' },
      { header: 'Customer', value: (payment) => payment.customer?.fullName ?? '' },
      { header: 'Vendor', value: (payment) => payment.vendor?.shopName ?? '' },
      { header: 'Refunds', value: (payment) => payment.refundSummary.refundCount },
      {
        header: 'Refund requests',
        value: (payment) => payment.refundSummary.requestedCount,
      },
      { header: 'Failure code', value: (payment) => payment.failureCode ?? '' },
      { header: 'Signals', value: (payment) => payment.warnings.join('; ') },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh payments"
            className="h-9"
            disabled={paymentsQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void paymentsQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                paymentsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Payments"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint="Try a different search term or clear the active filters."
        emptyMessage="No payments match these filters"
        errorMessage="Could not load payments."
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
                <span className="mb-1 block text-xs font-medium text-muted">From</span>
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
                <span className="mb-1 block text-xs font-medium text-muted">To</span>
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
        getRowId={(payment) => payment.paymentId}
        isError={paymentsQuery.isError}
        isLoading={paymentsQuery.isLoading}
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
        rowActions={(payment) =>
          canReconcile && canReconcilePayment(payment) ? (
            <Button
              className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
              size="xs"
              type="button"
              variant="primary"
              onClick={() => {
                setActionError(null)
                setActionTarget({ kind: 'RECONCILE_PAYMENT', payment })
              }}
            >
              Reconcile
            </Button>
          ) : null
        }
        rowActionsWidth={104}
        rows={payments}
        search={search}
        searchPlaceholder="Search payment, order, customer…"
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
        storageKey={PAYMENT_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as PaymentQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setCity('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        onRetry={() => void paymentsQuery.refetch()}
        onRowClick={(payment) =>
          navigate(`${routePaths.payments}/${payment.paymentId}`)
        }
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {actionTarget ? (
        <PaymentActionModal
          action={actionTarget}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionTarget(null)
              setActionError(null)
            }
          }}
          onSubmit={(values) =>
            void actionMutation.mutateAsync({ action: actionTarget, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
