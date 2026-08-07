import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Filter,
  HandCoins,
  PauseCircle,
  Plus,
  RefreshCcw,
  ReceiptText,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  X,
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
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { readLookupOptionsFromSearchParams } from '../../../utils/buildQueryParams'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { searchVendorLookupOptions } from '../../lookups/adminLookups'
import { payoutService } from '../services/payout.service'
import {
  PayoutActionModal,
  type PayoutActionFormValues,
  type PayoutActionKind,
  type PayoutActionSelection,
} from './PayoutActionModal'
import type {
  AdminPayoutChildSummary,
  AdminPayoutMethod,
  AdminPayoutPagination,
  AdminPayoutStatus,
  AdminPayoutSummary,
  AdminPayoutsQueryParams,
} from '../types/payout.types'

const DEFAULT_PAGE_SIZE = 10
const PAYOUT_DEFAULT_COLUMN_WIDTH = 220
const PAYOUT_GRID_COLUMN_GAP = 12
const PAYOUT_GRID_INLINE_PADDING = 24
const PAYOUT_ACTION_COLUMN_ID = 'actions'
const PAYOUT_ACTION_COLUMN_DEFAULT_WIDTH = 112
const PAYOUT_ACTION_COLUMN_MIN_WIDTH = 96
const PAYOUT_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.payout.columnWidths.v1'

const payoutStatuses: AdminPayoutStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'HELD',
  'APPROVED',
  'PAID',
  'FAILED',
  'ADJUSTED',
  'CANCELLED',
]

const payoutMethods: AdminPayoutMethod[] = [
  'MANUAL_BANK_TRANSFER',
  'UPI',
  'OTHER',
]

const payoutDataColumns = [
  {
    id: 'payout',
    label: 'Payout',
    defaultWidth: PAYOUT_DEFAULT_COLUMN_WIDTH,
    minWidth: 190,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 185,
    minWidth: 150,
  },
  {
    id: 'vendor',
    label: 'Vendor',
    defaultWidth: 250,
    minWidth: 210,
  },
  {
    id: 'amount',
    label: 'Amount',
    defaultWidth: 170,
    minWidth: 145,
  },
  {
    id: 'method',
    label: 'Method',
    defaultWidth: 200,
    minWidth: 160,
  },
  {
    id: 'items',
    label: 'Items',
    defaultWidth: 210,
    minWidth: 170,
  },
  {
    id: 'settlement',
    label: 'Settlement',
    defaultWidth: 220,
    minWidth: 180,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: 170,
    minWidth: 150,
  },
] as const

type PayoutTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type PayoutColumnId = (typeof payoutDataColumns)[number]['id']
type PayoutColumnWidthId = PayoutColumnId | typeof PAYOUT_ACTION_COLUMN_ID
type PayoutColumnWidths = Partial<Record<PayoutColumnWidthId, number>>
type PayoutQueueKey =
  | 'all'
  | 'review'
  | 'held'
  | 'approved'
  | 'paid'
  | 'exceptions'
type PayoutPreviewTab = 'summary' | 'vendor' | 'settlement'

const payoutActionKinds: PayoutActionKind[] = [
  'APPROVE',
  'MARK_PAID',
  'RELEASE_HOLD',
  'HOLD',
  'MARK_FAILED',
]

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

function queueKeyForPayoutStatuses(
  selectedStatuses: AdminPayoutStatus[],
): PayoutQueueKey {
  if (selectedStatuses.length === 0) return 'all'
  if (
    selectedStatuses.every((status) => ['PENDING', 'UNDER_REVIEW'].includes(status))
  ) {
    return 'review'
  }
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'HELD') {
    return 'held'
  }
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'APPROVED') {
    return 'approved'
  }
  if (selectedStatuses.length === 1 && selectedStatuses[0] === 'PAID') {
    return 'paid'
  }
  if (
    selectedStatuses.every((status) => ['FAILED', 'CANCELLED'].includes(status))
  ) {
    return 'exceptions'
  }

  return 'all'
}

const defaultPayoutColumns: PayoutColumnId[] = [
  'payout',
  'status',
  'vendor',
  'amount',
  'method',
  'items',
  'settlement',
]

interface PayoutGridStyle extends CSSProperties {
  '--payout-grid-template': string
  '--payout-grid-min-width': string
}

interface PayoutMetric {
  label: string
  meta: string
  tone: PayoutTone
  value: string
}

function toneClasses(tone: PayoutTone) {
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

function getPayoutStatusTone(status: AdminPayoutStatus): PayoutTone {
  if (status === 'PAID') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'HELD') return 'danger'
  if (status === 'APPROVED') return 'info'
  if (status === 'PENDING' || status === 'UNDER_REVIEW') return 'warning'
  return 'neutral'
}

