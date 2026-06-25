import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageSquarePlus,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  SlidersHorizontal,
  XCircle,
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
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import { vendorService } from '../services/vendor.service'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
  type VendorActionSelection,
} from './VendorActionModal'
import type {
  VendorListItem,
  VendorListQueryParams,
  VendorOnboardingStatus,
  VendorPagination,
  VendorStatus,
} from '../types/vendor.types'

type VendorViewMode = 'active' | 'onboarding'
type VendorTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type VendorQueueKey =
  | 'active'
  | 'onboarding'
  | 'underReview'
  | 'documentsPending'
  | 'suspended'
type VendorListActionKind = Extract<
  VendorActionKind,
  'ADD_NOTE' | 'APPROVE' | 'REACTIVATE' | 'REJECT' | 'SUSPEND'
>

const DEFAULT_PAGE_SIZE = 10
const VENDOR_DEFAULT_COLUMN_WIDTH = 220
const VENDOR_GRID_COLUMN_GAP = 12
const VENDOR_GRID_INLINE_PADDING = 24
const VENDOR_ACTION_COLUMN_ID = 'actions'
const VENDOR_ACTION_COLUMN_DEFAULT_WIDTH = 176
const VENDOR_ACTION_COLUMN_MIN_WIDTH = 156
const VENDOR_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.vendor.columnWidths.v2'
const hiddenVendorListActions = ['REQUEST_DOCUMENTS'] as const

const vendorDataColumns = [
  { id: 'vendor', label: 'Vendor', defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH, minWidth: 180 },
  { id: 'category', label: 'Category', defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH, minWidth: 150 },
  { id: 'city', label: 'City', defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH, minWidth: 145 },
  {
    id: 'vendorStatus',
    label: 'Vendor Status',
    defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH,
    minWidth: 155,
  },
  {
    id: 'payout',
    label: 'Payout Account',
    defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH,
    minWidth: 175,
  },
  {
    id: 'documents',
    label: 'Documents',
    defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH,
    minWidth: 150,
  },
  { id: 'updatedAt', label: 'Updated', defaultWidth: VENDOR_DEFAULT_COLUMN_WIDTH, minWidth: 155 },
] as const

type VendorColumnId = (typeof vendorDataColumns)[number]['id']
type VendorColumnWidthId = VendorColumnId | typeof VENDOR_ACTION_COLUMN_ID
type VendorColumnWidths = Partial<Record<VendorColumnWidthId, number>>

const defaultVendorColumns: VendorColumnId[] = [
  'vendor',
  'city',
  'vendorStatus',
  'onboarding',
  'payout',
]

type VendorTableRow = VendorListItem

interface VendorGridStyle extends CSSProperties {
  '--vendor-grid-template': string
  '--vendor-grid-min-width': string
}

interface VendorActionTarget {
  action: VendorActionSelection
  vendor: VendorTableRow
}

function getVisibleVendorActions(actions: string[]) {
  return actions.filter(
    (action) =>
      !hiddenVendorListActions.includes(
        action as (typeof hiddenVendorListActions)[number],
      ),
  )
}

function toneClasses(tone: VendorTone) {
  if (tone === 'success') return 'border-border bg-surface text-success'
  if (tone === 'warning') return 'border-border bg-surface text-warning'
  if (tone === 'danger') return 'border-border bg-surface text-danger'
  if (tone === 'info') return 'border-border bg-surface text-primary'
  return 'border-border bg-surface text-muted'
}

function getVendorStatusTone(status: VendorStatus): VendorTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED') return 'danger'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

function getOnboardingStatusTone(status: VendorOnboardingStatus): VendorTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'DOCUMENTS_PENDING' || status === 'UNDER_REVIEW') return 'warning'
  return 'info'
}

function getPayoutAccountTone(row: VendorTableRow): VendorTone {
  const summary = row.bankAccountSummary

  if (!summary || !summary.hasPrimary) return 'warning'
  if (summary.payoutReady || summary.primaryStatus === 'VERIFIED') return 'success'
  if (summary.primaryStatus === 'REJECTED' || summary.primaryStatus === 'DISABLED') {
    return 'danger'
  }

  return 'warning'
}

