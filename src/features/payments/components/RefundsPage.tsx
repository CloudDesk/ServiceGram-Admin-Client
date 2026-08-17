import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Filter,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  SlidersHorizontal,
  Store,
  UserRound,
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
import { OverflowText } from '../../../components/ui/OverflowText'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  quickPreviewOverlayClassName,
  quickPreviewPanelClassName,
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
  AdminRefundChildSummary,
  AdminRefundStatus,
  AdminRefundSummary,
  AdminRefundsQueryParams,
} from '../types/payment.types'

const DEFAULT_PAGE_SIZE = 10
const REFUND_DEFAULT_COLUMN_WIDTH = 220
const REFUND_GRID_COLUMN_GAP = 8
const REFUND_GRID_INLINE_PADDING = 20
const REFUND_ACTION_COLUMN_ID = 'actions'
const REFUND_ACTION_COLUMN_DEFAULT_WIDTH = 128
const REFUND_ACTION_COLUMN_MIN_WIDTH = 112
const REFUND_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.refund.columnWidths.v2'

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
    defaultWidth: 250,
    minWidth: 225,
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
    defaultWidth: 240,
    minWidth: 215,
  },
  {
    id: 'order',
    label: 'Order',
    defaultWidth: 230,
    minWidth: 205,
  },
  {
    id: 'parties',
    label: 'Customer / Vendor',
    defaultWidth: 290,
    minWidth: 250,
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
    defaultWidth: 320,
    minWidth: 250,
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
type RefundPreviewTab = 'overview' | 'review' | 'links'
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

function getPaymentStatusTone(
  status: AdminRefundSummary['payment']['status'],
): RefundTone {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'CREATED' || status === 'PENDING') return 'warning'

  return 'neutral'
}

