import { Download, MoreHorizontal, RefreshCcw } from 'lucide-react'
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
import { paymentService } from '../services/payment.service'
import {
  canApproveRefund,
  canRejectRefund,
  formatDateSafe,
  formatPaise,
  getRefundStatusTone,
  humanizeCode,
  refundSignal,
  type PaymentTone,
} from '../paymentPresenters'
import type {
  AdminRefundStatus,
  AdminRefundSummary,
  AdminRefundsQueryParams,
} from '../types/payment.types'
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from './PaymentActionModal'

const REFUND_LIST_STORAGE_KEY = 'servicegram.refunds.list.v1'
const DEFAULT_PAGE_SIZE = 50

type RefundQueueKey =
  | 'all'
  | 'requested'
  | 'approved'
  | 'processing'
  | 'successful'
  | 'exceptions'

const REFUND_QUEUES: Record<
  RefundQueueKey,
  {
    label: string
    status?: AdminRefundStatus[]
    tone?: 'neutral' | 'warning' | 'danger'
  }
> = {
  all: { label: 'All' },
  requested: { label: 'Requested', status: ['REQUESTED'], tone: 'warning' },
  approved: { label: 'Approved', status: ['APPROVED'] },
  processing: { label: 'Processing', status: ['PROCESSING'], tone: 'warning' },
  successful: { label: 'Successful', status: ['SUCCESS'] },
  exceptions: {
    label: 'Exceptions',
    status: ['FAILED', 'REJECTED'],
    tone: 'danger',
  },
}

function badgeTone(tone: PaymentTone) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

interface RowActionsProps {
  refund: AdminRefundSummary
  canReviewRefunds: boolean
  isSubmitting: boolean
  onAction: (action: PaymentActionSelection) => void
}

/**
 * Approve is constructive and gets the row button. Reject denies money back to
 * a customer, so it stays behind the overflow.
 */