function getPayoutAccountLabel(row: VendorTableRow) {
  const summary = row.bankAccountSummary

  if (!summary) return 'Not available'
  if (!summary.hasPrimary) return 'Not submitted'
  if (summary.payoutReady) return 'Payout Ready'

  return summary.primaryStatus ?? 'Review Needed'
}

function getPayoutAccountMeta(row: VendorTableRow) {
  const summary = row.bankAccountSummary

  if (!summary) return 'Bank summary unavailable'
  if (!summary.hasPrimary) return 'No primary account'

  return (
    [summary.primaryBankName, summary.primaryAccountNumberMasked]
      .filter(Boolean)
      .join(' · ') || `${summary.verified}/${summary.total} verified`
  )
}

function getDocumentSummaryLabel(vendor: VendorTableRow) {
  if (!vendor.documentSummary) return 'No documents'

  return `${vendor.documentSummary.verified}/${vendor.documentSummary.total} verified`
}

function getDocumentSummaryTone(vendor: VendorTableRow): VendorTone {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) return 'warning'
  if (summary.rejected || summary.expired) return 'danger'
  if (summary.verified === summary.total) return 'success'
  return 'warning'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review vendor'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getVendorInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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

function vendorNeedsAttention(vendor: VendorTableRow) {
  return (
    vendor.vendorStatus === 'SUSPENDED' ||
    vendor.onboardingStatus !== 'APPROVED' ||
    vendor.warnings.length > 0 ||
    Boolean(visibleRecommendedAction(vendor)) ||
    getPayoutAccountTone(vendor) !== 'success'
  )
}

function visibleRecommendedAction(vendor: VendorTableRow) {
  const action = vendor.nextRecommendedAction?.toUpperCase()

  if (!action || hiddenVendorListActions.includes(action as never)) {
    return null
  }

  return action
}

function mapRecommendedAction(vendor: VendorTableRow): VendorListActionKind | null {
  const action = visibleRecommendedAction(vendor)

  if (
    action === 'ADD_NOTE' ||
    action === 'APPROVE' ||
    action === 'REACTIVATE' ||
    action === 'REJECT' ||
    action === 'SUSPEND'
  ) {
    if (action === 'ADD_NOTE' || getVisibleVendorActions(vendor.availableActions).includes(action)) {
      return action
    }
  }

  return null
}

function primaryActionLabel(vendor: VendorTableRow) {
  const action = mapRecommendedAction(vendor)

  if (action) return humanizeCode(action)
  if (vendor.onboardingStatus !== 'APPROVED') return 'Review vendor'
  if (vendor.vendorStatus === 'SUSPENDED') return 'Review suspension'
  if (getPayoutAccountTone(vendor) !== 'success') return 'Review payout'

  return 'View details'
}

function getApprovalBlockMessage(vendor: VendorTableRow) {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) {
    return 'Approval is blocked until the vendor uploads required documents.'
  }

  const unverifiedCount = Math.max(summary.total - summary.verified, 0)

  if (unverifiedCount === 0) return null

  return `Approval is blocked until ${unverifiedCount} document${unverifiedCount === 1 ? '' : 's'} are verified.`
}

function getDefaultVendorColumnWidths() {
  const widths: VendorColumnWidths = {
    [VENDOR_ACTION_COLUMN_ID]: VENDOR_ACTION_COLUMN_DEFAULT_WIDTH,
  }

  vendorDataColumns.forEach((column) => {
    widths[column.id] = column.defaultWidth
  })

  return widths
}

const defaultVendorColumnWidths = getDefaultVendorColumnWidths()

function getVendorColumnMinWidth(columnId: VendorColumnWidthId) {
  if (columnId === VENDOR_ACTION_COLUMN_ID) return VENDOR_ACTION_COLUMN_MIN_WIDTH
  return vendorDataColumns.find((column) => column.id === columnId)?.minWidth ?? 120
}

function getVendorColumnDefaultWidth(columnId: VendorColumnWidthId) {
  return defaultVendorColumnWidths[columnId] ?? getVendorColumnMinWidth(columnId)
}

function getVendorColumnWidth(
  columnWidths: VendorColumnWidths,
  columnId: VendorColumnWidthId,
) {
  return Math.max(
    getVendorColumnMinWidth(columnId),
    columnWidths[columnId] ?? getVendorColumnDefaultWidth(columnId),
  )
}

