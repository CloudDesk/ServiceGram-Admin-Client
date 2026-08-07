import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  UserRound,
  X,
  XCircle,
} from 'lucide-react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import { settingsService } from '../../settings/services/settings.service'
import { influencerService } from '../services/influencer.service'
import {
  InfluencerActionModal,
  type InfluencerActionFormValues,
  type InfluencerActionSelection,
} from './InfluencerActionModal'
import type {
  AdminInfluencer,
  AdminInfluencersQueryParams,
  InfluencerActionKind,
  InfluencerSocialProfile,
  InfluencersSummary,
  InfluencerStatus,
} from '../types/influencer.types'

type InfluencerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type InfluencerPreviewTab = 'summary' | 'application' | 'activity'
type InfluencerQueueKey =
  | 'pending'
  | 'approved'
  | 'suspended'
  | 'rejected'
  | 'all'

const DEFAULT_PAGE_SIZE = 10
const INFLUENCER_DEFAULT_COLUMN_WIDTH = 220
const INFLUENCER_GRID_COLUMN_GAP = 12
const INFLUENCER_GRID_INLINE_PADDING = 24
const INFLUENCER_ACTION_COLUMN_ID = 'actions'
const INFLUENCER_ACTION_COLUMN_DEFAULT_WIDTH = 232
const INFLUENCER_ACTION_COLUMN_MIN_WIDTH = 216
const INFLUENCER_ACTION_COLUMN_MAX_WIDTH = 252
const INFLUENCER_COLUMN_WIDTH_STORAGE_KEY =
  'servicegram.influencer.columnWidths.v2'
const INFLUENCER_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

interface ActiveFilterChip {
  key: string
  label: string
  onClear: () => void
}

const influencerStatuses: InfluencerStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'NOT_APPLIED',
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

function readInitialLookup(searchParams: URLSearchParams, idKey: string, labelKey: string) {
  const value = searchParams.get(idKey) ?? ''
  const label = searchParams.get(labelKey) ?? value

  return value ? [{ label, value }] : []
}

function queueKeyForInfluencerStatuses(
  selectedStatuses: InfluencerStatus[],
): InfluencerQueueKey {
  if (selectedStatuses.length === 0) return 'all'
  if (selectedStatuses.length !== 1) return 'all'

  const [status] = selectedStatuses

  if (status === 'PENDING_REVIEW') return 'pending'
  if (status === 'APPROVED') return 'approved'
  if (status === 'SUSPENDED') return 'suspended'
  if (status === 'REJECTED') return 'rejected'

  return 'all'
}

const influencerDataColumns = [
  {
    id: 'creator',
    label: 'Creator',
    defaultWidth: 280,
    minWidth: 220,
  },
  {
    id: 'customer',
    label: 'Customer',
    defaultWidth: 250,
    minWidth: 210,
  },
  {
    id: 'city',
    label: 'City',
    defaultWidth: 180,
    minWidth: 145,
  },
  {
    id: 'status',
    label: 'Status',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'activity',
    label: 'Reels',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'bookings',
    label: 'Bookings',
    defaultWidth: 180,
    minWidth: 150,
  },
  {
    id: 'commission',
    label: 'Commission',
    defaultWidth: 210,
    minWidth: 170,
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    defaultWidth: 175,
    minWidth: 150,
  },
] as const

type InfluencerColumnId = (typeof influencerDataColumns)[number]['id']
type InfluencerColumnWidthId =
  | InfluencerColumnId
  | typeof INFLUENCER_ACTION_COLUMN_ID
type InfluencerColumnWidths = Partial<Record<InfluencerColumnWidthId, number>>

const defaultInfluencerColumns: InfluencerColumnId[] = [
  'creator',
  'customer',
  'city',
  'status',
  'activity',
  'commission',
]

interface InfluencerGridStyle extends CSSProperties {
  '--influencer-grid-template': string
  '--influencer-grid-min-width': string
}

function statusTone(status: InfluencerStatus | string): InfluencerTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'PENDING_REVIEW') return 'warning'
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger'
  return 'neutral'
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

function formatPaise(amountPaise: number, currency = 'INR') {
  return formatMoney(amountPaise / 100, currency)
}

function socialPlatformLabel(platform: InfluencerSocialProfile['platform']) {
  if (platform === 'INSTAGRAM') return 'Instagram'
  if (platform === 'YOUTUBE') return 'YouTube'
  if (platform === 'FACEBOOK') return 'Facebook'
  return 'X'
}

function socialProfilesSummary(
  profiles: InfluencerSocialProfile[] | undefined,
  fallbackHandle?: string | null,
) {
  if (profiles?.length) {
    return profiles.map((profile) => socialPlatformLabel(profile.platform)).join(' · ')
  }

  return fallbackHandle ?? ''
}

