import { Download, MoreHorizontal, Plus, RefreshCcw } from 'lucide-react'
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
import { payoutService } from '../services/payout.service'
import {
  formatDateSafe,
  formatPaise,
  getOverflowActions,
  getPayoutStatusTone,
  getRowPrimaryAction,
  humanizeCode,
  isDestructivePayoutAction,
  payoutActionLabel,
  payoutSignal,
  type PayoutTone,
} from '../payoutPresenters'
import type {
  AdminPayoutStatus,
  AdminPayoutSummary,
  AdminPayoutsQueryParams,
} from '../types/payout.types'
import {
  PayoutActionModal,
  type PayoutActionFormValues,
  type PayoutActionKind,
  type PayoutActionSelection,
} from './PayoutActionModal'

const PAYOUT_LIST_STORAGE_KEY = 'servicegram.payouts.list.v1'
const DEFAULT_PAGE_SIZE = 50

type PayoutQueueKey =
  | 'all'
  | 'review'
  | 'held'
  | 'approved'
  | 'paid'
  | 'exceptions'

const PAYOUT_QUEUES: Record<
  PayoutQueueKey,
  {
    label: string
    status?: AdminPayoutStatus[]
    tone?: 'neutral' | 'warning' | 'danger'
  }
> = {
  all: { label: 'All' },
  review: {
    label: 'Needs review',
    status: ['PENDING', 'UNDER_REVIEW'],
    tone: 'warning',
  },
  held: { label: 'Held', status: ['HELD'], tone: 'warning' },
  approved: { label: 'Approved', status: ['APPROVED'] },
  paid: { label: 'Paid', status: ['PAID'] },
  exceptions: {
    label: 'Exceptions',
    status: ['FAILED', 'CANCELLED'],
    tone: 'danger',
  },
}

function badgeTone(tone: PayoutTone) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

interface RowActionsProps {
  payout: AdminPayoutSummary
  canApprovePayouts: boolean
  isSubmitting: boolean
  onAction: (kind: PayoutActionKind, payout: AdminPayoutSummary) => void
}