function normalizeVendorColumnWidths(value: unknown) {
  const widths = { ...defaultVendorColumnWidths }

  if (!value || typeof value !== 'object') return widths

  const record = value as Record<string, unknown>

  vendorDataColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  const actionWidth = record[VENDOR_ACTION_COLUMN_ID]

  if (typeof actionWidth === 'number' && Number.isFinite(actionWidth)) {
    widths[VENDOR_ACTION_COLUMN_ID] = Math.max(
      VENDOR_ACTION_COLUMN_MIN_WIDTH,
      Math.round(actionWidth),
    )
  }

  return widths
}

function loadVendorColumnWidths() {
  if (typeof window === 'undefined') return defaultVendorColumnWidths

  try {
    return normalizeVendorColumnWidths(
      JSON.parse(
        window.localStorage.getItem(VENDOR_COLUMN_WIDTH_STORAGE_KEY) ?? 'null',
      ),
    )
  } catch {
    return defaultVendorColumnWidths
  }
}

function getVendorGridTemplate(
  visibleColumns: VendorColumnId[],
  columnWidths: VendorColumnWidths,
) {
  const selectedWidths = vendorDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getVendorColumnWidth(columnWidths, column.id)}px`)

  return [
    ...selectedWidths,
    `${getVendorColumnWidth(columnWidths, VENDOR_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getVendorGridMinWidth(
  visibleColumns: VendorColumnId[],
  columnWidths: VendorColumnWidths,
) {
  const visibleColumnCount = visibleColumns.length
  const gridColumnCount = visibleColumnCount + 1
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * VENDOR_GRID_COLUMN_GAP
  const visibleWidth = vendorDataColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getVendorColumnWidth(columnWidths, column.id),
      0,
    )

  return `${
    visibleWidth +
    getVendorColumnWidth(columnWidths, VENDOR_ACTION_COLUMN_ID) +
    gridGapWidth +
    VENDOR_GRID_INLINE_PADDING
  }px`
}

function getVendorQuery(
  viewMode: VendorViewMode,
  vendorStatus: '' | VendorStatus,
): Pick<VendorListQueryParams, 'vendorStatus'> {
  if (vendorStatus) return { vendorStatus }
  if (viewMode === 'active') return { vendorStatus: 'ACTIVE' }
  return {}
}

function MetricCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: VendorTone
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

function VendorRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-20 w-full rounded-[1rem]" key={index} />
      ))}
    </div>
  )
}

function VendorPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: VendorPagination
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