function RowActions({
  canReviewRefunds,
  isSubmitting,
  onAction,
  refund,
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

  const showApprove = canReviewRefunds && canApproveRefund(refund)
  const showReject = canReviewRefunds && canRejectRefund(refund)

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {showApprove ? (
        <Button
          className="h-7 whitespace-nowrap px-2 text-xs"
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="primary"
          onClick={() => onAction({ kind: 'APPROVE_REFUND', refund })}
        >
          Approve
        </Button>
      ) : null}

      {showReject ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for refund ${refund.refundId}`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-4" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[10rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              <button
                className="flex w-full items-center rounded-[0.45rem] px-2 py-1.5 text-left text-sm text-danger transition hover:bg-danger/10"
                disabled={isSubmitting}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  onAction({ kind: 'REJECT_REFUND', refund })
                }}
              >
                Reject refund
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function RefundsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReviewRefunds = usePermission('payments:refund')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<RefundQueueKey>('all')
  const [city, setCity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<PaymentActionSelection | null>(null)

  const query = useMemo<AdminRefundsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: REFUND_QUEUES[queue].status,
      city: city.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [city, dateFrom, dateTo, limit, page, queue, search],
  )

  const refundsQuery = useQuery({
    queryKey: ['refunds', query],
    queryFn: () => paymentService.getRefundList(query),
  })

  const refunds = useMemo(() => refundsQuery.data?.data ?? [], [refundsQuery.data])
  const pagination = refundsQuery.data?.pagination

  const countBase = useMemo<AdminRefundsQueryParams>(
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

  /** Queue counts span the result set, not the page. */
  const summaryQuery = useQuery({
    queryKey: ['refunds', 'queue-counts', countBase],
    queryFn: () => paymentService.getRefundList(countBase),
    placeholderData: (previousData) => previousData,
  })

  const summary = summaryQuery.data?.summary

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: summary?.total },
    {
      key: 'requested',
      label: 'Requested',
      count: summary?.requested,
      tone: 'warning',
    },
    { key: 'approved', label: 'Approved', count: summary?.approved },
    {
      key: 'processing',
      label: 'Processing',
      count: summary?.processing,
      tone: 'warning',
    },
    { key: 'successful', label: 'Successful', count: summary?.successful },
    {
      key: 'exceptions',
      label: 'Exceptions',
      count: (summary?.failed ?? 0) + (summary?.rejected ?? 0),
      tone: 'danger',
    },
  ]

  const clearSeededParams = () => {
    const seededKeys = ['search', 'status', 'paymentId', 'orderId', 'customerId', 'vendorId']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
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
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['refunds'] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Refund action failed.')
    },
  })

  const columns: DataListColumn<AdminRefundSummary>[] = useMemo(
    () => [
      {
        id: 'refund',
        label: 'Refund',
        defaultWidth: 200,
        minWidth: 160,
        priority: 1,
        grow: true,
        locked: true,
        render: (refund) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="max-w-[60%] shrink-0 truncate font-medium text-foreground">
              {refund.publicPaymentId}
            </span>
            <span className="min-w-0 truncate text-xs text-muted">
              {formatDateSafe(refund.createdAt)}
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
        render: (refund) => (
          <Badge tone={badgeTone(getRefundStatusTone(refund.status))}>
            {humanizeCode(refund.status)}
          </Badge>
        ),
      },
      {
        id: 'signal',
        label: 'Signal',
        defaultWidth: 150,
        minWidth: 120,
        priority: 1,
        render: (refund) => {
          const signal = refundSignal(refund)

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
        render: (refund) => <span>{formatPaise(refund.amountPaise)}</span>,
      },
      {
        id: 'payment',
        label: 'Payment',
        defaultWidth: 100,
        minWidth: 88,
        priority: 2,
        align: 'right',
        render: (refund) => (
          <span className="text-muted">{formatPaise(refund.payment.amountPaise)}</span>
        ),
      },
      {
        id: 'customer',
        label: 'Customer',
        defaultWidth: 150,
        minWidth: 120,
        priority: 2,
        render: (refund) => (
          <span className="truncate text-muted">
            {refund.customer?.fullName ?? '—'}
          </span>
        ),
      },
      {
        id: 'reason',
        label: 'Reason',
        defaultWidth: 180,
        minWidth: 140,
        priority: 3,
        render: (refund) => (
          <span className="truncate text-muted" title={refund.reason}>
            {refund.reason || '—'}
          </span>
        ),
      },
      {
        id: 'order',
        label: 'Order',
        defaultWidth: 150,
        minWidth: 120,
        priority: 3,
        defaultHidden: true,
        render: (refund) => (
          <span className="truncate text-muted">
            {refund.order?.publicOrderId ?? '—'}
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
        render: (refund) => (
          <span className="text-muted">{formatDateSafe(refund.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedRefunds = useMemo(
    () => refunds.filter((refund) => selectedIds.includes(refund.refundId)),
    [refunds, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('refunds'), selectedRefunds, [
      { header: 'Refund ID', value: (refund) => refund.refundId },
      { header: 'Payment', value: (refund) => refund.publicPaymentId },
      { header: 'Created', value: (refund) => refund.createdAt },
      { header: 'Status', value: (refund) => refund.status },
      { header: 'Amount (INR)', value: (refund) => (refund.amountPaise ?? 0) / 100 },
      {
        header: 'Payment amount (INR)',
        value: (refund) => (refund.payment.amountPaise ?? 0) / 100,
      },
      { header: 'Reason', value: (refund) => refund.reason },
      { header: 'Rejection reason', value: (refund) => refund.rejectionReason ?? '' },
      { header: 'Order', value: (refund) => refund.order?.publicOrderId ?? '' },
      { header: 'Customer', value: (refund) => refund.customer?.fullName ?? '' },
      { header: 'Vendor', value: (refund) => refund.vendor?.shopName ?? '' },
      { header: 'Signals', value: (refund) => refund.warnings.join('; ') },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh refunds"
            className="h-9"
            disabled={refundsQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void refundsQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                refundsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Refunds"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={[city.trim(), dateFrom, dateTo].filter(Boolean).length}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No refunds match these filters"
        errorMessage="Could not load refunds."
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
        getRowId={(refund) => refund.refundId}
        isError={refundsQuery.isError}
        isLoading={refundsQuery.isLoading}
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
        rowActions={(refund) => (
          <RowActions
            canReviewRefunds={canReviewRefunds}
            isSubmitting={mutation.isPending}
            refund={refund}
            onAction={(action) => {
              setActionError(null)
              setSelectedAction(action)
            }}
          />
        )}
        rowActionsWidth={110}
        rows={refunds}
        search={search}
        searchPlaceholder="Search refund, payment, customer…"
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
        storageKey={REFUND_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as RefundQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setCity('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        onRetry={() => void refundsQuery.refetch()}
        onRowClick={(refund) => navigate(`${routePaths.refunds}/${refund.refundId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {selectedAction ? (
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
          onSubmit={(values) =>
            void mutation.mutateAsync({ action: selectedAction, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