function isPayoutActionKind(
  action: string | null | undefined,
): action is PayoutActionKind {
  return Boolean(
    action && payoutActionKinds.includes(action as PayoutActionKind),
  )
}

function getPrimaryPayoutActionKind(payout: AdminPayoutSummary) {
  if (
    isPayoutActionKind(payout.nextRecommendedAction) &&
    payout.availableActions.includes(payout.nextRecommendedAction)
  ) {
    return payout.nextRecommendedAction
  }

  return (
    payoutActionKinds.find((action) => payout.availableActions.includes(action)) ??
    null
  )
}

function payoutActionIcon(action: PayoutActionKind) {
  if (action === 'APPROVE') return <CheckCircle2 className="size-4" />
  if (action === 'MARK_PAID') return <CircleDollarSign className="size-4" />
  if (action === 'RELEASE_HOLD') return <RefreshCcw className="size-4" />
  if (action === 'HOLD') return <PauseCircle className="size-4" />
  if (action === 'MARK_FAILED') return <XCircle className="size-4" />
  return <Plus className="size-4" />
}

function payoutActionVariant(action: PayoutActionKind) {
  return action === 'MARK_FAILED' ? 'danger' : 'secondary'
}

function payoutRowActionClass(action: PayoutActionKind) {
  if (action === 'APPROVE' || action === 'MARK_PAID') {
    return 'text-success hover:text-success'
  }

  if (action === 'MARK_FAILED' || action === 'HOLD') {
    return 'text-danger hover:text-danger'
  }

  return ''
}

function payoutSignalTone(payout: AdminPayoutSummary): PayoutTone {
  if (payout.status === 'FAILED' || payout.status === 'CANCELLED') return 'danger'
  if (payout.status === 'HELD') return 'danger'
  if (payout.warnings.length > 0) return 'warning'
  if (payout.status === 'PAID') return 'success'
  if (payout.status === 'APPROVED') return 'info'
  if (payout.status === 'PENDING' || payout.status === 'UNDER_REVIEW') {
    return 'warning'
  }

  return 'neutral'
}

function payoutSignalLabel(payout: AdminPayoutSummary) {
  if (payout.status === 'FAILED') return 'Settlement failed'
  if (payout.status === 'CANCELLED') return 'Payout cancelled'
  if (payout.status === 'HELD') return 'Hold active'
  if (payout.warnings.length > 0) return 'Review warnings'
  if (payout.status === 'APPROVED') return 'Ready to pay'
  if (payout.status === 'PAID') return 'Paid'
  if (payout.status === 'PENDING' || payout.status === 'UNDER_REVIEW') {
    return 'Needs approval'
  }

  return 'Payout state'
}

function payoutSignalMeta(payout: AdminPayoutSummary) {
  if (payout.failureReason) return humanizeCode(payout.failureReason)
  if (payout.holdReason) return humanizeCode(payout.holdReason)
  if (payout.nextRecommendedAction) {
    return `Next: ${humanizeCode(payout.nextRecommendedAction)}`
  }
  if (payout.paidAt) return `Paid ${formatDateSafe(payout.paidAt)}`
  return 'No immediate backend action is recommended.'
}

function buildPayoutMetrics(
  payouts: AdminPayoutSummary[],
  pagination?: AdminPayoutPagination,
  summary?: AdminPayoutChildSummary,
): PayoutMetric[] {
  const total = pagination?.totalItems ?? summary?.total ?? payouts.length
  const needsReview =
    summary?.needsAttention ??
    payouts.filter((payout) =>
      ['PENDING', 'UNDER_REVIEW', 'HELD'].includes(payout.status),
    ).length
  const approved =
    summary?.approved ??
    payouts.filter((payout) => payout.status === 'APPROVED').length
  const paidValue =
    summary?.paidAmountPaise ??
    payouts
      .filter((payout) => payout.status === 'PAID')
      .reduce((sum, payout) => sum + payout.totalAmountPaise, 0)

  return [
    {
      label: 'Visible review',
      meta: 'Pending, held, failed, or warning payouts',
      tone: needsReview > 0 ? 'warning' : 'neutral',
      value: String(needsReview),
    },
    {
      label: 'Ready to pay',
      meta: 'Approved payouts matching filters',
      tone: approved > 0 ? 'info' : 'neutral',
      value: String(approved),
    },
    {
      label: 'Paid value',
      meta: 'Paid amount matching filters',
      tone: paidValue > 0 ? 'success' : 'neutral',
      value: formatPaise(paidValue),
    },
    {
      label: 'Matched payouts',
      meta: 'Total matching current filters',
      tone: 'info',
      value: String(total),
    },
  ]
}