function VendorRow({
  isSubmitting,
  onOpenAction,
  onViewDetails,
  vendor,
  visibleColumns,
}: {
  isSubmitting: boolean
  onOpenAction: (vendor: VendorTableRow, kind: VendorListActionKind) => void
  onViewDetails: (vendor: VendorTableRow) => void
  vendor: VendorTableRow
  visibleColumns: VendorColumnId[]
}) {
  const recommendedAction = mapRecommendedAction(vendor)
  const visibleActions = getVisibleVendorActions(vendor.availableActions)
  const hasAction = (action: VendorListActionKind) => visibleActions.includes(action)
  const approvalBlockMessage = getApprovalBlockMessage(vendor)
  const showColumn = (columnId: VendorColumnId) => visibleColumns.includes(columnId)
  const showAddNoteAction = recommendedAction !== 'ADD_NOTE'
  const showApproveAction = hasAction('APPROVE') && recommendedAction !== 'APPROVE'
  const showRejectAction = hasAction('REJECT') && recommendedAction !== 'REJECT'
  const showSuspendAction = hasAction('SUSPEND') && recommendedAction !== 'SUSPEND'
  const showReactivateAction =
    hasAction('REACTIVATE') && recommendedAction !== 'REACTIVATE'

  const openRecommendedAction = () => {
    if (!recommendedAction) return
    onOpenAction(vendor, recommendedAction)
  }

  return (
    <article
      aria-label={`Open details for ${vendor.shopName}`}
      className="grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2.5 transition last:border-b-0 hover:bg-surface-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[var(--vendor-grid-template)] xl:items-center"
      role="button"
      tabIndex={0}
      onClick={() => onViewDetails(vendor)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onViewDetails(vendor)
        }
      }}
    >
      {showColumn('vendor') ? (
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full border bg-surface text-sm font-semibold',
              vendor.vendorStatus === 'SUSPENDED'
                ? 'border-danger/25 text-danger'
                : vendorNeedsAttention(vendor)
                  ? 'border-warning/25 text-warning'
                  : 'border-success/25 text-success',
            )}
          >
            {getVendorInitials(vendor.shopName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">
                {vendor.shopName}
              </p>
              <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
                {vendor.vendorStatus}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{vendor.publicVendorId}</p>
            <p className="truncate text-xs text-muted">
              {vendor.ownerName ?? vendor.mobileNumber}
            </p>
          </div>
        </div>
      ) : null}

      {showColumn('category') ? (
        <div className="space-y-1 text-sm">
          <p className="text-foreground">{vendor.category?.name ?? 'Unassigned'}</p>
          <p className="text-xs text-muted">
            {vendor.category?.categoryCode ?? 'No category code'}
          </p>
        </div>
      ) : null}

      {showColumn('city') ? (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-4 text-muted" />
            <span>{vendor.address.city || 'No city'}</span>
          </div>
          <p className="pl-6 text-xs text-muted">
            {vendor.address.zone?.zoneName ?? 'No zone'}
          </p>
        </div>
      ) : null}

      {showColumn('vendorStatus') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Vendor status</p>
          <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
            {vendor.vendorStatus}
          </Badge>
        </div>
      ) : null}

      {showColumn('onboarding') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Onboarding</p>
          <Badge tone={getOnboardingStatusTone(vendor.onboardingStatus)}>
            {vendor.onboardingStatus}
          </Badge>
        </div>
      ) : null}

      {showColumn('payout') ? (
        <div className="space-y-1 text-sm">
          <Badge tone={getPayoutAccountTone(vendor)}>
            {getPayoutAccountLabel(vendor)}
          </Badge>
          <p className="text-xs text-muted">{getPayoutAccountMeta(vendor)}</p>
        </div>
      ) : null}

      {showColumn('documents') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Documents</p>
          <Badge tone={getDocumentSummaryTone(vendor)}>
            {getDocumentSummaryLabel(vendor)}
          </Badge>
        </div>
      ) : null}

      {showColumn('updatedAt') ? (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-muted">Updated</p>
          <p className="text-foreground">{formatDateSafe(vendor.updatedAt)}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
        {recommendedAction ? (
          <Button
            disabled={
              isSubmitting ||
              (recommendedAction === 'APPROVE' && Boolean(approvalBlockMessage))
            }
            size="sm"
            title={
              recommendedAction === 'APPROVE'
                ? approvalBlockMessage ?? undefined
                : undefined
            }
            type="button"
            variant={
              recommendedAction === 'REJECT' || recommendedAction === 'SUSPEND'
                ? 'danger'
                : recommendedAction === 'ADD_NOTE' || recommendedAction === 'REACTIVATE'
                  ? 'secondary'
                  : 'primary'
            }
            onClick={(event) => {
              event.stopPropagation()
              openRecommendedAction()
            }}
          >
            {recommendedAction === 'ADD_NOTE' ? (
              <MessageSquarePlus className="mr-2 size-4" />
            ) : (
              <ArrowUpRight className="mr-2 size-4" />
            )}
            {primaryActionLabel(vendor)}
          </Button>
        ) : null}
        {showAddNoteAction ? (
          <button
            aria-label={`Add note for ${vendor.shopName}`}
            className="btn-icon disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Add note"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(vendor, 'ADD_NOTE')
            }}
          >
            <MessageSquarePlus className="size-4" />
          </button>
        ) : null}
        {showApproveAction ? (
          <button
            aria-label={`Approve ${vendor.shopName}`}
            className="btn-icon text-success hover:text-success disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || Boolean(approvalBlockMessage)}
            title={approvalBlockMessage ?? 'Approve vendor'}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(vendor, 'APPROVE')
            }}
          >
            <CheckCircle2 className="size-4" />
          </button>
        ) : null}
        {showRejectAction ? (
          <button
            aria-label={`Reject ${vendor.shopName}`}
            className="btn-icon text-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Reject vendor"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(vendor, 'REJECT')
            }}
          >
            <XCircle className="size-4" />
          </button>
        ) : null}
        {showSuspendAction ? (
          <button
            aria-label={`Suspend ${vendor.shopName}`}
            className="btn-icon text-warning hover:text-warning disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Suspend vendor"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(vendor, 'SUSPEND')
            }}
          >
            <PauseCircle className="size-4" />
          </button>
        ) : null}
        {showReactivateAction ? (
          <button
            aria-label={`Reactivate ${vendor.shopName}`}
            className="btn-icon text-success hover:text-success disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            title="Reactivate vendor"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpenAction(vendor, 'REACTIVATE')
            }}
          >
            <RotateCcw className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  )
}