function RowActions({
  canApprovePayouts,
  isSubmitting,
  onAction,
  payout,
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

  if (!canApprovePayouts) return null

  const primary = getRowPrimaryAction(payout)
  const overflow = getOverflowActions(payout, primary)

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {primary ? (
        <Button
          className="h-7 whitespace-nowrap px-2 text-xs"
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="primary"
          onClick={() => onAction(primary, payout)}
        >
          {payoutActionLabel(primary)}
        </Button>
      ) : null}

      {overflow.length ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for ${payout.publicPayoutId}`}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-4" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              {overflow.map((kind) => (
                <button
                  className={cn(
                    'flex w-full items-center rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                    isDestructivePayoutAction(kind) && 'text-danger hover:bg-danger/10',
                  )}
                  disabled={isSubmitting}
                  key={kind}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onAction(kind, payout)
                  }}
                >
                  {payoutActionLabel(kind)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function PayoutsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canApprovePayouts = usePermission('payouts:approve')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<PayoutQueueKey>('all')
  const [city, setCity] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<PayoutActionSelection | null>(null)

  const query = useMemo<AdminPayoutsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: PAYOUT_QUEUES[queue].status,
      city: city.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [city, dateFrom, dateTo, limit, page, queue, search],
  )

  const payoutsQuery = useQuery({
    queryKey: ['payouts', query],
    queryFn: () => payoutService.getPayoutList(query),
  })

  const payouts = useMemo(() => payoutsQuery.data?.data ?? [], [payoutsQuery.data])
  const pagination = payoutsQuery.data?.pagination

  const countBase = useMemo<AdminPayoutsQueryParams>(
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
    queryKey: ['payouts', 'queue-counts', countBase],
    queryFn: () => payoutService.getPayoutList(countBase),
    placeholderData: (previousData) => previousData,
  })

  const summary = summaryQuery.data?.summary

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: summary?.total },
    {
      key: 'review',
      label: 'Needs review',
      count: (summary?.pending ?? 0) + (summary?.underReview ?? 0),
      tone: 'warning',
    },
    { key: 'held', label: 'Held', count: summary?.held, tone: 'warning' },
    { key: 'approved', label: 'Approved', count: summary?.approved },
    { key: 'paid', label: 'Paid', count: summary?.paid },
    {
      key: 'exceptions',
      label: 'Exceptions',
      count: (summary?.failed ?? 0) + (summary?.cancelled ?? 0),
      tone: 'danger',
    },
  ]

  const clearSeededParams = () => {
    const seededKeys = ['search', 'status', 'payoutMethod', 'vendorId']
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
      action: PayoutActionSelection
      values: PayoutActionFormValues
    }) => {
      if (!values.reason) {
        throw new Error('A reason is required for this action.')
      }

      if (action.kind === 'CREATE') {
        return payoutService.createPayout({
          vendorId: values.vendorId as string,
          earningIds: values.earningIds,
          payoutMethod: values.payoutMethod,
          reason: values.reason,
        })
      }

      if (!action.payout) throw new Error('Payout is required for this action.')

      if (action.kind === 'APPROVE') {
        return payoutService.approvePayout(action.payout.payoutId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        })
      }

      if (action.kind === 'HOLD') {
        return payoutService.holdPayout(action.payout.payoutId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'RELEASE_HOLD') {
        return payoutService.releasePayoutHold(action.payout.payoutId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'MARK_PAID') {
        if (!values.utrReference) throw new Error('UTR reference is required.')

        return payoutService.markPayoutPaid(action.payout.payoutId, {
          paidAt: values.paidAt,
          reason: values.reason,
          utrReference: values.utrReference,
        })
      }

      if (action.kind === 'MARK_FAILED') {
        return payoutService.markPayoutFailed(action.payout.payoutId, {
          reason: values.reason,
        })
      }

      throw new Error('Unsupported payout action.')
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['payouts'] })
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Payout action failed.')
    },
  })

  const columns: DataListColumn<AdminPayoutSummary>[] = useMemo(
    () => [
      {
        id: 'payout',
        label: 'Payout',
        defaultWidth: 200,
        minWidth: 160,
        priority: 1,
        grow: true,
        locked: true,
        render: (payout) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="max-w-[60%] shrink-0 truncate font-medium text-foreground">
              {payout.publicPayoutId}
            </span>
            <span className="min-w-0 truncate text-xs text-muted">
              {formatDateSafe(payout.createdAt)}
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
        render: (payout) => (
          <Badge tone={badgeTone(getPayoutStatusTone(payout.status))}>
            {humanizeCode(payout.status)}
          </Badge>
        ),
      },
      {
        id: 'signal',
        label: 'Signal',
        defaultWidth: 150,
        minWidth: 120,
        priority: 1,
        render: (payout) => {
          const signal = payoutSignal(payout)

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
        id: 'vendor',
        label: 'Vendor',
        defaultWidth: 160,
        minWidth: 130,
        priority: 2,
        render: (payout) => (
          <span className="truncate text-foreground">
            {payout.vendor?.shopName ?? '—'}
          </span>
        ),
      },
      {
        id: 'amount',
        label: 'Amount',
        defaultWidth: 100,
        minWidth: 88,
        priority: 2,
        align: 'right',
        render: (payout) => <span>{formatPaise(payout.totalAmountPaise)}</span>,
      },
      {
        id: 'items',
        label: 'Items',
        defaultWidth: 72,
        minWidth: 64,
        priority: 3,
        align: 'right',
        render: (payout) => (
          <span className="text-muted">{payout.itemSummary?.itemCount ?? 0}</span>
        ),
      },
      {
        id: 'utr',
        label: 'UTR',
        defaultWidth: 140,
        minWidth: 110,
        priority: 3,
        render: (payout) => (
          <span className="truncate text-muted" title={payout.utrReference ?? undefined}>
            {payout.utrReference ?? '—'}
          </span>
        ),
      },
      {
        id: 'method',
        label: 'Method',
        defaultWidth: 140,
        minWidth: 110,
        priority: 4,
        defaultHidden: true,
        render: (payout) => (
          <span className="truncate text-muted">
            {humanizeCode(payout.payoutMethod)}
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
        render: (payout) => (
          <span className="text-muted">{formatDateSafe(payout.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedPayouts = useMemo(
    () => payouts.filter((payout) => selectedIds.includes(payout.payoutId)),
    [payouts, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('payouts'), selectedPayouts, [
      { header: 'Payout ID', value: (payout) => payout.publicPayoutId },
      { header: 'Created', value: (payout) => payout.createdAt },
      { header: 'Status', value: (payout) => payout.status },
      { header: 'Method', value: (payout) => payout.payoutMethod },
      { header: 'Vendor', value: (payout) => payout.vendor?.shopName ?? '' },
      {
        header: 'Total (INR)',
        value: (payout) => (payout.totalAmountPaise ?? 0) / 100,
      },
      {
        header: 'Net payable (INR)',
        value: (payout) => (payout.itemSummary?.netPayablePaise ?? 0) / 100,
      },
      { header: 'Items', value: (payout) => payout.itemSummary?.itemCount ?? 0 },
      { header: 'UTR', value: (payout) => payout.utrReference ?? '' },
      { header: 'Paid at', value: (payout) => payout.paidAt ?? '' },
      { header: 'Hold reason', value: (payout) => payout.holdReason ?? '' },
      { header: 'Failure reason', value: (payout) => payout.failureReason ?? '' },
      { header: 'Signals', value: (payout) => payout.warnings.join('; ') },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <div className="flex items-center gap-2">
            <Button
              aria-label="Refresh payouts"
              className="h-9"
              disabled={payoutsQuery.isLoading}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void payoutsQuery.refetch()}
            >
              <RefreshCcw
                className={cn(
                  'size-4 sm:mr-2',
                  payoutsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
                )}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {canApprovePayouts ? (
              <Button
                className="h-9"
                size="sm"
                type="button"
                variant="primary"
                onClick={() => {
                  setActionError(null)
                  setSelectedAction({ kind: 'CREATE' })
                }}
              >
                <Plus className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            ) : null}
          </div>
        }
        layout="workspace"
        placement="topbar"
        title="Payouts"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={[city.trim(), dateFrom, dateTo].filter(Boolean).length}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No payouts match these filters"
        errorMessage="Could not load payouts."
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
        getRowId={(payout) => payout.payoutId}
        isError={payoutsQuery.isError}
        isLoading={payoutsQuery.isLoading}
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
        rowActions={(payout) => (
          <RowActions
            canApprovePayouts={canApprovePayouts}
            isSubmitting={mutation.isPending}
            payout={payout}
            onAction={(kind, target) => {
              setActionError(null)
              setSelectedAction({ kind, payout: target })
            }}
          />
        )}
        rowActionsWidth={140}
        rows={payouts}
        search={search}
        searchPlaceholder="Search payout, UTR, vendor…"
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
        storageKey={PAYOUT_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as PayoutQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setCity('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        onRetry={() => void payoutsQuery.refetch()}
        onRowClick={(payout) => navigate(`${routePaths.payouts}/${payout.payoutId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {selectedAction ? (
        <PayoutActionModal
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