function buildPayoutQueueItems(
  summary: AdminPayoutChildSummary | undefined,
  payouts: AdminPayoutSummary[],
) {
  return [
    {
      key: 'all' as const,
      label: 'All payouts',
      count: summary?.total ?? payouts.length,
    },
    {
      key: 'review' as const,
      label: 'Needs review',
      count:
        summary ? summary.pending + summary.underReview : payouts.filter((payout) =>
          ['PENDING', 'UNDER_REVIEW'].includes(payout.status),
        ).length,
    },
    {
      key: 'held' as const,
      label: 'Held',
      count:
        summary?.held ??
        payouts.filter((payout) => payout.status === 'HELD').length,
    },
    {
      key: 'approved' as const,
      label: 'Approved',
      count:
        summary?.approved ??
        payouts.filter((payout) => payout.status === 'APPROVED').length,
    },
    {
      key: 'paid' as const,
      label: 'Paid',
      count:
        summary?.paid ??
        payouts.filter((payout) => payout.status === 'PAID').length,
    },
    {
      key: 'exceptions' as const,
      label: 'Failed / cancelled',
      count:
        summary ? summary.failed + summary.cancelled : payouts.filter((payout) =>
          ['FAILED', 'CANCELLED'].includes(payout.status),
        ).length,
    },
  ]
}

function getPayoutColumnDefaultWidth(columnId: PayoutColumnWidthId) {
  if (columnId === PAYOUT_ACTION_COLUMN_ID) {
    return PAYOUT_ACTION_COLUMN_DEFAULT_WIDTH
  }

  return (
    payoutDataColumns.find((column) => column.id === columnId)?.defaultWidth ??
    PAYOUT_DEFAULT_COLUMN_WIDTH
  )
}

function getPayoutColumnMinWidth(columnId: PayoutColumnWidthId) {
  if (columnId === PAYOUT_ACTION_COLUMN_ID) {
    return PAYOUT_ACTION_COLUMN_MIN_WIDTH
  }

  return payoutDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
}

function getPayoutColumnWidth(
  columnWidths: PayoutColumnWidths,
  columnId: PayoutColumnWidthId,
) {
  return columnWidths[columnId] ?? getPayoutColumnDefaultWidth(columnId)
}