function buildMetrics(vendors: VendorTableRow[], pagination?: VendorPagination) {
  const needsReview = vendors.filter(vendorNeedsAttention).length
  const payoutReview = vendors.filter(
    (vendor) => getPayoutAccountTone(vendor) !== 'success',
  ).length
  const suspended = vendors.filter(
    (vendor) => vendor.vendorStatus === 'SUSPENDED',
  ).length

  return [
    {
      label: 'Needs review',
      value: String(needsReview),
      meta: 'Warnings, onboarding, or payout work',
      tone: 'warning' as const,
    },
    {
      label: 'Payout review',
      value: String(payoutReview),
      meta: 'Primary account missing or pending',
      tone: payoutReview ? ('warning' as const) : ('success' as const),
    },
    {
      label: 'Suspended',
      value: String(suspended),
      meta: 'Vendors currently paused',
      tone: suspended ? ('danger' as const) : ('neutral' as const),
    },
    {
      label: 'Visible vendors',
      value: String(pagination?.totalItems ?? vendors.length),
      meta: 'Matching current filters',
      tone: 'info' as const,
    },
  ]
}

function buildQueueItems(vendors: VendorTableRow[]) {
  return [
    {
      key: 'active' as const,
      label: 'Active',
      count: vendors.filter((vendor) => vendor.vendorStatus === 'ACTIVE').length,
    },
    {
      key: 'onboarding' as const,
      label: 'Onboarding',
      count: vendors.filter((vendor) => vendor.onboardingStatus !== 'APPROVED').length,
    },
    {
      key: 'underReview' as const,
      label: 'Under review',
      count: vendors.filter((vendor) => vendor.onboardingStatus === 'UNDER_REVIEW')
        .length,
    },
    {
      key: 'documentsPending' as const,
      label: 'Documents pending',
      count: vendors.filter(
        (vendor) => vendor.onboardingStatus === 'DOCUMENTS_PENDING',
      ).length,
    },
    {
      key: 'suspended' as const,
      label: 'Suspended',
      count: vendors.filter((vendor) => vendor.vendorStatus === 'SUSPENDED').length,
    },
  ]
}