function buildRefundQueueItems(
  summary: AdminRefundChildSummary | undefined,
  refunds: AdminRefundSummary[],
) {
  return [
    {
      key: 'all' as const,
      label: 'All refunds',
      count: summary?.total ?? refunds.length,
    },
    {
      key: 'requested' as const,
      label: 'Requested',
      count:
        summary?.requested ??
        refunds.filter((refund) => refund.status === 'REQUESTED').length,
    },
    {
      key: 'approved' as const,
      label: 'Approved',
      count:
        summary?.approved ??
        refunds.filter((refund) => refund.status === 'APPROVED').length,
    },
    {
      key: 'processing' as const,
      label: 'Processing',
      count:
        summary?.processing ??
        refunds.filter((refund) => refund.status === 'PROCESSING').length,
    },
    {
      key: 'successful' as const,
      label: 'Successful',
      count:
        summary?.successful ??
        refunds.filter((refund) => refund.status === 'SUCCESS').length,
    },
    {
      key: 'exceptions' as const,
      label: 'Failed / rejected',
      count:
        summary ? summary.failed + summary.rejected : refunds.filter((refund) =>
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

function RefundRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid gap-2 border-b border-border px-3 py-2 xl:grid-cols-[1fr_0.8fr_1fr_1fr_1.2fr_0.8fr_1fr]"
          key={index}
        >
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <Skeleton className="h-8 w-full" key={cellIndex} />
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
      <p className="text-xs text-muted xl:hidden">{label}</p>
      <div className="mt-1 min-w-0 text-sm text-foreground xl:mt-0">{children}</div>
    </div>
  )
}

function refundSignalTone(refund: AdminRefundSummary): RefundTone {
  if (refund.status === 'FAILED' || refund.status === 'REJECTED' || refund.warnings.length > 0) {
    return 'danger'
  }

  if (refund.nextRecommendedAction || refund.status === 'REQUESTED') {
    return 'warning'
  }

  if (refund.status === 'APPROVED' || refund.status === 'PROCESSING') {
    return 'info'
  }

  if (refund.status === 'SUCCESS') return 'success'

  return 'neutral'
}

function refundSignalLabel(refund: AdminRefundSummary) {
  if (refund.nextRecommendedAction) {
    return humanizeCode(refund.nextRecommendedAction)
  }

  if (refund.warnings[0]) {
    return humanizeCode(refund.warnings[0])
  }

  if (refund.status === 'REQUESTED') return 'Needs approval'
  if (refund.status === 'APPROVED') return 'Approved for processing'
  if (refund.status === 'PROCESSING') return 'Processing refund'
  if (refund.status === 'SUCCESS') return 'Refund complete'
  if (refund.status === 'REJECTED') return 'Refund rejected'
  if (refund.status === 'FAILED') return 'Refund failed'

  return humanizeCode(refund.status)
}

function refundSignalMeta(refund: AdminRefundSummary) {
  if (refund.nextRecommendedAction) return 'Next action'

  if (refund.warnings.length > 0) {
    return `${refund.warnings.length} warning${refund.warnings.length === 1 ? '' : 's'}`
  }

  return humanizeCode(refund.status)
}

function previewSignalClasses(tone: RefundTone) {
  if (tone === 'success') return 'border-success/20 bg-success/10 text-success'
  if (tone === 'warning') return 'border-warning/25 bg-warning/10 text-warning'
  if (tone === 'danger') return 'border-danger/20 bg-danger/10 text-danger'
  if (tone === 'info') return 'border-info/20 bg-info/10 text-primary'

  return 'border-border bg-surface-muted/55 text-muted'
}

function RefundPreviewSignal({
  label,
  meta,
  tone,
}: {
  label: string
  meta: string
  tone: RefundTone
}) {
  return (
    <div
      className={cn(
        'flex min-h-9 items-center justify-between gap-2 rounded-[0.65rem] border px-2.5 py-2',
        previewSignalClasses(tone),
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ShieldAlert className="size-4 shrink-0 text-current" />
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{label}</span>
      </div>
      <span className="shrink-0 rounded-full bg-surface/65 px-2 py-0.5 text-xs font-semibold text-current">
        {meta}
      </span>
    </div>
  )
}

function RefundPreviewField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-normal text-muted">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

function RefundPreviewPanel({
  canReadCustomers,
  canReadOrders,
  canReadPayments,
  canReadVendors,
  canReviewRefunds,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenCustomer,
  onOpenDetails,
  onOpenOrder,
  onOpenPayment,
  onOpenVendor,
  refund,
}: {
  canReadCustomers: boolean
  canReadOrders: boolean
  canReadPayments: boolean
  canReadVendors: boolean
  canReviewRefunds: boolean
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (action: PaymentActionSelection) => void
  onOpenCustomer: (refund: AdminRefundSummary) => void
  onOpenDetails: (refund: AdminRefundSummary) => void
  onOpenOrder: (refund: AdminRefundSummary) => void
  onOpenPayment: (refund: AdminRefundSummary) => void
  onOpenVendor: (refund: AdminRefundSummary) => void
  refund: AdminRefundSummary
}) {
  const [activeTab, setActiveTab] = useState<RefundPreviewTab>('overview')
  const signalTone = refundSignalTone(refund)
  const previewTabs: { key: RefundPreviewTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'review', label: 'Review' },
    { key: 'links', label: 'Links' },
  ]
  const canApprove = canReviewRefunds && refund.availableActions.includes('APPROVE')
  const canReject = canReviewRefunds && refund.availableActions.includes('REJECT')
  const primaryAction: QuickPreviewAction = {
    icon: <Eye className="size-4" />,
    key: 'details',
    label: 'Open detail',
    onClick: () => onOpenDetails(refund),
    variant: 'primary',
  }
  const detailAction: QuickPreviewAction | null = canApprove
    ? {
        disabled: isSubmitting,
        icon: <CheckCircle2 className="size-4" />,
        key: 'approve',
        label: 'Approve',
        onClick: () => onOpenAction({ kind: 'APPROVE_REFUND', refund }),
        variant: 'secondary',
      }
    : null
  const secondaryActions: QuickPreviewAction[] = []

  if (canReject) {
    secondaryActions.push({
      disabled: isSubmitting,
      icon: <XCircle className="size-4" />,
      key: 'reject',
      label: 'Reject',
      onClick: () => onOpenAction({ kind: 'REJECT_REFUND', refund }),
      variant: 'danger',
    })
  }

  if (canReadPayments) {
    secondaryActions.push({
      icon: <CreditCard className="size-4" />,
      key: 'payment',
      label: 'Payment',
      onClick: () => onOpenPayment(refund),
      variant: 'secondary',
    })
  }

  if (canReadOrders) {
    secondaryActions.push({
      icon: <ReceiptText className="size-4" />,
      key: 'order',
      label: 'Order',
      onClick: () => onOpenOrder(refund),
      variant: 'secondary',
    })
  }

  if (canReadCustomers) {
    secondaryActions.push({
      icon: <UserRound className="size-4" />,
      key: 'customer',
      label: 'Customer',
      onClick: () => onOpenCustomer(refund),
      variant: 'secondary',
    })
  }

  if (canReadVendors) {
    secondaryActions.push({
      icon: <Store className="size-4" />,
      key: 'vendor',
      label: 'Vendor',
      onClick: () => onOpenVendor(refund),
      variant: 'secondary',
    })
  }

  return (
    <>
      <button
        aria-label="Close refund preview"
        className={quickPreviewOverlayClassName}
        type="button"
        onClick={onClose}
      />
      <aside className={quickPreviewPanelClassName}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
              <RefreshCcw className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Refund
              </p>
              <OverflowText
                as="h3"
                className="mt-1 text-lg font-bold text-foreground"
                title={formatPaise(refund.amountPaise)}
              >
                {formatPaise(refund.amountPaise)}
              </OverflowText>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge tone={getRefundStatusTone(refund.status)}>
                  {humanizeCode(refund.status)}
                </Badge>
                <Badge tone={getPaymentStatusTone(refund.payment.status)}>
                  {humanizeCode(refund.payment.status)}
                </Badge>
                {refund.warnings.length > 0 ? (
                  <Badge tone="warning">
                    {refund.warnings.length} warning
                    {refund.warnings.length === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-2 space-y-1 text-xs text-muted">
                <div className="flex min-w-0 items-center gap-2">
                  <CreditCard className="size-3.5 shrink-0" />
                  <OverflowText title={refund.publicPaymentId}>
                    {refund.publicPaymentId}
                  </OverflowText>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <UserRound className="size-3.5 shrink-0" />
                  <OverflowText title={refund.customer.fullName}>
                    {refund.customer.fullName}
                  </OverflowText>
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
          ariaLabel="Refund preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'overview' ? (
            <div className="space-y-2.5">
              <RefundPreviewSignal
                label={refundSignalLabel(refund)}
                meta={refundSignalMeta(refund)}
                tone={signalTone}
              />

              <QuickPreviewFactGrid>
                <QuickPreviewFact
                  label="Refund"
                  tone={getRefundStatusTone(refund.status)}
                  value={formatPaise(refund.amountPaise)}
                />
                <QuickPreviewFact
                  label="Payment"
                  tone={getPaymentStatusTone(refund.payment.status)}
                  value={formatPaise(refund.payment.amountPaise)}
                />
                <QuickPreviewFact
                  label="Remaining"
                  tone={
                    refund.refundSummary.remainingRefundableAmountPaise > 0 ? 'info' : 'neutral'
                  }
                  value={formatPaise(refund.refundSummary.remainingRefundableAmountPaise)}
                />
                <QuickPreviewFact
                  label="Requested"
                  tone={refund.status === 'REQUESTED' ? 'warning' : 'neutral'}
                  value={formatDateSafe(refund.createdAt)}
                />
              </QuickPreviewFactGrid>

              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">Reason</p>
                <p className="mt-1 line-clamp-3 text-sm text-foreground">
                  {refund.reason || 'No reason supplied'}
                </p>
              </div>
            </div>
          ) : null}

          {activeTab === 'review' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldAlert className="size-4 text-muted" />
                  Review state
                </div>
                <RefundPreviewField
                  label="Next"
                  value={humanizeCode(refund.nextRecommendedAction)}
                />
                <RefundPreviewField label="Reviewed" value={formatDateSafe(refund.reviewedAt)} />
                <RefundPreviewField label="Processed" value={formatDateSafe(refund.processedAt)} />
                <RefundPreviewField
                  label="Initiated by"
                  value={refund.initiatedByAdminId ?? 'Not available'}
                />
                <RefundPreviewField
                  label="Approved by"
                  value={refund.approvedByAdminId ?? 'Not available'}
                />
                <RefundPreviewField
                  label="Reviewed by"
                  value={refund.reviewedByAdminId ?? 'Not available'}
                />
              </div>

              {refund.rejectionReason ? (
                <div className="rounded-[0.75rem] border border-danger/20 bg-danger/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-danger">
                    Rejection
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm text-foreground">
                    {refund.rejectionReason}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {refund.warnings.length ? (
                  refund.warnings.map((warning) => (
                    <Badge key={warning} tone="warning">
                      {humanizeCode(warning)}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="success">No warnings</Badge>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'links' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ReceiptText className="size-4 text-muted" />
                  Context
                </div>
                <RefundPreviewField label="Payment" value={refund.publicPaymentId} />
                <RefundPreviewField label="Order" value={refund.order.publicOrderId} />
                <RefundPreviewField label="Customer" value={refund.customer.fullName} />
                <RefundPreviewField label="Vendor" value={refund.vendor.shopName} />
                <RefundPreviewField
                  label="Category"
                  value={refund.category?.name ?? 'No category'}
                />
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <CreditCard className="size-4 text-muted" />
                  Provider
                </div>
                <RefundPreviewField label="Method" value={humanizeCode(refund.payment.method)} />
                <RefundPreviewField label="Gateway" value={humanizeCode(refund.payment.gateway)} />
                <RefundPreviewField
                  label="Refund ref"
                  value={refund.razorpayRefundId ?? 'Not available'}
                />
                <RefundPreviewField label="Refund id" value={refund.refundId} />
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
  const [previewRefundId, setPreviewRefundId] = useState<string | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [showFilters, setFiltersOpen] = useState(false)
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
  const queueSummaryQuery = useMemo<AdminRefundsQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
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
      maxAmountPaise,
      minAmountPaise,
      orderIds,
      paymentIds,
      search,
      vendorIds,
    ],
  )
  const queueSummaryResultQuery = useQuery({
    queryKey: ['refunds-summary', queueSummaryQuery],
    queryFn: () => paymentService.getRefundList(queueSummaryQuery),
    placeholderData: (previousData) => previousData,
  })

  const refunds = refundsQuery.data?.data ?? []
  const pagination = refundsQuery.data?.pagination
  const queueSummary = queueSummaryResultQuery.data?.summary
  const previewRefund =
    refunds.find((refund) => refund.refundId === previewRefundId) ?? null
  const refundSelection = useListSelection(refunds, (refund) => refund.refundId)
  const isInitialLoading = refundsQuery.isLoading && !refundsQuery.data
  const isRefreshing = refundsQuery.isFetching && Boolean(refundsQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(refundsQuery.dataUpdatedAt)
  const refreshActionNode = (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'hidden text-xs font-medium sm:inline',
          isRefreshing ? 'text-primary' : 'text-muted',
        )}
      >
        {refreshStatusLabel}
      </span>
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
  )

  const queueItems = buildRefundQueueItems(queueSummary, refunds)
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

  const renderRefundCells = (refund: AdminRefundSummary) => {
    const refundLabel = refund.razorpayRefundId ?? 'Refund request'
    const createdAtLabel = `Created ${formatDateSafe(refund.createdAt)}`
    const paymentMeta = `${humanizeCode(refund.payment.status)} / ${humanizeCode(
      refund.payment.gateway,
    )}`
    const orderStatusLabel = humanizeCode(refund.order.orderStatus)
    const reviewLabel = humanizeCode(refund.nextRecommendedAction)
    const reviewedLabel = `Reviewed ${formatDateSafe(refund.reviewedAt)}`
    const processedLabel = `Processed ${formatDateSafe(refund.processedAt)}`

    return (
      <>
        {showColumn('refund') ? (
          <RefundCell label="Refund">
            <OverflowText as="p" className="font-semibold" title={refundLabel}>
              {refundLabel}
            </OverflowText>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={createdAtLabel}
            >
              {createdAtLabel}
            </OverflowText>
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
              <OverflowText
                as="p"
                className="font-semibold"
                title={refund.publicPaymentId}
              >
                {refund.publicPaymentId}
              </OverflowText>
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
            <OverflowText as="p" className="mt-0.5 text-xs text-muted" title={paymentMeta}>
              {paymentMeta}
            </OverflowText>
          </RefundCell>
        ) : null}
        {showColumn('order') ? (
          <RefundCell label="Order">
            <div className="flex min-w-0 items-center gap-2">
              <OverflowText
                as="p"
                className="font-semibold"
                title={refund.order.publicOrderId}
              >
                {refund.order.publicOrderId}
              </OverflowText>
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
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={orderStatusLabel}
            >
              {orderStatusLabel}
            </OverflowText>
          </RefundCell>
        ) : null}
        {showColumn('parties') ? (
          <RefundCell label="Customer / Vendor">
            <div className="space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <OverflowText
                  as="p"
                  className="font-semibold"
                  title={refund.customer.fullName}
                >
                  {refund.customer.fullName}
                </OverflowText>
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
                <OverflowText
                  as="p"
                  className="text-xs text-muted"
                  title={refund.vendor.shopName}
                >
                  {refund.vendor.shopName}
                </OverflowText>
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
            <p className="font-semibold" title={formatPaise(refund.amountPaise)}>
              {formatPaise(refund.amountPaise)}
            </p>
            <p className="mt-0.5 text-xs text-muted" title={refund.currency}>
              {refund.currency}
            </p>
          </RefundCell>
        ) : null}
        {showColumn('reason') ? (
          <RefundCell label="Reason">
            <p className="line-clamp-2" title={refund.reason}>
              {refund.reason}
            </p>
            {refund.rejectionReason ? (
              <p className="mt-0.5 line-clamp-1 text-xs text-danger" title={refund.rejectionReason}>
                {refund.rejectionReason}
              </p>
            ) : null}
          </RefundCell>
        ) : null}
        {showColumn('review') ? (
          <RefundCell label="Review">
            <OverflowText as="p" className="font-semibold" title={reviewLabel}>
              {reviewLabel}
            </OverflowText>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={reviewedLabel}
            >
              {reviewedLabel}
            </OverflowText>
          </RefundCell>
        ) : null}
        {showColumn('updatedAt') ? (
          <RefundCell label="Updated">
            <p className="font-semibold" title={formatDateSafe(refund.updatedAt)}>
              {formatDateSafe(refund.updatedAt)}
            </p>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={processedLabel}
            >
              {processedLabel}
            </OverflowText>
          </RefundCell>
        ) : null}
      </>
    )
  }

  const renderRowActions = (refund: AdminRefundSummary) => (
    <div className="flex flex-nowrap items-center justify-end gap-1.5">
      {canReviewRefunds && refund.availableActions.includes('APPROVE') ? (
        <button
          aria-label={`Approve refund ${refund.refundId}`}
          className="btn-icon size-8 min-h-8 shrink-0 text-success hover:text-success disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mutation.isPending}
          title="Approve refund"
          type="button"
          onClick={(event) => openRefundAction({ kind: 'APPROVE_REFUND', refund }, event)}
        >
          <CheckCircle2 className="size-3.5" />
        </button>
      ) : null}
      {canReviewRefunds && refund.availableActions.includes('REJECT') ? (
        <button
          aria-label={`Reject refund ${refund.refundId}`}
          className="btn-icon size-8 min-h-8 shrink-0 text-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
          disabled={mutation.isPending}
          title="Reject refund"
          type="button"
          onClick={(event) => openRefundAction({ kind: 'REJECT_REFUND', refund }, event)}
        >
          <XCircle className="size-3.5" />
        </button>
      ) : null}
      <button
        aria-label={`Open refund detail ${refund.refundId}`}
        className="btn-icon size-8 min-h-8 shrink-0"
        title="Open refund detail"
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          viewDetails(refund)
        }}
      >
        <Eye className="size-3.5" />
      </button>
    </div>
  )

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={refreshActionNode}
        layout="workspace"
        placement="topbar"
        title="Refunds"
      />

      <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1">
        {actionMessage ? (
          <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
            {actionMessage}
          </div>
        ) : null}

        <section
          className={cn(
            'grid gap-3 xl:min-h-0 xl:flex-1 xl:items-stretch xl:overflow-hidden',
            previewRefund ? 'xl:grid-cols-[minmax(0,1fr)_26rem]' : 'xl:grid-cols-1',
          )}
        >
          <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
            <div className="grid shrink-0 gap-3 border-b border-border px-3 py-3 xl:grid-cols-[minmax(24rem,1fr)_auto] xl:items-center">
              <div className="min-w-0">
                <ListHeaderSearch
                  className="w-full"
                  placeholder="Search refund, payment, order, customer, vendor"
                  value={search}
                  onChange={(nextSearch) => {
                    clearSeededRefundParams()
                    setSearch(nextSearch)
                    resetToFirstPage()
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <Button
                  aria-expanded={showFilters}
                  className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setFiltersOpen((current) => !current)}
                >
                  <Filter className="mr-2 size-4" />
                  Filters
                  {hasActiveFilters ? (
                    <span className="ml-1 size-2 rounded-full bg-primary" />
                  ) : null}
                </Button>
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
              </div>
            </div>

            <div className="shrink-0 border-b border-border bg-surface px-3 pb-3 sm:px-4">
              <div className="flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
                {queueItems.map((queueItem) => {
                  const isActive = queue === queueItem.key

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
                        {queueItem.count ?? '...'}
                      </span>
                    </button>
                  )
                })}
              </div>

              {showFilters ? (
                <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
                  <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[repeat(5,minmax(10rem,1fr))_auto] 2xl:items-end">
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
                      <span className="text-xs font-semibold text-muted">City</span>
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
                      <span className="text-xs font-semibold text-muted">Date from</span>
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
                      <span className="text-xs font-semibold text-muted">Date to</span>
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
                    <Button
                      className="w-full 2xl:w-auto"
                      disabled={!hasActiveFilters}
                      size="sm"
                      type="button"
                      variant="secondary"
                      onClick={clearRefundFilters}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ) : null}
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
                    <div className="sticky top-0 z-10 hidden gap-2 grid-cols-[var(--refund-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
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
                      <div className="workbench-sticky-action-head relative flex min-w-0 pr-3">
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
                          aria-label={`Preview refund ${refund.refundId}`}
                          aria-selected={
                            previewRefundId === refund.refundId ||
                            refundSelection.isSelected(refund.refundId)
                          }
                          className={cn(
                            'workbench-grid-row grid w-full cursor-pointer gap-2 px-3 py-2 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--refund-grid-template)] xl:items-center',
                            previewRefundId === refund.refundId &&
                              'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
                            refundSelection.isSelected(refund.refundId) &&
                              'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={refund.refundId}
                          role="button"
                          style={refundGridStyle}
                          tabIndex={0}
                          onClick={() => setPreviewRefundId(refund.refundId)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setPreviewRefundId(refund.refundId)
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
                          <div className="grid gap-2 sm:grid-cols-2 xl:contents">
                            {renderRefundCells(refund)}
                          </div>
                          <div className="workbench-sticky-action-cell flex min-w-0 items-center justify-start pl-2 xl:justify-end">
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
          {previewRefund ? (
            <RefundPreviewPanel
              canReadCustomers={canReadCustomers}
              canReadOrders={canReadOrders}
              canReadPayments={canReadPayments}
              canReadVendors={canReadVendors}
              canReviewRefunds={canReviewRefunds}
              isSubmitting={mutation.isPending}
              refund={previewRefund}
              onClose={() => setPreviewRefundId(null)}
              onOpenAction={openRefundAction}
              onOpenCustomer={viewCustomer}
              onOpenDetails={viewDetails}
              onOpenOrder={viewOrder}
              onOpenPayment={viewPayment}
              onOpenVendor={viewVendor}
            />
          ) : null}
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