function formatCommissionValue(value: unknown) {
  if (!value || typeof value !== 'object') {
    return 'Not configured'
  }

  const config = value as {
    enabled?: boolean
    commissionType?: string
    commissionValue?: number
  }

  if (config.enabled === false) {
    return 'Disabled'
  }

  if (config.commissionType === 'FIXED') {
    return `${formatPaise(config.commissionValue ?? 0)} fixed`
  }

  const basisPoints =
    typeof config.commissionValue === 'number' ? config.commissionValue : 0

  return `${basisPoints / 100}% per booking`
}

function getInfluencerCustomerLabel(influencer: AdminInfluencer) {
  return (
    influencer.customer.fullName ??
    influencer.customer.mobileNumber ??
    influencer.customer.email ??
    influencer.customer.customerId
  )
}

function buildInfluencerQueueItems(summary?: InfluencersSummary) {
  return [
    {
      key: 'pending' as const,
      label: 'Pending review',
      count: summary?.PENDING_REVIEW,
    },
    {
      key: 'approved' as const,
      label: 'Approved',
      count: summary?.APPROVED,
    },
    {
      key: 'suspended' as const,
      label: 'Suspended',
      count: summary?.SUSPENDED,
    },
    {
      key: 'rejected' as const,
      label: 'Rejected',
      count: summary?.REJECTED,
    },
    {
      key: 'all' as const,
      label: 'All creators',
      count: summary?.total,
    },
  ]
}

function getInfluencerColumnDefaultWidth(columnId: InfluencerColumnWidthId) {
  if (columnId === INFLUENCER_ACTION_COLUMN_ID) {
    return INFLUENCER_ACTION_COLUMN_DEFAULT_WIDTH
  }

  return (
    influencerDataColumns.find((column) => column.id === columnId)
      ?.defaultWidth ?? INFLUENCER_DEFAULT_COLUMN_WIDTH
  )
}

function getInfluencerColumnMinWidth(columnId: InfluencerColumnWidthId) {
  if (columnId === INFLUENCER_ACTION_COLUMN_ID) {
    return INFLUENCER_ACTION_COLUMN_MIN_WIDTH
  }

  return (
    influencerDataColumns.find((column) => column.id === columnId)?.minWidth ??
    140
  )
}

function clampInfluencerColumnWidth(
  columnId: InfluencerColumnWidthId,
  width: number,
) {
  const nextWidth = Math.max(
    getInfluencerColumnMinWidth(columnId),
    Math.round(width),
  )

  if (columnId === INFLUENCER_ACTION_COLUMN_ID) {
    return Math.min(nextWidth, INFLUENCER_ACTION_COLUMN_MAX_WIDTH)
  }

  return nextWidth
}

function getInfluencerColumnWidth(
  columnWidths: InfluencerColumnWidths,
  columnId: InfluencerColumnWidthId,
) {
  return clampInfluencerColumnWidth(
    columnId,
    columnWidths[columnId] ?? getInfluencerColumnDefaultWidth(columnId),
  )
}

function getInfluencerGridTemplate(
  visibleColumns: InfluencerColumnId[],
  columnWidths: InfluencerColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getInfluencerColumnWidth(columnWidths, columnId)}px`,
    ),
    `${getInfluencerColumnWidth(columnWidths, INFLUENCER_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getInfluencerGridMinWidth(
  visibleColumns: InfluencerColumnId[],
  columnWidths: InfluencerColumnWidths,
) {
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getInfluencerColumnWidth(columnWidths, columnId),
    0,
  )
  const actionWidth = getInfluencerColumnWidth(
    columnWidths,
    INFLUENCER_ACTION_COLUMN_ID,
  )
  const columnCount = visibleColumns.length + 2
  const gapWidth = Math.max(0, columnCount - 1) * INFLUENCER_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    actionWidth +
    gapWidth +
    INFLUENCER_GRID_INLINE_PADDING
  }px`
}

function loadInfluencerColumnWidths(): InfluencerColumnWidths {
  try {
    const storedValue = window.localStorage.getItem(
      INFLUENCER_COLUMN_WIDTH_STORAGE_KEY,
    )

    if (!storedValue) return {}

    const parsedValue = JSON.parse(storedValue) as InfluencerColumnWidths

    return Object.fromEntries(
      Object.entries(parsedValue)
        .filter(([, width]) => typeof width === 'number')
        .map(([columnId, width]) => [
          columnId,
          clampInfluencerColumnWidth(
            columnId as InfluencerColumnWidthId,
            width as number,
          ),
        ]),
    ) as InfluencerColumnWidths
  } catch {
    return {}
  }
}

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(updatedAt))}`
}

function InfluencerRowsSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          className="grid gap-3 border-b border-border px-3 py-4 xl:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.9fr_0.9fr]"
          key={index}
        >
          {Array.from({ length: 6 }).map((__, cellIndex) => (
            <Skeleton className="h-9 w-full" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  )
}

const influencerActionPriority: InfluencerActionKind[] = [
  'APPROVE',
  'REACTIVATE',
  'REJECT',
  'SUSPEND',
]

function isDangerInfluencerAction(kind: InfluencerActionKind) {
  return kind === 'REJECT' || kind === 'SUSPEND'
}

function influencerActionLabel(kind: InfluencerActionKind) {
  return {
    APPROVE: 'Approve',
    REACTIVATE: 'Reactivate',
    REJECT: 'Reject',
    SUSPEND: 'Suspend',
  }[kind]
}

function influencerPreviewActionIcon(kind: InfluencerActionKind) {
  if (kind === 'APPROVE') return <CheckCircle2 className="size-4" />
  if (kind === 'REACTIVATE') return <RotateCcw className="size-4" />
  if (kind === 'SUSPEND') return <PauseCircle className="size-4" />

  return <XCircle className="size-4" />
}

function getPrimaryInfluencerAction({
  canReviewInfluencers,
  influencer,
}: {
  canReviewInfluencers: boolean
  influencer: AdminInfluencer
}) {
  if (!canReviewInfluencers) return null

  const recommendedAction =
    influencer.nextRecommendedAction &&
    influencerActionPriority.includes(
      influencer.nextRecommendedAction as InfluencerActionKind,
    )
      ? (influencer.nextRecommendedAction as InfluencerActionKind)
      : null

  if (
    recommendedAction &&
    influencer.availableActions.includes(recommendedAction)
  ) {
    return recommendedAction
  }

  return (
    influencerActionPriority.find((kind) =>
      influencer.availableActions.includes(kind),
    ) ?? null
  )
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[]
  onClearAll: () => void
}) {
  if (!chips.length) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={`Clear ${chip.label}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
            type="button"
            onClick={chip.onClear}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function InfluencerSummaryField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-1 min-w-0 text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function InfluencerPreviewPanel({
  canReadCustomers,
  canReviewInfluencers,
  commissionPolicy,
  influencer,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenCustomer,
  onOpenDetails,
}: {
  canReadCustomers: boolean
  canReviewInfluencers: boolean
  commissionPolicy: string
  influencer: AdminInfluencer
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (kind: InfluencerActionKind, influencer: AdminInfluencer) => void
  onOpenCustomer: (influencer: AdminInfluencer) => void
  onOpenDetails: (influencer: AdminInfluencer) => void
}) {
  const [activeTab, setActiveTab] = useState<InfluencerPreviewTab>('summary')
  const primaryAction = getPrimaryInfluencerAction({
    canReviewInfluencers,
    influencer,
  })
  const secondaryActions = canReviewInfluencers
    ? influencerActionPriority.filter(
        (kind) =>
          kind !== primaryAction && influencer.availableActions.includes(kind),
      )
    : []
  const previewTabs: { key: InfluencerPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'application', label: 'Application' },
    { key: 'activity', label: 'Activity' },
  ]
  const applicationReason =
    influencer.application?.reviewReason ??
    influencer.rejectionReason ??
    influencer.suspensionReason
  const categorySummary =
    influencer.preferredCategories
      ?.map((category) => category.name)
      .filter(Boolean)
      .join(', ') ||
    influencer.application?.preferredCategories
      ?.map((category) => category.name)
      .filter(Boolean)
      .join(', ') ||
    'Not available'
  const primaryPreviewAction: QuickPreviewAction | null = primaryAction
    ? {
        disabled: isSubmitting,
        icon: influencerPreviewActionIcon(primaryAction),
        key: primaryAction,
        label: influencerActionLabel(primaryAction),
        onClick: () => onOpenAction(primaryAction, influencer),
        variant: isDangerInfluencerAction(primaryAction) ? 'danger' : 'primary',
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <ArrowUpRight className="size-4" />,
    key: 'details',
    label: primaryPreviewAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(influencer),
  }
  const secondaryPreviewActions: QuickPreviewAction[] = secondaryActions.map(
    (kind) => ({
      disabled: isSubmitting,
      icon: influencerPreviewActionIcon(kind),
      key: kind,
      label: influencerActionLabel(kind),
      onClick: () => onOpenAction(kind, influencer),
      variant: isDangerInfluencerAction(kind) ? 'danger' : 'secondary',
    }),
  )

  return (
    <>
      <button
        aria-label="Close influencer preview"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:inset-x-auto xl:bottom-6 xl:right-6 xl:top-[calc(var(--spacing-topbar)+0.75rem)] xl:z-40 xl:w-96">
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                  {influencer.displayName}
                </h2>
                <Badge tone={statusTone(influencer.status)}>
                  {humanizeCode(influencer.status)}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {influencer.publicInfluencerId} /{' '}
                {socialProfilesSummary(
                  influencer.socialProfiles,
                  influencer.socialHandle,
                ) || 'No social handle'}
              </p>
            </div>
            <button
              aria-label="Close influencer preview panel"
              className="btn-icon shrink-0"
              title="Close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone="neutral">
              {influencer.summary.reelCount} reels
            </Badge>
            <Badge tone="neutral">
              {influencer.summary.attributedBookingCount} bookings
            </Badge>
            {influencer.warnings.length ? (
              <Badge tone="warning">
                {influencer.warnings.length} warning
                {influencer.warnings.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Influencer preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <InfluencerSummaryField
                  label="Customer"
                  value={getInfluencerCustomerLabel(influencer)}
                />
                <InfluencerSummaryField
                  label="City"
                  value={
                    influencer.customer.zone?.zoneName ??
                    influencer.customer.city ??
                    'Not available'
                  }
                />
                <InfluencerSummaryField
                  label="Commission"
                  value={formatPaise(influencer.summary.confirmedCommissionPaise)}
                />
                <InfluencerSummaryField label="Policy" value={commissionPolicy} />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <InfluencerSummaryField
                  label="Preferred categories"
                  value={<p className="line-clamp-3">{categorySummary}</p>}
                />
              </div>
              {canReadCustomers ? (
                <Button
                  className="w-full"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenCustomer(influencer)}
                >
                  <UserRound className="mr-2 size-4" />
                  Open customer
                </Button>
              ) : null}
            </div>
          ) : null}

          {activeTab === 'application' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <InfluencerSummaryField
                  label="Status"
                  value={humanizeCode(influencer.application?.status)}
                />
                <InfluencerSummaryField
                  label="Submitted"
                  value={formatDateSafe(influencer.application?.createdAt)}
                />
                <InfluencerSummaryField
                  label="Reviewed"
                  value={formatDateSafe(influencer.application?.reviewedAt)}
                />
                <InfluencerSummaryField
                  label="Social"
                  value={
                    socialProfilesSummary(
                      influencer.application?.socialProfiles,
                      influencer.application?.socialHandle,
                    ) || 'Not available'
                  }
                />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <InfluencerSummaryField
                  label="Motivation"
                  value={
                    <p className="line-clamp-4">
                      {influencer.application?.motivation ?? 'Not available'}
                    </p>
                  }
                />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <InfluencerSummaryField
                  label="Review reason"
                  value={
                    <p className="line-clamp-4">
                      {applicationReason ?? 'Not available'}
                    </p>
                  }
                />
              </div>
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <InfluencerSummaryField
                  label="Reels"
                  value={`${influencer.summary.liveReelCount} live / ${influencer.summary.pendingReelCount} pending`}
                />
                <InfluencerSummaryField
                  label="Bookings"
                  value={influencer.summary.attributedBookingCount}
                />
                <InfluencerSummaryField
                  label="Pending"
                  value={formatPaise(influencer.summary.pendingCommissionPaise)}
                />
                <InfluencerSummaryField
                  label="Last commission"
                  value={formatDateSafe(influencer.summary.lastCommissionAt)}
                />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Warnings
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {influencer.warnings.length ? (
                    influencer.warnings.map((warning) => (
                      <Badge key={warning} tone="warning">
                        {humanizeCode(warning)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No warnings</Badge>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <QuickPreviewActions
          detailAction={detailAction}
          primaryAction={primaryPreviewAction}
          secondaryActions={secondaryPreviewActions}
        />
      </aside>
    </>
  )
}

function InfluencerCell({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted xl:hidden">{label}</p>
      <div className="mt-1 min-w-0 text-sm text-foreground xl:mt-0">{children}</div>
    </div>
  )
}

export function InfluencersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReviewInfluencers = usePermission('influencers:review')
  const seededStatuses = readEnumSearchValues(
    searchParams,
    'status',
    influencerStatuses,
  )
  const initialStatuses =
    seededStatuses.length > 0
      ? seededStatuses
      : (['PENDING_REVIEW'] as InfluencerStatus[])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedStatuses, setSelectedStatuses] =
    useState<InfluencerStatus[]>(() => initialStatuses)
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>(() =>
    readInitialLookup(searchParams, 'categoryId', 'categoryLabel'),
  )
  const [queue, setQueue] = useState<InfluencerQueueKey>(() =>
    queueKeyForInfluencerStatuses(initialStatuses),
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewInfluencerId, setPreviewInfluencerId] = useState<string | null>(
    null,
  )
  const [visibleColumns, setVisibleColumns] =
    useState<InfluencerColumnId[]>(defaultInfluencerColumns)
  const [columnWidths, setColumnWidths] =
    useState<InfluencerColumnWidths>(loadInfluencerColumnWidths)
  const [selectedAction, setSelectedAction] =
    useState<InfluencerActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        INFLUENCER_COLUMN_WIDTH_STORAGE_KEY,
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
      influencerStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const categoryIds = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  )

  const resetToFirstPage = () => setPage(1)
  const clearSeededInfluencerParams = () => {
    const seededKeys = [
      'categoryId',
      'categoryLabel',
      'city',
      'queue',
      'search',
      'status',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const query = useMemo<AdminInfluencersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    }),
    [categoryIds, city, limit, page, search, selectedStatuses],
  )

  const influencersQuery = useQuery({
    queryKey: ['influencers', query],
    queryFn: () => influencerService.getInfluencers(query),
  })
  const queueCountBaseQuery = useMemo<AdminInfluencersQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
    }),
    [categoryIds, city, search],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['influencers', 'queue-counts', queueCountBaseQuery],
    queryFn: () => influencerService.getInfluencers(queueCountBaseQuery),
    placeholderData: (previousData) => previousData,
  })

  const commissionSettingQuery = useQuery({
    queryKey: ['settings', 'influencer-commission-phase1'],
    queryFn: () =>
      settingsService.getSettings({
        search: 'influencer.commission.phase1',
        limit: 10,
      }),
  })

  const influencers = influencersQuery.data?.data ?? []
  const pagination = influencersQuery.data?.pagination
  const summary = influencersQuery.data?.summary
  const previewInfluencer =
    influencers.find(
      (influencer) => influencer.influencerProfileId === previewInfluencerId,
    ) ?? null
  const influencerSelection = useListSelection(
    influencers,
    (influencer) => influencer.influencerProfileId,
  )
  const isInitialLoading = influencersQuery.isLoading && !influencersQuery.data
  const isRefreshing = influencersQuery.isFetching && Boolean(influencersQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(influencersQuery.dataUpdatedAt)
  const commissionSetting = commissionSettingQuery.data?.data.find(
    (setting) => setting.settingKey === 'influencer.commission.phase1',
  )
  const commissionPolicyLabel = commissionSettingQuery.isLoading
    ? 'Loading'
    : formatCommissionValue(commissionSetting?.value)
  const stableSummary = queueCountsQuery.data?.summary
  const queueSummary = stableSummary ?? summary
  const queueItems = buildInfluencerQueueItems(queueSummary)
  const influencerGridStyle = useMemo<InfluencerGridStyle>(
    () => ({
      '--influencer-grid-template': getInfluencerGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--influencer-grid-min-width': getInfluencerGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )
  const isDefaultStatusFilter =
    queue === 'pending' &&
    selectedStatuses.length === 1 &&
    selectedStatuses[0] === 'PENDING_REVIEW'

  const hasActiveFilters = Boolean(
    search ||
      city ||
      categoryIds.length > 0 ||
      !isDefaultStatusFilter,
  )

  const clearInfluencerFilters = () => {
    clearSeededInfluencerParams()
    setQueue('pending')
    setSearch('')
    setCity('')
    setSelectedStatuses(['PENDING_REVIEW'])
    setSelectedCategories([])
    setPage(1)
  }

  const applyQueue = (nextQueue: InfluencerQueueKey) => {
    clearSeededInfluencerParams()
    setQueue(nextQueue)

    if (nextQueue === 'pending') {
      setSelectedStatuses(['PENDING_REVIEW'])
    }

    if (nextQueue === 'approved') {
      setSelectedStatuses(['APPROVED'])
    }

    if (nextQueue === 'suspended') {
      setSelectedStatuses(['SUSPENDED'])
    }

    if (nextQueue === 'rejected') {
      setSelectedStatuses(['REJECTED'])
    }

    if (nextQueue === 'all') {
      setSelectedStatuses([])
    }

    setPage(1)
  }

  const activeFilterChips: ActiveFilterChip[] = []
  const addActiveFilterChip = (
    condition: boolean,
    key: string,
    label: string,
    onClear: () => void,
  ) => {
    if (condition) activeFilterChips.push({ key, label, onClear })
  }
  const queueLabel =
    queueItems.find((queueItem) => queueItem.key === queue)?.label ?? queue

  addActiveFilterChip(!isDefaultStatusFilter, 'queue', `Queue: ${queueLabel}`, () => {
    applyQueue('pending')
  })
  addActiveFilterChip(Boolean(search.trim()), 'search', `Search: ${search.trim()}`, () => {
    clearSeededInfluencerParams()
    setSearch('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(city.trim()), 'city', `City: ${city.trim()}`, () => {
    clearSeededInfluencerParams()
    setCity('')
    resetToFirstPage()
  })
  addActiveFilterChip(
    selectedCategories.length > 0,
    'category',
    `Category: ${selectedCategories[0]?.label ?? selectedCategories[0]?.value}${
      selectedCategories.length > 1 ? ` +${selectedCategories.length - 1}` : ''
    }`,
    () => {
      clearSeededInfluencerParams()
      setSelectedCategories([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    queue === 'all' && selectedStatuses.length > 0,
    'status',
    `Status: ${humanizeCode(selectedStatuses[0] ?? '')}${
      selectedStatuses.length > 1 ? ` +${selectedStatuses.length - 1}` : ''
    }`,
    () => {
      clearSeededInfluencerParams()
      setSelectedStatuses(['PENDING_REVIEW'])
      setQueue('pending')
      resetToFirstPage()
    },
  )

  const startColumnResize = (
    columnId: InfluencerColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getInfluencerColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: clampInfluencerColumnWidth(columnId, nextWidth),
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

  const resetColumnWidth = (columnId: InfluencerColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getInfluencerColumnDefaultWidth(columnId),
    }))
  }

  const toggleColumn = (columnId: InfluencerColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const showColumn = (columnId: InfluencerColumnId) =>
    visibleColumns.includes(columnId)

  const viewDetails = (influencer: AdminInfluencer) => {
    navigate(`${routePaths.influencers}/${influencer.influencerProfileId}`)
  }

  const viewCustomer = (influencer: AdminInfluencer) => {
    navigate(`${routePaths.customers}/${influencer.customer.customerId}`)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: InfluencerActionSelection
      values: InfluencerActionFormValues
    }) => {
      if (action.kind === 'APPROVE') {
        return influencerService.approveInfluencer(
          action.influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      if (
        (action.kind === 'REJECT' || action.kind === 'SUSPEND') &&
        !values.reason
      ) {
        throw new Error('Reason is required for this action.')
      }

      if (action.kind === 'REJECT') {
        return influencerService.rejectInfluencer(
          action.influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      if (action.kind === 'SUSPEND') {
        return influencerService.suspendInfluencer(
          action.influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      return influencerService.reactivateInfluencer(
        action.influencer.influencerProfileId,
        { reason: values.reason },
      )
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Influencer action completed.')
      void queryClient.invalidateQueries({ queryKey: ['influencers'] })
      void queryClient.invalidateQueries({
        queryKey: [
          'influencer-detail',
          variables.action.influencer.influencerProfileId,
        ],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Influencer action could not be completed.',
      )
    },
  })

  const openInfluencerAction = (
    kind: InfluencerActionKind,
    influencer: AdminInfluencer,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()

    if (!canReviewInfluencers || !influencer.availableActions.includes(kind)) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, influencer })
  }

  const renderInfluencerCells = (influencer: AdminInfluencer) => (
    <>
      {showColumn('creator') ? (
        <InfluencerCell label="Creator">
          <p className="truncate font-semibold">{influencer.displayName}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {influencer.publicInfluencerId}
            {socialProfilesSummary(
              influencer.socialProfiles,
              influencer.socialHandle,
            )
              ? ` · ${socialProfilesSummary(
                  influencer.socialProfiles,
                  influencer.socialHandle,
                )}`
              : ''}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('customer') ? (
        <InfluencerCell label="Customer">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold">
              {getInfluencerCustomerLabel(influencer)}
            </p>
            {canReadCustomers ? (
              <button
                aria-label={`Open customer ${getInfluencerCustomerLabel(influencer)}`}
                className="btn-icon size-7 shrink-0"
                title="Open customer"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  viewCustomer(influencer)
                }}
              >
                <UserRound className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {influencer.customer.mobileNumber ??
              influencer.customer.email ??
              influencer.customer.customerId}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('city') ? (
        <InfluencerCell label="City">
          <p className="truncate font-semibold">
            {influencer.customer.city ?? 'Not set'}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {influencer.customer.zone?.zoneName ?? 'No zone'}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('status') ? (
        <InfluencerCell label="Status">
          <Badge tone={statusTone(influencer.status)}>
            {humanizeCode(influencer.status)}
          </Badge>
          {influencer.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {influencer.warnings.length} warning
              {influencer.warnings.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="mt-1 truncate text-xs text-muted">
              {canReviewInfluencers && influencer.nextRecommendedAction
                ? humanizeCode(influencer.nextRecommendedAction)
                : canReviewInfluencers
                  ? 'No next action'
                  : 'Read only'}
            </p>
          )}
        </InfluencerCell>
      ) : null}
      {showColumn('activity') ? (
        <InfluencerCell label="Reels">
          <p className="font-semibold">
            {influencer.summary.reelCount} reel
            {influencer.summary.reelCount === 1 ? '' : 's'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {influencer.summary.liveReelCount} live ·{' '}
            {influencer.summary.pendingReelCount} pending
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('bookings') ? (
        <InfluencerCell label="Bookings">
          <p className="font-semibold">
            {influencer.summary.attributedBookingCount}
          </p>
          <p className="mt-1 text-xs text-muted">Attributed bookings</p>
        </InfluencerCell>
      ) : null}
      {showColumn('commission') ? (
        <InfluencerCell label="Commission">
          <p className="font-semibold">
            {formatPaise(influencer.summary.confirmedCommissionPaise)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Pending {formatPaise(influencer.summary.pendingCommissionPaise)}
          </p>
        </InfluencerCell>
      ) : null}
      {showColumn('updatedAt') ? (
        <InfluencerCell label="Updated">
          <p className="font-semibold">{formatDateSafe(influencer.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Approved {formatDateSafe(influencer.approvedAt)}
          </p>
        </InfluencerCell>
      ) : null}
    </>
  )

  const renderRowActions = (influencer: AdminInfluencer) => {
    const primaryAction = getPrimaryInfluencerAction({
      canReviewInfluencers,
      influencer,
    })
    const primaryActionText = primaryAction
      ? influencerActionLabel(primaryAction)
      : ''

    return (
      <div className="workbench-sticky-action-cell flex min-w-0 flex-nowrap items-center justify-end gap-1.5 pl-2">
        {canReadCustomers ? (
          <button
            aria-label={`Open customer ${getInfluencerCustomerLabel(influencer)}`}
            className="btn-icon"
            title="Open customer"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              viewCustomer(influencer)
            }}
          >
            <UserRound className="size-4" />
          </button>
        ) : null}
        {primaryAction ? (
          <Button
            className="w-[7.75rem] shrink-0 overflow-hidden px-2.5"
            disabled={actionMutation.isPending}
            size="sm"
            title={primaryActionText}
            type="button"
            variant={isDangerInfluencerAction(primaryAction) ? 'danger' : 'primary'}
            onClick={(event) =>
              openInfluencerAction(primaryAction, influencer, event)
            }
          >
            {primaryAction === 'APPROVE' ? (
              <CheckCircle2 className="mr-2 size-4 shrink-0" />
            ) : primaryAction === 'REACTIVATE' ? (
              <RotateCcw className="mr-2 size-4 shrink-0" />
            ) : primaryAction === 'SUSPEND' ? (
              <PauseCircle className="mr-2 size-4 shrink-0" />
            ) : (
              <XCircle className="mr-2 size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">{primaryActionText}</span>
          </Button>
        ) : null}
        <button
          aria-label={`Open ${influencer.displayName} details`}
          className="btn-icon"
          title="Open detail"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            viewDetails(influencer)
          }}
        >
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader layout="workspace" placement="topbar" title="Influencers" />

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
        <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
          <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(10rem,auto)_minmax(24rem,1fr)_auto] xl:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Influencers
                </h2>
                <span
                  className={cn(
                    'rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
              </div>

              <ListHeaderSearch
                ariaLabel="Search influencers"
                className="w-full min-w-0"
                placeholder="Search creators, handles, mobile..."
                value={search}
                onChange={(nextSearch) => {
                  clearSeededInfluencerParams()
                  setSearch(nextSearch)
                  resetToFirstPage()
                }}
              />

              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 xl:justify-end">
                <Button
                  aria-expanded={filtersOpen}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setFiltersOpen((current) => !current)}
                >
                  <Filter className="mr-2 size-4" />
                  Filters
                  {activeFilterChips.length ? (
                    <span className="ml-1 size-2 rounded-full bg-primary" />
                  ) : null}
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
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                      role="menu"
                    >
                      <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                        Visible columns
                      </p>
                      {influencerDataColumns.map((column) => {
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
                  onClick={() => void influencersQuery.refetch()}
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

            <div className="mt-3 flex gap-2 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/45 p-1">
              {queueItems.map((queueItem) => {
                const isActive = queue === queueItem.key

                return (
                  <button
                    className={cn(
                      'inline-flex min-h-9 min-w-max flex-1 items-center justify-center gap-2 rounded-[0.65rem] px-3 text-sm font-semibold transition',
                      isActive
                        ? 'bg-surface text-primary shadow-sm ring-1 ring-primary/25'
                        : 'text-muted hover:bg-surface/75 hover:text-foreground',
                    )}
                    key={queueItem.key}
                    type="button"
                    onClick={() => applyQueue(queueItem.key)}
                  >
                    <span>{queueItem.label}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs',
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

            <ActiveFilterChips
              chips={activeFilterChips}
              onClearAll={clearInfluencerFilters}
            />

            {filtersOpen ? (
              <div className="mt-3 rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_minmax(14rem,1fr)_minmax(10rem,0.8fr)_minmax(14rem,1fr)_auto] xl:items-end">
                  <MultiSelectFilter
                    label="Status"
                    options={statusOptions}
                    placeholder="All statuses"
                    values={selectedStatuses}
                    onChange={(values) => {
                      clearSeededInfluencerParams()
                      setSelectedStatuses(values as InfluencerStatus[])
                      setQueue('all')
                      resetToFirstPage()
                    }}
                  />
                  <LookupMultiSelect
                    fetchOptions={searchCategoryLookupOptions}
                    label="Preferred category"
                    placeholder="Search category"
                    queryKey={['lookup', 'categories', 'influencers']}
                    selectedOptions={selectedCategories}
                    onChange={(options) => {
                      clearSeededInfluencerParams()
                      setSelectedCategories(options)
                      resetToFirstPage()
                    }}
                  />
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">City</span>
                    <Input
                      className={INFLUENCER_FILTER_CONTROL_CLASS_NAME}
                      placeholder="Chennai"
                      value={city}
                      onChange={(event) => {
                        clearSeededInfluencerParams()
                        setCity(event.target.value)
                        resetToFirstPage()
                      }}
                    />
                  </label>
                  <div className="min-h-10 rounded-[0.75rem] border border-border bg-surface px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Settings2 className="size-4 shrink-0 text-muted" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold uppercase tracking-normal text-muted">
                          Commission policy
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {commissionPolicyLabel}
                        </p>
                      </div>
                      {commissionSetting ? (
                        <Link
                          className="ml-auto shrink-0 text-xs font-semibold text-primary"
                          to={`${routePaths.settings}/settings/${encodeURIComponent(
                            commissionSetting.settingKey,
                          )}`}
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    className="h-10 w-full"
                    disabled={!hasActiveFilters}
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={clearInfluencerFilters}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {influencersQuery.isError ? (
            <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <ErrorState
                description="We could not load creator applications."
                title="Influencers unavailable"
                onRetry={() => void influencersQuery.refetch()}
              />
            </div>
          ) : isInitialLoading ? (
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <InfluencerRowsSkeleton />
            </div>
          ) : influencers.length === 0 ? (
            <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <EmptyState
                actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
                description={
                  hasActiveFilters
                    ? 'No matches.'
                    : 'No creator applications are waiting for review.'
                }
                title="No creators"
                onAction={hasActiveFilters ? clearInfluencerFilters : undefined}
              />
            </div>
          ) : (
            <div
              className={cn(
                'min-h-0 xl:flex-1',
                previewInfluencer
                  ? 'grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-3 xl:p-3'
                  : 'flex flex-col',
              )}
            >
              <div className="flex min-w-0 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--influencer-grid-min-width)]"
                    style={influencerGridStyle}
                  >
                    <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--influencer-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={influencerSelection.allVisibleSelected}
                          indeterminate={influencerSelection.someVisibleSelected}
                          label="Select visible influencers"
                          onChange={influencerSelection.setVisibleSelected}
                        />
                      </div>
                      {influencerDataColumns
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
                            resetColumnWidth(INFLUENCER_ACTION_COLUMN_ID)
                          }
                          onPointerDown={(event) =>
                            startColumnResize(
                              INFLUENCER_ACTION_COLUMN_ID,
                              event,
                            )
                          }
                        />
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={influencerSelection.allVisibleSelected}
                      selectedCount={influencerSelection.selectedCount}
                      visibleCount={influencerSelection.visibleCount}
                      onClear={influencerSelection.clearSelection}
                      onSelectVisible={() =>
                        influencerSelection.setVisibleSelected(true)
                      }
                    />

                    <div className="divide-y divide-border">
                      {influencers.map((influencer) => {
                        const isPreviewed =
                          previewInfluencerId === influencer.influencerProfileId
                        const isSelected = influencerSelection.isSelected(
                          influencer.influencerProfileId,
                        )

                        return (
                          <div
                            aria-label={`Preview influencer ${influencer.displayName}`}
                            aria-selected={isPreviewed || isSelected}
                            className={cn(
                              'workbench-grid-row grid w-full cursor-pointer gap-3 px-3 py-2.5 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--influencer-grid-template)]',
                              isSelected && 'bg-primary/5 hover:bg-primary/10',
                              isPreviewed &&
                                'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
                            )}
                            key={influencer.influencerProfileId}
                            role="button"
                            style={influencerGridStyle}
                            tabIndex={0}
                            onClick={() =>
                              setPreviewInfluencerId(
                                influencer.influencerProfileId,
                              )
                            }
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return

                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setPreviewInfluencerId(
                                  influencer.influencerProfileId,
                                )
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-start xl:items-center">
                              <ListSelectionCheckbox
                                checked={isSelected}
                                label={`Select influencer ${influencer.influencerProfileId}`}
                                onChange={(selected) =>
                                  influencerSelection.setItemSelected(
                                    influencer.influencerProfileId,
                                    selected,
                                  )
                                }
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                              {renderInfluencerCells(influencer)}
                            </div>
                            {renderRowActions(influencer)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {pagination ? (
                  <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
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
                          aria-label="Rows per page"
                          className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
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
                    <div className="flex items-center gap-3 sm:justify-end">
                      <button
                        aria-label="Previous page"
                        className="btn-icon"
                        disabled={!pagination.hasPreviousPage}
                        type="button"
                        onClick={() => setPage((currentPage) => currentPage - 1)}
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
                        onClick={() => setPage((currentPage) => currentPage + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {previewInfluencer ? (
                <InfluencerPreviewPanel
                  canReadCustomers={canReadCustomers}
                  canReviewInfluencers={canReviewInfluencers}
                  commissionPolicy={commissionPolicyLabel}
                  influencer={previewInfluencer}
                  isSubmitting={actionMutation.isPending}
                  onClose={() => setPreviewInfluencerId(null)}
                  onOpenAction={openInfluencerAction}
                  onOpenCustomer={viewCustomer}
                  onOpenDetails={viewDetails}
                />
              ) : null}
            </div>
          )}
        </main>
      </section>

      <InfluencerActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${selectedAction.influencer.influencerProfileId}`
            : 'influencer-action-empty'
        }
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (selectedAction) {
            void actionMutation.mutateAsync({
              action: selectedAction,
              values,
            })
          }
        }}
      />
    </PageContainer>
  )
}