export function VendorsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<VendorViewMode>('active')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categoryLookupLabel, setCategoryLookupLabel] = useState('')
  const [onboardingStatus, setOnboardingStatus] = useState<
    '' | VendorOnboardingStatus
  >('')
  const [vendorStatus, setVendorStatus] = useState<'' | VendorStatus>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<VendorActionTarget | null>(null)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<VendorColumnId[]>(defaultVendorColumns)
  const [columnWidths, setColumnWidths] =
    useState<VendorColumnWidths>(loadVendorColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VENDOR_COLUMN_WIDTH_STORAGE_KEY,
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
    columnId: VendorColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getVendorColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getVendorColumnMinWidth(columnId),
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

  const resetColumnWidth = (columnId: VendorColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getVendorColumnDefaultWidth(columnId),
    }))
  }

  const adjustColumnWidth = (columnId: VendorColumnWidthId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getVendorColumnMinWidth(columnId),
        getVendorColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetToFirstPage = () => setPage(1)

  const query = useMemo<VendorListQueryParams>(
    () => ({
      page,
      limit,
      ...getVendorQuery(viewMode, vendorStatus),
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryId.trim() || undefined,
      onboardingStatus: onboardingStatus || undefined,
    }),
    [
      categoryId,
      city,
      limit,
      onboardingStatus,
      page,
      search,
      vendorStatus,
      viewMode,
    ],
  )

  const vendorQuery = useQuery({
    queryKey: ['vendors', viewMode, query],
    queryFn: () =>
      viewMode === 'onboarding'
        ? vendorService.getVendorOnboardingQueue(query)
        : vendorService.getVendorList(query),
  })

  const vendors = vendorQuery.data?.data ?? []
  const tableVendors: VendorTableRow[] = vendors
  const pagination = vendorQuery.data?.pagination
  const isInitialLoading = vendorQuery.isLoading && !vendorQuery.data
  const isRefreshing = vendorQuery.isFetching && Boolean(vendorQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(vendorQuery.dataUpdatedAt)

  const metrics = buildMetrics(tableVendors, pagination)
  const queueItems = buildQueueItems(tableVendors)

  const vendorGridStyle = useMemo<VendorGridStyle>(
    () => ({
      '--vendor-grid-template': getVendorGridTemplate(visibleColumns, columnWidths),
      '--vendor-grid-min-width': getVendorGridMinWidth(visibleColumns, columnWidths),
    }),
    [columnWidths, visibleColumns],
  )

  const hasActiveFilters = Boolean(
    search ||
      city ||
      categoryId ||
      onboardingStatus ||
      vendorStatus ||
      viewMode !== 'active',
  )

  const clearVendorFilters = () => {
    setViewMode('active')
    setSearch('')
    setCity('')
    setCategoryId('')
    setCategoryLookupLabel('')
    setOnboardingStatus('')
    setVendorStatus('')
    setPage(1)
  }

  const applyQueue = (queue: VendorQueueKey) => {
    if (queue === 'active') {
      setViewMode('active')
      setVendorStatus('ACTIVE')
      setOnboardingStatus('')
    }

    if (queue === 'onboarding') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('')
    }

    if (queue === 'underReview') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('UNDER_REVIEW')
    }

    if (queue === 'documentsPending') {
      setViewMode('onboarding')
      setVendorStatus('')
      setOnboardingStatus('DOCUMENTS_PENDING')
    }

    if (queue === 'suspended') {
      setViewMode('active')
      setVendorStatus('SUSPENDED')
      setOnboardingStatus('')
    }

    setPage(1)
  }

  const isQueueActive = (queue: VendorQueueKey) => {
    if (queue === 'active') {
      return viewMode === 'active' && (vendorStatus === '' || vendorStatus === 'ACTIVE')
    }

    if (queue === 'onboarding') {
      return viewMode === 'onboarding' && !onboardingStatus && !vendorStatus
    }

    if (queue === 'underReview') {
      return viewMode === 'onboarding' && onboardingStatus === 'UNDER_REVIEW'
    }

    if (queue === 'documentsPending') {
      return viewMode === 'onboarding' && onboardingStatus === 'DOCUMENTS_PENDING'
    }

    return vendorStatus === 'SUSPENDED'
  }

  const toggleColumn = (columnId: VendorColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const viewDetails = (vendor: VendorTableRow) => {
    navigate(`${routePaths.vendors}/${vendor.vendorId}`)
  }

  const openAction = (vendor: VendorTableRow, kind: VendorListActionKind) => {
    setActionError(null)
    setActionTarget({ action: { kind }, vendor })
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: VendorActionTarget
      values: VendorActionFormValues
    }) => {
      const { action, vendor } = target

      if (action.kind === 'APPROVE') {
        const approvalBlockMessage = getApprovalBlockMessage(vendor)

        if (approvalBlockMessage) {
          throw new Error(approvalBlockMessage)
        }

        return vendorService.approveVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT') {
        if (!values.reason) throw new Error('Rejection reason is required.')

        return vendorService.rejectVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'SUSPEND') {
        if (!values.reason) throw new Error('Suspension reason is required.')

        return vendorService.suspendVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REACTIVATE') {
        if (!values.reason) throw new Error('Reactivation reason is required.')

        return vendorService.reactivateVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return vendorService.addVendorNote(vendor.vendorId, {
          note: values.note,
        })
      }

      throw new Error('Unsupported vendor action from list view.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['vendors'] })
      void queryClient.invalidateQueries({
        queryKey: ['vendor-detail', variables.target.vendor.vendorId],
      })
      void queryClient.invalidateQueries({ queryKey: ['vendor-onboarding'] })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Vendor action failed.',
      )
    },
  })

  const submitAction = (values: VendorActionFormValues) => {
    if (!actionTarget) return

    void actionMutation.mutateAsync({
      target: actionTarget,
      values,
    })
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description={
          viewMode === 'active'
            ? 'Live vendors currently active in the platform.'
            : 'Vendors waiting for onboarding review and approval.'
        }
        placement="topbar"
        title="Vendors"
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
                  aria-label="Expand vendor filters"
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
                      aria-label="Collapse vendor filters"
                      className="btn-icon"
                      title="Collapse filters"
                      type="button"
                      onClick={() => setFiltersCollapsed(true)}
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {queueItems.map((queue) => (
                      <button
                        className={cn(
                          'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border px-3 text-left text-sm transition',
                          isQueueActive(queue.key)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                        )}
                        key={queue.key}
                        type="button"
                        onClick={() => applyQueue(queue.key)}
                      >
                        <span className="font-medium">{queue.label}</span>
                        <span className="text-xs font-semibold">
                          {queue.count}
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
                        onClick={clearVendorFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
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
                    <LookupSelect
                      fetchOptions={searchCategoryLookupOptions}
                      label="Category"
                      placeholder="Search category"
                      queryKey={['lookup', 'categories']}
                      selectedLabel={categoryLookupLabel}
                      value={categoryId}
                      onChange={(value, option) => {
                        setCategoryId(value)
                        setCategoryLookupLabel(option?.label ?? '')
                        resetToFirstPage()
                      }}
                    />
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Onboarding status
                      </span>
                      <select
                        className="form-input"
                        value={onboardingStatus}
                        onChange={(event) => {
                          setOnboardingStatus(
                            event.target.value as '' | VendorOnboardingStatus,
                          )
                          resetToFirstPage()
                        }}
                      >
                        <option value="">All</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="SUBMITTED">SUBMITTED</option>
                        <option value="DOCUMENTS_PENDING">DOCUMENTS_PENDING</option>
                        <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Vendor status
                      </span>
                      <select
                        className="form-input"
                        value={vendorStatus}
                        onChange={(event) => {
                          setVendorStatus(event.target.value as '' | VendorStatus)
                          resetToFirstPage()
                        }}
                      >
                        <option value="">Default</option>
                        <option value="PENDING">PENDING</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
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
                  Vendor operations
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} vendors · ${viewMode === 'active' ? 'active workspace' : 'onboarding queue'}`
                    : 'Search, filter, and manage vendor onboarding from backend data.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search vendor, owner, mobile"
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
                      {vendorDataColumns.map((column) => {
                        const isChecked = visibleColumns.includes(column.id)
                        const isRequiredLastColumn =
                          isChecked && visibleColumns.length === 1

                        return (
                          <label
                            className={cn(
                              'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                              isRequiredLastColumn && 'cursor-not-allowed opacity-60',
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
                  onClick={() => void vendorQuery.refetch()}
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

            {vendorQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load vendor data. Please retry."
                  title="Vendor data unavailable"
                  onRetry={() => void vendorQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <VendorRowsSkeleton />
              </div>
            ) : tableVendors.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description={
                    viewMode === 'active'
                      ? 'No active vendors were found.'
                      : 'No vendors are currently in the onboarding queue.'
                  }
                  title={viewMode === 'active' ? 'No active vendors' : 'Queue is empty'}
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--vendor-grid-min-width)]"
                    style={vendorGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--vendor-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      {vendorDataColumns
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
                            resetColumnWidth(VENDOR_ACTION_COLUMN_ID)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowLeft') {
                              event.preventDefault()
                              adjustColumnWidth(VENDOR_ACTION_COLUMN_ID, -16)
                            }

                            if (event.key === 'ArrowRight') {
                              event.preventDefault()
                              adjustColumnWidth(VENDOR_ACTION_COLUMN_ID, 16)
                            }
                          }}
                          onPointerDown={(event) =>
                            startColumnResize(VENDOR_ACTION_COLUMN_ID, event)
                          }
                        >
                          <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                        </button>
                      </div>
                    </div>

                    <div>
                      {tableVendors.map((vendor) => (
                        <VendorRow
                          isSubmitting={actionMutation.isPending}
                          key={vendor.vendorId}
                          vendor={vendor}
                          visibleColumns={visibleColumns}
                          onOpenAction={openAction}
                          onViewDetails={viewDetails}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <VendorPagination
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
        <VendorActionModal
          action={actionTarget.action}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          vendor={actionTarget.vendor}
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