function getPayoutGridTemplate(
  visibleColumns: PayoutColumnId[],
  columnWidths: PayoutColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getPayoutColumnWidth(columnWidths, columnId)}px`,
    ),
    `${getPayoutColumnWidth(columnWidths, PAYOUT_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getPayoutGridMinWidth(
  visibleColumns: PayoutColumnId[],
  columnWidths: PayoutColumnWidths,
) {
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getPayoutColumnWidth(columnWidths, columnId),
    0,
  )
  const actionWidth = getPayoutColumnWidth(columnWidths, PAYOUT_ACTION_COLUMN_ID)
  const columnCount = visibleColumns.length + 2
  const gapWidth = Math.max(0, columnCount - 1) * PAYOUT_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    actionWidth +
    gapWidth +
    PAYOUT_GRID_INLINE_PADDING
  }px`
}

function loadPayoutColumnWidths(): PayoutColumnWidths {
  try {
    const storedValue = window.localStorage.getItem(PAYOUT_COLUMN_WIDTH_STORAGE_KEY)

    if (!storedValue) return {}

    const parsedValue = JSON.parse(storedValue) as PayoutColumnWidths

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, width]) => typeof width === 'number'),
    ) as PayoutColumnWidths
  } catch {
    return {}
  }
}

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return 'Not refreshed yet'

  return `Updated ${formatDate(new Date(updatedAt).toISOString(), true)}`
}

function MetricCard({ label, meta, tone, value }: PayoutMetric) {
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

function PayoutRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid gap-3 border-b border-border px-3 py-4 xl:grid-cols-[1fr_0.8fr_1.2fr_0.8fr_0.9fr_0.9fr_1fr]"
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

function PayoutCell({
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

function PayoutPreviewSignal({
  label,
  meta,
  tone,
}: {
  label: string
  meta: string
  tone: PayoutTone
}) {
  return (
    <div
      className={cn(
        'rounded-[0.75rem] border px-3 py-2.5',
        tone === 'danger' && 'border-danger/20 bg-danger/10',
        tone === 'warning' && 'border-warning/25 bg-warning/10',
        tone === 'success' && 'border-success/20 bg-success/10',
        tone === 'info' && 'border-info/20 bg-info/10',
        tone === 'neutral' && 'border-border bg-surface-muted/45',
      )}
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className={cn('size-4 shrink-0', toneClasses(tone))} />
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1 line-clamp-2 pl-6 text-xs leading-5 text-muted">
        {meta}
      </p>
    </div>
  )
}

function PayoutPreviewField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0 last:pb-0">
      <p className="shrink-0 text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function PayoutPreviewPanel({
  canApprovePayouts,
  canReadVendors,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenDetails,
  onOpenVendor,
  payout,
}: {
  canApprovePayouts: boolean
  canReadVendors: boolean
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (kind: PayoutActionKind, payout: AdminPayoutSummary) => void
  onOpenDetails: (payout: AdminPayoutSummary) => void
  onOpenVendor: (payout: AdminPayoutSummary) => void
  payout: AdminPayoutSummary
}) {
  const [activeTab, setActiveTab] = useState<PayoutPreviewTab>('summary')
  const primaryActionKind = canApprovePayouts
    ? getPrimaryPayoutActionKind(payout)
    : null
  const previewTabs: { key: PayoutPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'settlement', label: 'Settlement' },
  ]
  const primaryAction: QuickPreviewAction | null = primaryActionKind
    ? {
        disabled: isSubmitting,
        icon: payoutActionIcon(primaryActionKind),
        key: primaryActionKind,
        label: humanizeCode(primaryActionKind),
        onClick: () => onOpenAction(primaryActionKind, payout),
        variant: primaryActionKind === 'MARK_FAILED' ? 'danger' : 'primary',
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <Eye className="size-4" />,
    key: 'details',
    label: primaryAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(payout),
  }
  const secondaryActions: QuickPreviewAction[] = []

  if (canApprovePayouts) {
    payoutActionKinds
      .filter(
        (action) =>
          action !== primaryActionKind && payout.availableActions.includes(action),
      )
      .forEach((action) => {
        secondaryActions.push({
          disabled: isSubmitting,
          icon: payoutActionIcon(action),
          key: action,
          label: humanizeCode(action),
          onClick: () => onOpenAction(action, payout),
          variant: payoutActionVariant(action),
        })
      })
  }

  if (canReadVendors) {
    secondaryActions.push({
      icon: <Store className="size-4" />,
      key: 'vendor',
      label: 'Vendor',
      onClick: () => onOpenVendor(payout),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close payout preview"
        className="fixed inset-0 z-40 bg-black/20 2xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface sm:left-auto sm:w-[22rem] 2xl:static 2xl:z-auto 2xl:h-full 2xl:w-[22rem] 2xl:self-stretch">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted">
              Payout preview
            </p>
            <div className="mt-2 flex min-w-0 items-start gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <HandCoins className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground">
                  {payout.publicPayoutId}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {payout.vendor.shopName} / {formatPaise(payout.totalAmountPaise)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <Badge tone={getPayoutStatusTone(payout.status)}>
                    {humanizeCode(payout.status)}
                  </Badge>
                  <Badge tone="info">{humanizeCode(payout.payoutMethod)}</Badge>
                  {payout.warnings.length > 0 ? (
                    <Badge tone="warning">
                      {payout.warnings.length} warning
                      {payout.warnings.length === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
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
          ariaLabel="Payout preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-2.5">
              <PayoutPreviewSignal
                label={payoutSignalLabel(payout)}
                meta={payoutSignalMeta(payout)}
                tone={payoutSignalTone(payout)}
              />

              <QuickPreviewFactGrid>
                <QuickPreviewFact
                  label="Amount"
                  tone={getPayoutStatusTone(payout.status)}
                  value={formatPaise(payout.totalAmountPaise)}
                />
                <QuickPreviewFact
                  label="Net"
                  tone="info"
                  value={formatPaise(payout.itemSummary.netPayablePaise)}
                />
                <QuickPreviewFact
                  label="Items"
                  value={`${payout.itemSummary.itemCount}`}
                />
                <QuickPreviewFact
                  label="Method"
                  value={humanizeCode(payout.payoutMethod)}
                />
              </QuickPreviewFactGrid>

              {payout.warnings.length > 0 ? (
                <div className="rounded-[0.75rem] border border-warning/25 bg-warning/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-warning">
                    Warning signals
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {payout.warnings.map((warning) => (
                      <Badge key={warning} tone="warning">
                        {humanizeCode(warning)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'vendor' ? (
            <div className="rounded-[0.75rem] border border-border p-3">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Store className="size-4 text-muted" />
                Vendor context
              </div>
              <PayoutPreviewField label="Shop" value={payout.vendor.shopName} />
              <PayoutPreviewField
                label="Vendor"
                value={payout.vendor.publicVendorId}
              />
              <PayoutPreviewField
                label="Status"
                value={humanizeCode(payout.vendor.vendorStatus)}
              />
              <PayoutPreviewField label="City" value={payout.vendor.city} />
              <PayoutPreviewField
                label="Zone"
                value={
                  payout.vendor.zone
                    ? `${payout.vendor.zone.city} / ${payout.vendor.zone.zoneName}`
                    : 'No zone'
                }
              />
            </div>
          ) : null}

          {activeTab === 'settlement' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ReceiptText className="size-4 text-muted" />
                  Settlement state
                </div>
                <PayoutPreviewField
                  label="Next"
                  value={humanizeCode(payout.nextRecommendedAction)}
                />
                <PayoutPreviewField
                  label="UTR"
                  value={payout.utrReference ?? 'Not available'}
                />
                <PayoutPreviewField
                  label="Approved"
                  value={formatDateSafe(payout.approvedAt)}
                />
                <PayoutPreviewField
                  label="Paid"
                  value={formatDateSafe(payout.paidAt)}
                />
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CircleDollarSign className="size-4 text-muted" />
                  Amount split
                </div>
                <PayoutPreviewField
                  label="Gross"
                  value={formatPaise(payout.itemSummary.grossAmountPaise)}
                />
                <PayoutPreviewField
                  label="Commission"
                  value={formatPaise(payout.itemSummary.commissionAmountPaise)}
                />
                <PayoutPreviewField
                  label="Logistics"
                  value={formatPaise(payout.itemSummary.logisticsDeductionPaise)}
                />
                <PayoutPreviewField
                  label="Adjustment"
                  value={formatPaise(payout.itemSummary.adjustmentAmountPaise)}
                />
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

export function PayoutsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadVendors = usePermission('vendors:read')
  const canApprovePayouts = usePermission('payouts:approve')
  const initialVendorId = searchParams.get('vendorId') ?? ''
  const seededStatuses = readEnumSearchValues(searchParams, 'status', payoutStatuses)
  const [selectedAction, setSelectedAction] =
    useState<PayoutActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [selectedStatuses, setSelectedStatuses] =
    useState<AdminPayoutStatus[]>(() => seededStatuses)
  const [selectedMethods, setSelectedMethods] = useState<AdminPayoutMethod[]>([])
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>(() =>
    initialVendorId
      ? readLookupOptionsFromSearchParams(searchParams, 'vendorId', 'vendorLabel')
      : [],
  )
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [minAmountPaise, setMinAmountPaise] = useState('')
  const [maxAmountPaise, setMaxAmountPaise] = useState('')
  const [queue, setQueue] = useState<PayoutQueueKey>(() =>
    queueKeyForPayoutStatuses(seededStatuses),
  )
  const [previewPayoutId, setPreviewPayoutId] = useState<string | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<PayoutColumnId[]>(defaultPayoutColumns)
  const [columnWidths, setColumnWidths] =
    useState<PayoutColumnWidths>(loadPayoutColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PAYOUT_COLUMN_WIDTH_STORAGE_KEY,
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
      payoutStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const methodOptions = useMemo<LookupOption[]>(
    () =>
      payoutMethods.map((method) => ({
        label: humanizeCode(method),
        value: method,
      })),
    [],
  )
  const vendorIds = useMemo(
    () => selectedVendors.map((vendor) => vendor.value),
    [selectedVendors],
  )

  const resetToFirstPage = () => setPage(1)

  const clearSeededPayoutParams = () => {
    const seededKeys = [
      'city',
      'dateFrom',
      'dateTo',
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

  const query = useMemo<AdminPayoutsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      payoutMethod: selectedMethods.length > 0 ? selectedMethods : undefined,
      city: city.trim() || undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minAmountPaise: minAmountPaise ? Number(minAmountPaise) : undefined,
      maxAmountPaise: maxAmountPaise ? Number(maxAmountPaise) : undefined,
    }),
    [
      city,
      dateFrom,
      dateTo,
      limit,
      maxAmountPaise,
      minAmountPaise,
      page,
      search,
      selectedMethods,
      selectedStatuses,
      vendorIds,
    ],
  )

  const payoutsQuery = useQuery({
    queryKey: ['payouts', query],
    queryFn: () => payoutService.getPayoutList(query),
  })
  const queueSummaryQuery = useMemo<AdminPayoutsQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      payoutMethod: selectedMethods.length > 0 ? selectedMethods : undefined,
      city: city.trim() || undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minAmountPaise: minAmountPaise ? Number(minAmountPaise) : undefined,
      maxAmountPaise: maxAmountPaise ? Number(maxAmountPaise) : undefined,
    }),
    [
      city,
      dateFrom,
      dateTo,
      maxAmountPaise,
      minAmountPaise,
      search,
      selectedMethods,
      vendorIds,
    ],
  )
  const queueSummaryResultQuery = useQuery({
    queryKey: ['payouts-summary', queueSummaryQuery],
    queryFn: () => payoutService.getPayoutList(queueSummaryQuery),
    placeholderData: (previousData) => previousData,
  })

  const payouts = payoutsQuery.data?.data ?? []
  const pagination = payoutsQuery.data?.pagination
  const summary = payoutsQuery.data?.summary
  const queueSummary = queueSummaryResultQuery.data?.summary
  const previewPayout =
    payouts.find((payout) => payout.payoutId === previewPayoutId) ?? null
  const payoutSelection = useListSelection(payouts, (payout) => payout.payoutId)
  const isInitialLoading = payoutsQuery.isLoading && !payoutsQuery.data
  const isRefreshing = payoutsQuery.isFetching && Boolean(payoutsQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(payoutsQuery.dataUpdatedAt)

  const metrics = buildPayoutMetrics(payouts, pagination, summary)
  const queueItems = buildPayoutQueueItems(queueSummary, payouts)
  const payoutGridStyle = useMemo<PayoutGridStyle>(
    () => ({
      '--payout-grid-template': getPayoutGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--payout-grid-min-width': getPayoutGridMinWidth(
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
      city ||
      vendorIds.length > 0 ||
      dateFrom ||
      dateTo ||
      minAmountPaise ||
      maxAmountPaise ||
      queue !== 'all',
  )

  const clearPayoutFilters = () => {
    clearSeededPayoutParams()
    setQueue('all')
    setSearch('')
    setSelectedStatuses([])
    setSelectedMethods([])
    setCity('')
    setSelectedVendors([])
    setDateFrom('')
    setDateTo('')
    setMinAmountPaise('')
    setMaxAmountPaise('')
    setPage(1)
  }

  const applyQueue = (nextQueue: PayoutQueueKey) => {
    clearSeededPayoutParams()
    setQueue(nextQueue)
    setSelectedStatuses([])

    if (nextQueue === 'review') {
      setSelectedStatuses(['PENDING', 'UNDER_REVIEW'])
    }

    if (nextQueue === 'held') {
      setSelectedStatuses(['HELD'])
    }

    if (nextQueue === 'approved') {
      setSelectedStatuses(['APPROVED'])
    }

    if (nextQueue === 'paid') {
      setSelectedStatuses(['PAID'])
    }

    if (nextQueue === 'exceptions') {
      setSelectedStatuses(['FAILED', 'CANCELLED'])
    }

    setPage(1)
  }

  const startColumnResize = (
    columnId: PayoutColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getPayoutColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getPayoutColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: PayoutColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getPayoutColumnDefaultWidth(columnId),
    }))
  }

  const toggleColumn = (columnId: PayoutColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const showColumn = (columnId: PayoutColumnId) =>
    visibleColumns.includes(columnId)

  const viewDetails = (payout: AdminPayoutSummary) => {
    navigate(`${routePaths.payouts}/${payout.payoutId}`)
  }

  const viewVendor = (payout: AdminPayoutSummary) => {
    navigate(`${routePaths.vendors}/${payout.vendor.vendorId}`)
  }

  const mutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PayoutActionSelection
      values: PayoutActionFormValues
    }) => {
      if (action.kind === 'CREATE') {
        if (!values.vendorId || !values.reason) {
          throw new Error('Vendor and reason are required.')
        }

        return payoutService.createPayout({
          vendorId: values.vendorId,
          earningIds: values.earningIds?.length ? values.earningIds : undefined,
          payoutMethod: values.payoutMethod,
          reason: values.reason,
        })
      }

      if (!action.payout || !values.reason) {
        throw new Error('Payout details and reason are required.')
      }

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
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Payout action completed.')
      void queryClient.invalidateQueries({ queryKey: ['payouts'] })

      if (variables.action.payout) {
        void queryClient.invalidateQueries({
          queryKey: ['payout-detail', variables.action.payout.payoutId],
        })
      }
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Payout action failed.',
      )
    },
  })

  const openPayoutAction = (
    action: PayoutActionSelection,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()
    if (!canApprovePayouts) return
    if (action.kind !== 'CREATE') {
      if (!action.payout?.availableActions.includes(action.kind)) return
    }

    setActionError(null)
    setSelectedAction(action)
  }

  const renderPayoutCells = (payout: AdminPayoutSummary) => (
    <>
      {showColumn('payout') ? (
        <PayoutCell label="Payout">
          <p className="truncate font-semibold">{payout.publicPayoutId}</p>
          <p className="mt-1 truncate text-xs text-muted">
            Created {formatDateSafe(payout.createdAt)}
          </p>
        </PayoutCell>
      ) : null}
      {showColumn('status') ? (
        <PayoutCell label="Status">
          <Badge tone={getPayoutStatusTone(payout.status)}>
            {humanizeCode(payout.status)}
          </Badge>
          {payout.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {payout.warnings.length} warning
              {payout.warnings.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </PayoutCell>
      ) : null}
      {showColumn('vendor') ? (
        <PayoutCell label="Vendor">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold">{payout.vendor.shopName}</p>
            {canReadVendors ? (
              <button
                aria-label={`Open vendor ${payout.vendor.shopName}`}
                className="btn-icon size-7 shrink-0"
                title="Open vendor"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  viewVendor(payout)
                }}
              >
                <Store className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {payout.vendor.publicVendorId} · {payout.vendor.city}
          </p>
        </PayoutCell>
      ) : null}
      {showColumn('amount') ? (
        <PayoutCell label="Amount">
          <p className="font-semibold">{formatPaise(payout.totalAmountPaise)}</p>
          <p className="mt-1 text-xs text-muted">{payout.currency}</p>
        </PayoutCell>
      ) : null}
      {showColumn('method') ? (
        <PayoutCell label="Method">
          <p className="truncate font-semibold">
            {humanizeCode(payout.payoutMethod)}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            UTR {payout.utrReference ?? 'Not available'}
          </p>
        </PayoutCell>
      ) : null}
      {showColumn('items') ? (
        <PayoutCell label="Items">
          <p className="font-semibold">
            {payout.itemSummary.itemCount} item
            {payout.itemSummary.itemCount === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-muted">
            Net {formatPaise(payout.itemSummary.netPayablePaise)}
          </p>
        </PayoutCell>
      ) : null}
      {showColumn('settlement') ? (
        <PayoutCell label="Settlement">
          <p className="font-semibold">
            {payout.nextRecommendedAction
              ? humanizeCode(payout.nextRecommendedAction)
              : 'No action'}
          </p>
          <p className="mt-1 text-xs text-muted">
            Paid {formatDateSafe(payout.paidAt)}
          </p>
        </PayoutCell>
      ) : null}
      {showColumn('updatedAt') ? (
        <PayoutCell label="Updated">
          <p className="font-semibold">{formatDateSafe(payout.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Created {formatDateSafe(payout.createdAt)}
          </p>
        </PayoutCell>
      ) : null}
    </>
  )

  const renderRowActions = (payout: AdminPayoutSummary) => {
    const primaryActionKind = canApprovePayouts
      ? getPrimaryPayoutActionKind(payout)
      : null

    return (
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {primaryActionKind ? (
          <button
            aria-label={`${humanizeCode(primaryActionKind)} ${payout.publicPayoutId}`}
            className={cn(
              'btn-icon size-8 min-h-8 shrink-0 disabled:cursor-not-allowed disabled:opacity-60',
              payoutRowActionClass(primaryActionKind),
            )}
            disabled={mutation.isPending}
            title={humanizeCode(primaryActionKind)}
            type="button"
            onClick={(event) =>
              openPayoutAction({ kind: primaryActionKind, payout }, event)
            }
          >
            {payoutActionIcon(primaryActionKind)}
          </button>
        ) : null}
        <button
          aria-label={`Open payout ${payout.publicPayoutId}`}
          className="btn-icon size-8 min-h-8 shrink-0"
          title="Open detail"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            viewDetails(payout)
          }}
        >
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Review, create, approve, and settle vendor payouts."
        layout="workspace"
        placement="topbar"
        title="Payouts"
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
            'grid gap-3 xl:min-h-0 xl:flex-1 xl:items-stretch xl:overflow-hidden',
            previewPayout
              ? filtersCollapsed
                ? 'xl:grid-cols-[4.25rem_minmax(0,1fr)] 2xl:grid-cols-[4.25rem_minmax(0,1fr)_22rem]'
                : 'xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_22rem]'
              : filtersCollapsed
                ? 'xl:grid-cols-[4.25rem_minmax(0,1fr)]'
                : 'xl:grid-cols-[18rem_minmax(0,1fr)]',
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
                  aria-label="Expand payout filters"
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
                        Payout queues
                      </h2>
                      <p className="text-xs text-muted">
                        Counts match current filters.
                      </p>
                    </div>
                    <button
                      aria-label="Collapse payout filters"
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
                        onClick={clearPayoutFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <MultiSelectFilter
                      label="Payout status"
                      options={statusOptions}
                      placeholder="All statuses"
                      values={selectedStatuses}
                      onChange={(values) => {
                        clearSeededPayoutParams()
                        setSelectedStatuses(values as AdminPayoutStatus[])
                        setQueue('all')
                        resetToFirstPage()
                      }}
                    />
                    <MultiSelectFilter
                      label="Payout method"
                      options={methodOptions}
                      placeholder="All methods"
                      values={selectedMethods}
                      onChange={(values) => {
                        setSelectedMethods(values as AdminPayoutMethod[])
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
                          clearSeededPayoutParams()
                          setCity(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    <LookupMultiSelect
                      fetchOptions={searchVendorLookupOptions}
                      label="Vendor"
                      placeholder="Search vendor"
                      queryKey={['lookup', 'vendors', 'payouts']}
                      selectedOptions={selectedVendors}
                      onChange={(options) => {
                        setSelectedVendors(options)
                        clearSeededPayoutParams()
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
                          clearSeededPayoutParams()
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
                          clearSeededPayoutParams()
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
                  Payout operations
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} payouts matching current filters`
                    : 'Search, filter, and settle vendor payouts.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search payout, UTR, vendor"
                  value={search}
                  onChange={(nextSearch) => {
                    clearSeededPayoutParams()
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
                {canApprovePayouts ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    disabled={mutation.isPending}
                    onClick={() => setSelectedAction({ kind: 'CREATE' })}
                  >
                    <Plus className="mr-2 size-4" />
                    Create
                  </Button>
                ) : null}
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
                      {payoutDataColumns.map((column) => {
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
                  onClick={() => void payoutsQuery.refetch()}
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

            {payoutsQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load payout data. Please retry."
                  title="Payout data unavailable"
                  onRetry={() => void payoutsQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <PayoutRowsSkeleton />
              </div>
            ) : payouts.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description="No payout records matched the current filters."
                  title="No payouts found"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--payout-grid-min-width)]"
                    style={payoutGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--payout-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={payoutSelection.allVisibleSelected}
                          indeterminate={payoutSelection.someVisibleSelected}
                          label="Select visible payouts"
                          onChange={payoutSelection.setVisibleSelected}
                        />
                      </div>
                      {payoutDataColumns
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
                      <div className="workbench-sticky-action-head relative flex min-w-0 pr-3">
                        <span>Actions</span>
                        <button
                          aria-label="Resize actions column"
                          className="absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-l border-border transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title="Drag to resize"
                          type="button"
                          onDoubleClick={() =>
                            resetColumnWidth(PAYOUT_ACTION_COLUMN_ID)
                          }
                          onPointerDown={(event) =>
                            startColumnResize(PAYOUT_ACTION_COLUMN_ID, event)
                          }
                        />
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={payoutSelection.allVisibleSelected}
                      selectedCount={payoutSelection.selectedCount}
                      visibleCount={payoutSelection.visibleCount}
                      onClear={payoutSelection.clearSelection}
                      onSelectVisible={() => payoutSelection.setVisibleSelected(true)}
                    />

                    <div className="divide-y divide-border">
                      {payouts.map((payout) => (
                        <div
                          aria-label={`Preview payout ${payout.publicPayoutId}`}
                          aria-selected={
                            previewPayoutId === payout.payoutId ||
                            payoutSelection.isSelected(payout.payoutId)
                          }
                          className={cn(
                            'workbench-grid-row grid w-full cursor-pointer gap-3 px-3 py-3 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--payout-grid-template)]',
                            previewPayoutId === payout.payoutId &&
                              'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
                            payoutSelection.isSelected(payout.payoutId) &&
                              'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={payout.payoutId}
                          role="button"
                          style={payoutGridStyle}
                          tabIndex={0}
                          onClick={() => setPreviewPayoutId(payout.payoutId)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setPreviewPayoutId(payout.payoutId)
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-start xl:items-center">
                            <ListSelectionCheckbox
                              checked={payoutSelection.isSelected(payout.payoutId)}
                              label={`Select payout ${payout.payoutId}`}
                              onChange={(selected) =>
                                payoutSelection.setItemSelected(
                                  payout.payoutId,
                                  selected,
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                            {renderPayoutCells(payout)}
                          </div>
                          <div className="workbench-sticky-action-cell flex min-w-0 items-center justify-start pl-2 xl:justify-end">
                            {renderRowActions(payout)}
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
          {previewPayout ? (
            <PayoutPreviewPanel
              canApprovePayouts={canApprovePayouts}
              canReadVendors={canReadVendors}
              isSubmitting={mutation.isPending}
              payout={previewPayout}
              onClose={() => setPreviewPayoutId(null)}
              onOpenAction={(kind, payout) =>
                openPayoutAction({ kind, payout })
              }
              onOpenDetails={viewDetails}
              onOpenVendor={viewVendor}
            />
          ) : null}
        </section>
      </div>

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
        onSubmit={(values) => {
          if (selectedAction) {
            void mutation.mutateAsync({ action: selectedAction, values })
          }
        }}
      />
    </PageContainer>
  )
}
