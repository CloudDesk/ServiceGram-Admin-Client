import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  PauseCircle,
  PencilLine,
  RefreshCcw,
  SlidersHorizontal,
  Store,
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
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  isOpenableMediaUrl,
  useMediaViewer,
  type MediaViewerItem,
} from '../../../components/media'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import {
  searchCategoryLookupOptions,
  searchVendorLookupOptions,
} from '../../lookups/adminLookups'
import { reelService } from '../services/reel.service'
import {
  ReelActionModal,
  type ReelActionFormValues,
  type ReelActionKind,
  type ReelActionSelection,
} from './ReelActionModal'
import type {
  AdminReel,
  AdminReelsQueryParams,
  ReelContentType,
  ReelModerationStatus,
  ReelUploadStatus,
} from '../types/reel.types'

type ReelViewMode = 'pending' | 'live'
type ReelTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type ReelQueueKey = ReelViewMode
type ReelPreviewTab = 'summary' | 'review' | 'media'

const DEFAULT_PAGE_SIZE = 10
const REEL_DEFAULT_COLUMN_WIDTH = 220
const REEL_GRID_COLUMN_GAP = 12
const REEL_GRID_INLINE_PADDING = 24
const REEL_ACTION_COLUMN_ID = 'actions'
const REEL_ACTION_COLUMN_DEFAULT_WIDTH = 220
const REEL_ACTION_COLUMN_MIN_WIDTH = 208
const REEL_ACTION_COLUMN_MAX_WIDTH = 240
const REEL_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.reel.columnWidths.v3'
const REEL_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

interface ActiveFilterChip {
  key: string
  label: string
  onClear: () => void
}

const reelContentTypes: ReelContentType[] = [
  'BEFORE_AFTER',
  'SERVICE_DEMO',
  'NEW_OFFER',
  'INTRODUCTION',
]

const reelUploadStatuses: ReelUploadStatus[] = [
  'UPLOAD_REQUESTED',
  'UPLOADING',
  'PROCESSING',
  'READY',
  'FAILED',
]

const reelModerationStatuses: ReelModerationStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'EDIT_REQUESTED',
  'PAUSED',
  'REMOVED',
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

const reelDataColumns = [
  {
    id: 'reel',
    label: 'Reel',
    defaultWidth: 280,
    minWidth: 220,
  },
  {
    id: 'vendor',
    label: 'Vendor',
    defaultWidth: 250,
    minWidth: 210,
  },
  {
    id: 'category',
    label: 'Category',
    defaultWidth: 200,
    minWidth: 165,
  },
  {
    id: 'content',
    label: 'Content',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'media',
    label: 'Media',
    defaultWidth: 190,
    minWidth: 155,
  },
  {
    id: 'moderation',
    label: 'Moderation',
    defaultWidth: 220,
    minWidth: 180,
  },
  {
    id: 'visibility',
    label: 'Visibility',
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

type ReelColumnId = (typeof reelDataColumns)[number]['id']
type ReelColumnWidthId = ReelColumnId | typeof REEL_ACTION_COLUMN_ID
type ReelColumnWidths = Partial<Record<ReelColumnWidthId, number>>

const defaultReelColumns: ReelColumnId[] = [
  'reel',
  'vendor',
  'category',
  'media',
  'moderation',
  'visibility',
]

interface ReelGridStyle extends CSSProperties {
  '--reel-grid-template': string
  '--reel-grid-min-width': string
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

function buildReelListMediaItems(reel: AdminReel): MediaViewerItem[] {
  const relatedItems: MediaViewerItem[] = []
  const thumbnailUrl = isOpenableMediaUrl(reel.media.thumbnailUrl)
    ? reel.media.thumbnailUrl
    : null
  const playbackUrl = isOpenableMediaUrl(reel.media.playbackUrl)
    ? reel.media.playbackUrl
    : null

  if (thumbnailUrl) {
    relatedItems.push({
      description: `${humanizeCode(reel.media.uploadStatus)} thumbnail.`,
      downloadUrl: thumbnailUrl,
      height: reel.media.height ?? null,
      id: `${reel.reelId}-thumbnail`,
      kind: 'image',
      ownerLabel: reel.vendor.shopName,
      sourceLabel: 'Reel thumbnail',
      src: thumbnailUrl,
      title: `${reel.publicReelId} thumbnail`,
      width: reel.media.width ?? null,
    })
  }

  if (reel.media.cloudflareVideoUid || playbackUrl) {
    relatedItems.push({
      cloudflareVideoUid: reel.media.cloudflareVideoUid,
      description: reel.media.durationSeconds
        ? `${reel.media.durationSeconds} seconds`
        : humanizeCode(reel.media.uploadStatus),
      downloadUrl: playbackUrl,
      height: reel.media.height ?? null,
      id: `${reel.reelId}-video`,
      kind: reel.media.cloudflareVideoUid ? 'cloudflare-video' : 'video',
      ownerLabel: reel.vendor.shopName,
      posterUrl: thumbnailUrl,
      sourceLabel: 'Reel playback',
      src: playbackUrl,
      title: `${reel.publicReelId} video`,
      width: reel.media.width ?? null,
    })
  }

  if (!relatedItems.length) return []

  return [
    {
      description: reel.media.durationSeconds
        ? `${reel.media.durationSeconds} seconds`
        : humanizeCode(reel.media.uploadStatus),
      downloadUrl: playbackUrl ?? thumbnailUrl,
      height: reel.media.height ?? null,
      id: `${reel.reelId}-media`,
      kind: 'reel',
      ownerLabel: reel.vendor.shopName,
      relatedItems,
      sourceLabel: 'Reel media',
      src: playbackUrl ?? thumbnailUrl,
      title: `${reel.publicReelId} media`,
      width: reel.media.width ?? null,
    },
  ]
}

function getReelListVideoIndex(items: MediaViewerItem[]) {
  const videoIndex = items.findIndex(
    (item) => item.kind === 'cloudflare-video' || item.kind === 'video',
  )

  return videoIndex >= 0 ? videoIndex : 0
}

function getUploadStatusTone(status: ReelUploadStatus): ReelTone {
  if (status === 'READY') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PROCESSING' || status === 'UPLOADING') return 'warning'
  return 'neutral'
}

function getModerationStatusTone(status: ReelModerationStatus): ReelTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED' || status === 'REMOVED') return 'danger'
  if (status === 'PENDING_REVIEW' || status === 'EDIT_REQUESTED') {
    return 'warning'
  }
  if (status === 'PAUSED') return 'info'
  return 'neutral'
}

interface ReelQueueCounts {
  pending: number
  live: number
}

function buildReelQueueItems(counts?: ReelQueueCounts) {
  return [
    {
      key: 'pending' as const,
      label: 'Pending review',
      count: counts?.pending,
    },
    {
      key: 'live' as const,
      label: 'Live reels',
      count: counts?.live,
    },
  ]
}

function getReelColumnDefaultWidth(columnId: ReelColumnWidthId) {
  if (columnId === REEL_ACTION_COLUMN_ID) {
    return REEL_ACTION_COLUMN_DEFAULT_WIDTH
  }

  return (
    reelDataColumns.find((column) => column.id === columnId)?.defaultWidth ??
    REEL_DEFAULT_COLUMN_WIDTH
  )
}

function getReelColumnMinWidth(columnId: ReelColumnWidthId) {
  if (columnId === REEL_ACTION_COLUMN_ID) {
    return REEL_ACTION_COLUMN_MIN_WIDTH
  }

  return reelDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
}

function clampReelColumnWidth(columnId: ReelColumnWidthId, width: number) {
  const nextWidth = Math.max(getReelColumnMinWidth(columnId), Math.round(width))

  if (columnId === REEL_ACTION_COLUMN_ID) {
    return Math.min(nextWidth, REEL_ACTION_COLUMN_MAX_WIDTH)
  }

  return nextWidth
}

function getReelColumnWidth(
  columnWidths: ReelColumnWidths,
  columnId: ReelColumnWidthId,
) {
  return clampReelColumnWidth(
    columnId,
    columnWidths[columnId] ?? getReelColumnDefaultWidth(columnId),
  )
}

function getReelGridTemplate(
  visibleColumns: ReelColumnId[],
  columnWidths: ReelColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getReelColumnWidth(columnWidths, columnId)}px`,
    ),
    `${getReelColumnWidth(columnWidths, REEL_ACTION_COLUMN_ID)}px`,
  ].join(' ')
}

function getReelGridMinWidth(
  visibleColumns: ReelColumnId[],
  columnWidths: ReelColumnWidths,
) {
  const visibleWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getReelColumnWidth(columnWidths, columnId),
    0,
  )
  const actionWidth = getReelColumnWidth(columnWidths, REEL_ACTION_COLUMN_ID)
  const columnCount = visibleColumns.length + 2
  const gapWidth = Math.max(0, columnCount - 1) * REEL_GRID_COLUMN_GAP

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    actionWidth +
    gapWidth +
    REEL_GRID_INLINE_PADDING
  }px`
}

function loadReelColumnWidths(): ReelColumnWidths {
  try {
    const storedValue = window.localStorage.getItem(REEL_COLUMN_WIDTH_STORAGE_KEY)

    if (!storedValue) return {}

    const parsedValue = JSON.parse(storedValue) as ReelColumnWidths

    return Object.fromEntries(
      Object.entries(parsedValue)
        .filter(([, width]) => typeof width === 'number')
        .map(([columnId, width]) => [
          columnId,
          clampReelColumnWidth(columnId as ReelColumnWidthId, width as number),
        ]),
    ) as ReelColumnWidths
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

function ReelRowsSkeleton() {
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

const reelActionPriority: ReelActionKind[] = [
  'APPROVE',
  'REQUEST_EDIT',
  'REJECT',
  'PAUSE',
  'REMOVE',
  'SOFT_DELETE',
  'HARD_DELETE',
]

function isReelActionKind(action: string | null | undefined): action is ReelActionKind {
  return Boolean(action) && reelActionPriority.includes(action as ReelActionKind)
}

function isDangerReelAction(kind: ReelActionKind) {
  return (
    kind === 'REJECT' ||
    kind === 'REMOVE' ||
    kind === 'SOFT_DELETE' ||
    kind === 'HARD_DELETE'
  )
}

function reelActionLabel(kind: ReelActionKind) {
  return {
    APPROVE: 'Approve',
    REJECT: 'Reject',
    REQUEST_EDIT: 'Request edit',
    PAUSE: 'Pause',
    REMOVE: 'Remove',
    SOFT_DELETE: 'Soft delete',
    HARD_DELETE: 'Hard delete',
  }[kind]
}

function reelPreviewActionIcon(kind: ReelActionKind) {
  if (kind === 'APPROVE') return <CheckCircle2 className="size-4" />
  if (isDangerReelAction(kind)) return <XCircle className="size-4" />
  if (kind === 'PAUSE') return <PauseCircle className="size-4" />

  return <PencilLine className="size-4" />
}

function canRunReelListAction({
  canDeleteReels,
  canModerateReels,
  kind,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  kind: ReelActionKind
}) {
  if (kind === 'SOFT_DELETE' || kind === 'HARD_DELETE') return canDeleteReels

  return canModerateReels
}

function canOpenReelAction({
  canDeleteReels,
  canModerateReels,
  kind,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  kind: ReelActionKind
  reel: AdminReel
}) {
  return (
    reel.availableActions.includes(kind) &&
    canRunReelListAction({ canDeleteReels, canModerateReels, kind })
  )
}

function getPrimaryReelAction({
  canDeleteReels,
  canModerateReels,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  reel: AdminReel
}) {
  const recommendedAction = isReelActionKind(reel.nextRecommendedAction)
    ? reel.nextRecommendedAction
    : null

  if (
    recommendedAction &&
    canOpenReelAction({
      canDeleteReels,
      canModerateReels,
      kind: recommendedAction,
      reel,
    })
  ) {
    return recommendedAction
  }

  return (
    reelActionPriority.find((kind) =>
      canOpenReelAction({ canDeleteReels, canModerateReels, kind, reel }),
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

function ReelSummaryField({
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

function ReelPreviewPanel({
  canDeleteReels,
  canModerateReels,
  canReadVendors,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenDetails,
  onOpenMedia,
  onOpenVendor,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  canReadVendors: boolean
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (kind: ReelActionKind, reel: AdminReel) => void
  onOpenDetails: (reel: AdminReel) => void
  onOpenMedia: (reel: AdminReel) => void
  onOpenVendor: (reel: AdminReel) => void
  reel: AdminReel
}) {
  const [activeTab, setActiveTab] = useState<ReelPreviewTab>('summary')
  const mediaItems = buildReelListMediaItems(reel)
  const primaryAction = getPrimaryReelAction({
    canDeleteReels,
    canModerateReels,
    reel,
  })
  const previewTabs: { key: ReelPreviewTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'review', label: 'Review' },
    { key: 'media', label: 'Media' },
  ]
  const secondaryActions = reelActionPriority.filter(
    (kind) =>
      kind !== primaryAction &&
      canOpenReelAction({ canDeleteReels, canModerateReels, kind, reel }),
  )
  const primaryPreviewAction: QuickPreviewAction | null = primaryAction
    ? {
        disabled: isSubmitting,
        icon: reelPreviewActionIcon(primaryAction),
        key: primaryAction,
        label: reelActionLabel(primaryAction),
        onClick: () => onOpenAction(primaryAction, reel),
        variant: isDangerReelAction(primaryAction) ? 'danger' : 'primary',
      }
    : null
  const detailAction: QuickPreviewAction = {
    icon: <ArrowUpRight className="size-4" />,
    key: 'details',
    label: primaryPreviewAction ? 'Detail' : 'Open detail',
    onClick: () => onOpenDetails(reel),
  }
  const secondaryPreviewActions: QuickPreviewAction[] = secondaryActions.map(
    (kind) => ({
      disabled: isSubmitting,
      icon: reelPreviewActionIcon(kind),
      key: kind,
      label: reelActionLabel(kind),
      onClick: () => onOpenAction(kind, reel),
      variant: isDangerReelAction(kind) ? 'danger' : 'secondary',
    }),
  )

  return (
    <>
      <button
        aria-label="Close reel preview"
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
                  {reel.publicReelId}
                </h2>
                <Badge tone={getModerationStatusTone(reel.moderation.status)}>
                  {humanizeCode(reel.moderation.status)}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted">
                {reel.vendor.shopName} / {reel.category?.name ?? 'No category'}
              </p>
            </div>
            <button
              aria-label="Close reel preview panel"
              className="btn-icon shrink-0"
              title="Close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={getUploadStatusTone(reel.media.uploadStatus)}>
              {humanizeCode(reel.media.uploadStatus)}
            </Badge>
            <Badge
              tone={
                reel.publish.customerVisibility === 'VISIBLE'
                  ? 'success'
                  : 'neutral'
              }
            >
              {humanizeCode(reel.publish.customerVisibility)}
            </Badge>
            {reel.warnings.length ? (
              <Badge tone="warning">
                {reel.warnings.length} warning
                {reel.warnings.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </div>
        </div>

        <QuickPreviewTabs
          activeTab={activeTab}
          ariaLabel="Reel preview sections"
          tabs={previewTabs}
          onChange={setActiveTab}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'summary' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
                <ReelSummaryField
                  label="Caption"
                  value={
                    <p className="line-clamp-3 text-sm">
                      {reel.caption ?? 'No caption'}
                    </p>
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <ReelSummaryField
                  label="Type"
                  value={humanizeCode(reel.contentType)}
                />
                <ReelSummaryField
                  label="Duration"
                  value={
                    reel.media.durationSeconds
                      ? `${reel.media.durationSeconds} sec`
                      : 'Not available'
                  }
                />
                <ReelSummaryField
                  label="Price"
                  value={reel.priceIndicator ?? 'Not available'}
                />
                <ReelSummaryField
                  label="Updated"
                  value={formatDateSafe(reel.updatedAt)}
                />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <ReelSummaryField label="Vendor" value={reel.vendor.shopName} />
                <p className="mt-1 truncate text-xs text-muted">
                  {reel.vendor.publicVendorId} /{' '}
                  {reel.vendor.zone?.zoneName ?? reel.vendor.city}
                </p>
                {canReadVendors ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => onOpenVendor(reel)}
                  >
                    <Store className="mr-2 size-4" />
                    Open vendor
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'review' ? (
            <div className="space-y-3">
              <div className="rounded-[0.75rem] border border-border p-3">
                <ReelSummaryField
                  label="Recommended next"
                  value={
                    reel.nextRecommendedAction
                      ? humanizeCode(reel.nextRecommendedAction)
                      : 'No immediate action'
                  }
                />
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Missing fields
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reel.missingFields.length ? (
                    reel.missingFields.map((field) => (
                      <Badge key={field} tone="warning">
                        {humanizeCode(field)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No missing fields</Badge>
                  )}
                </div>
              </div>
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Blockers
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reel.blockingReasons.length ? (
                    reel.blockingReasons.map((reason) => (
                      <Badge key={reason} tone="danger">
                        {humanizeCode(reason)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No blockers</Badge>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'media' ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[0.75rem] border border-border bg-surface-muted/45">
                <div className="flex aspect-video items-center justify-center">
                  {isOpenableMediaUrl(reel.media.thumbnailUrl) ? (
                    <img
                      alt={`Thumbnail for ${reel.publicReelId}`}
                      className="h-full w-full object-cover"
                      src={reel.media.thumbnailUrl}
                    />
                  ) : (
                    <div className="text-sm text-muted">No thumbnail</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-[0.75rem] border border-border p-3">
                <ReelSummaryField
                  label="Upload"
                  value={humanizeCode(reel.media.uploadStatus)}
                />
                <ReelSummaryField
                  label="Video UID"
                  value={reel.media.cloudflareVideoUid ?? 'Not available'}
                />
                <ReelSummaryField
                  label="Size"
                  value={
                    reel.media.width && reel.media.height
                      ? `${reel.media.width} x ${reel.media.height}`
                      : 'Not available'
                  }
                />
                <ReelSummaryField
                  label="Aspect"
                  value={reel.media.aspectRatio ?? 'Not available'}
                />
              </div>
              <Button
                className="w-full"
                disabled={!mediaItems.length}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => onOpenMedia(reel)}
              >
                <Eye className="mr-2 size-4" />
                Open media
              </Button>
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

function ReelCell({
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

export function ReelsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { openMediaViewer } = useMediaViewer()
  const canReadVendors = usePermission('vendors:read')
  const canModerateReels = usePermission('reels:moderate')
  const canDeleteReels = usePermission('reels:delete')
  const seededViewMode =
    searchParams.get('view') === 'live' ? 'live' : ('pending' as ReelViewMode)
  const seededContentTypes = readEnumSearchValues(
    searchParams,
    'contentType',
    reelContentTypes,
  )
  const seededUploadStatuses = readEnumSearchValues(
    searchParams,
    'uploadStatus',
    reelUploadStatuses,
  )
  const seededModerationStatuses = readEnumSearchValues(
    searchParams,
    'moderationStatus',
    reelModerationStatuses,
  )
  const [viewMode, setViewMode] = useState<ReelViewMode>(seededViewMode)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>(() =>
    readInitialLookup(searchParams, 'categoryId', 'categoryLabel'),
  )
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>(() =>
    readInitialLookup(searchParams, 'vendorId', 'vendorLabel'),
  )
  const [selectedContentTypes, setSelectedContentTypes] =
    useState<ReelContentType[]>(() => seededContentTypes)
  const [selectedUploadStatuses, setSelectedUploadStatuses] =
    useState<ReelUploadStatus[]>(() => seededUploadStatuses)
  const [selectedModerationStatuses, setSelectedModerationStatuses] =
    useState<ReelModerationStatus[]>(() => seededModerationStatuses)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [previewReelId, setPreviewReelId] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] =
    useState<ReelColumnId[]>(defaultReelColumns)
  const [columnWidths, setColumnWidths] =
    useState<ReelColumnWidths>(loadReelColumnWidths)
  const [selectedAction, setSelectedAction] =
    useState<ReelActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        REEL_COLUMN_WIDTH_STORAGE_KEY,
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

  const contentTypeOptions = useMemo<LookupOption[]>(
    () =>
      reelContentTypes.map((contentType) => ({
        label: humanizeCode(contentType),
        value: contentType,
      })),
    [],
  )
  const uploadStatusOptions = useMemo<LookupOption[]>(
    () =>
      reelUploadStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const moderationStatusOptions = useMemo<LookupOption[]>(
    () =>
      reelModerationStatuses.map((status) => ({
        label: humanizeCode(status),
        value: status,
      })),
    [],
  )
  const categoryIds = useMemo(
    () => selectedCategories.map((category) => category.value),
    [selectedCategories],
  )
  const vendorIds = useMemo(
    () => selectedVendors.map((vendor) => vendor.value),
    [selectedVendors],
  )

  const resetToFirstPage = () => setPage(1)
  const clearSeededReelParams = () => {
    const seededKeys = [
      'categoryId',
      'categoryLabel',
      'city',
      'contentType',
      'moderationStatus',
      'search',
      'uploadStatus',
      'vendorId',
      'vendorLabel',
      'view',
    ] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const query = useMemo<AdminReelsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
      contentType:
        selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
      uploadStatus:
        selectedUploadStatuses.length > 0
          ? selectedUploadStatuses
          : undefined,
      moderationStatus:
        selectedModerationStatuses.length > 0
          ? selectedModerationStatuses
          : undefined,
    }),
    [
      categoryIds,
      city,
      limit,
      page,
      search,
      selectedContentTypes,
      selectedModerationStatuses,
      selectedUploadStatuses,
      vendorIds,
    ],
  )

  const reelsQuery = useQuery({
    queryKey: ['reels', viewMode, query],
    queryFn: () =>
      viewMode === 'pending'
        ? reelService.getPendingReels(query)
        : reelService.getLiveReels(query),
  })
  const queueCountBaseQuery = useMemo<AdminReelsQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      categoryId: categoryIds.length > 0 ? categoryIds : undefined,
      vendorId: vendorIds.length > 0 ? vendorIds : undefined,
      contentType:
        selectedContentTypes.length > 0 ? selectedContentTypes : undefined,
      uploadStatus:
        selectedUploadStatuses.length > 0
          ? selectedUploadStatuses
          : undefined,
    }),
    [
      categoryIds,
      city,
      search,
      selectedContentTypes,
      selectedUploadStatuses,
      vendorIds,
    ],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['reels', 'queue-counts', queueCountBaseQuery],
    queryFn: async (): Promise<ReelQueueCounts> => {
      const [pendingResponse, liveResponse] = await Promise.all([
        reelService.getPendingReels(queueCountBaseQuery),
        reelService.getLiveReels(queueCountBaseQuery),
      ])

      return {
        pending: pendingResponse.pagination.totalItems,
        live: liveResponse.pagination.totalItems,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const reels = reelsQuery.data?.data ?? []
  const pagination = reelsQuery.data?.pagination
  const previewReel =
    reels.find((reel) => reel.reelId === previewReelId) ?? null
  const reelSelection = useListSelection(reels, (reel) => reel.reelId)
  const isInitialLoading = reelsQuery.isLoading && !reelsQuery.data
  const isRefreshing = reelsQuery.isFetching && Boolean(reelsQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(reelsQuery.dataUpdatedAt)
  const queueItems = buildReelQueueItems(queueCountsQuery.data)
  const reelGridStyle = useMemo<ReelGridStyle>(
    () => ({
      '--reel-grid-template': getReelGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--reel-grid-min-width': getReelGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )

  const hasActiveFilters = Boolean(
    search ||
      city ||
      categoryIds.length > 0 ||
      vendorIds.length > 0 ||
      selectedContentTypes.length > 0 ||
      selectedUploadStatuses.length > 0 ||
      selectedModerationStatuses.length > 0 ||
      viewMode !== 'pending',
  )

  const clearReelFilters = () => {
    clearSeededReelParams()
    setViewMode('pending')
    setSearch('')
    setCity('')
    setSelectedCategories([])
    setSelectedVendors([])
    setSelectedContentTypes([])
    setSelectedUploadStatuses([])
    setSelectedModerationStatuses([])
    setPage(1)
  }

  const applyQueue = (nextQueue: ReelQueueKey) => {
    clearSeededReelParams()
    setViewMode(nextQueue)
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
  const queueLabel = queueItems.find((queueItem) => queueItem.key === viewMode)?.label

  addActiveFilterChip(viewMode !== 'pending', 'queue', `Queue: ${queueLabel ?? viewMode}`, () => {
    applyQueue('pending')
  })
  addActiveFilterChip(Boolean(search.trim()), 'search', `Search: ${search.trim()}`, () => {
    clearSeededReelParams()
    setSearch('')
    resetToFirstPage()
  })
  addActiveFilterChip(Boolean(city.trim()), 'city', `City: ${city.trim()}`, () => {
    clearSeededReelParams()
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
      clearSeededReelParams()
      setSelectedCategories([])
      setSelectedVendors([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedVendors.length > 0,
    'vendor',
    `Vendor: ${selectedVendors[0]?.label ?? selectedVendors[0]?.value}${
      selectedVendors.length > 1 ? ` +${selectedVendors.length - 1}` : ''
    }`,
    () => {
      clearSeededReelParams()
      setSelectedVendors([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedContentTypes.length > 0,
    'content',
    `Content: ${humanizeCode(selectedContentTypes[0] ?? '')}${
      selectedContentTypes.length > 1 ? ` +${selectedContentTypes.length - 1}` : ''
    }`,
    () => {
      clearSeededReelParams()
      setSelectedContentTypes([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedUploadStatuses.length > 0,
    'upload',
    `Upload: ${humanizeCode(selectedUploadStatuses[0] ?? '')}${
      selectedUploadStatuses.length > 1
        ? ` +${selectedUploadStatuses.length - 1}`
        : ''
    }`,
    () => {
      clearSeededReelParams()
      setSelectedUploadStatuses([])
      resetToFirstPage()
    },
  )
  addActiveFilterChip(
    selectedModerationStatuses.length > 0,
    'moderation',
    `Moderation: ${humanizeCode(selectedModerationStatuses[0] ?? '')}${
      selectedModerationStatuses.length > 1
        ? ` +${selectedModerationStatuses.length - 1}`
        : ''
    }`,
    () => {
      clearSeededReelParams()
      setSelectedModerationStatuses([])
      resetToFirstPage()
    },
  )

  const startColumnResize = (
    columnId: ReelColumnWidthId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getReelColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: clampReelColumnWidth(columnId, nextWidth),
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

  const resetColumnWidth = (columnId: ReelColumnWidthId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: getReelColumnDefaultWidth(columnId),
    }))
  }

  const toggleColumn = (columnId: ReelColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        if (currentColumns.length === 1) return currentColumns

        return currentColumns.filter((currentColumn) => currentColumn !== columnId)
      }

      return [...currentColumns, columnId]
    })
  }

  const showColumn = (columnId: ReelColumnId) =>
    visibleColumns.includes(columnId)

  const viewDetails = (reel: AdminReel) => {
    navigate(`${routePaths.reels}/${reel.reelId}`)
  }

  const viewVendor = (reel: AdminReel) => {
    navigate(`${routePaths.vendors}/${reel.vendor.vendorId}`)
  }

  const viewReelMedia = (
    reel: AdminReel,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()

    const mediaItems = buildReelListMediaItems(reel)

    if (mediaItems.length) {
      openMediaViewer({
        items: mediaItems,
        startIndex: getReelListVideoIndex(mediaItems),
      })
    }
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: ReelActionSelection
      values: ReelActionFormValues
    }) => {
      if (action.kind === 'APPROVE') {
        return reelService.approveReel(action.reel.reelId, {
          reason: values.reason,
        })
      }

      if (!values.reason) {
        throw new Error('Reason is required for this reel action.')
      }

      if (action.kind === 'REJECT') {
        return reelService.rejectReel(action.reel.reelId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REQUEST_EDIT') {
        return reelService.requestReelEdit(action.reel.reelId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'PAUSE') {
        return reelService.pauseReel(action.reel.reelId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'SOFT_DELETE' || action.kind === 'HARD_DELETE') {
        return reelService.deleteReel(action.reel.reelId, {
          hardDelete: action.kind === 'HARD_DELETE',
          reason: values.reason,
        })
      }

      return reelService.removeReel(action.reel.reelId, {
        reason: values.reason,
      })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Reel action completed.')
      void queryClient.invalidateQueries({ queryKey: ['reels'] })
      void queryClient.invalidateQueries({
        queryKey: ['reel-detail', variables.action.reel.reelId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Reel action failed.',
      )
    },
  })

  const openReelAction = (
    kind: ReelActionKind,
    reel: AdminReel,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()
    if (!reel.availableActions.includes(kind)) return
    if (kind === 'SOFT_DELETE' || kind === 'HARD_DELETE') {
      if (!canDeleteReels) return
    } else if (!canModerateReels) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, reel })
  }

  const renderReelCells = (reel: AdminReel) => (
    <>
      {showColumn('reel') ? (
        <ReelCell label="Reel">
          <p className="truncate font-semibold">{reel.publicReelId}</p>
          <p className="mt-1 line-clamp-1 text-xs text-muted">
            {reel.caption ?? 'No caption'}
          </p>
        </ReelCell>
      ) : null}
      {showColumn('vendor') ? (
        <ReelCell label="Vendor">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-semibold">{reel.vendor.shopName}</p>
            {canReadVendors ? (
              <button
                aria-label={`Open vendor ${reel.vendor.shopName}`}
                className="btn-icon size-7 shrink-0"
                title="Open vendor"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  viewVendor(reel)
                }}
              >
                <Store className="size-3.5" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {reel.vendor.publicVendorId} · {reel.vendor.city}
          </p>
        </ReelCell>
      ) : null}
      {showColumn('category') ? (
        <ReelCell label="Category">
          <p className="truncate font-semibold">
            {reel.category?.name ?? 'Unassigned'}
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {reel.category?.categoryCode ?? 'No category code'}
          </p>
        </ReelCell>
      ) : null}
      {showColumn('content') ? (
        <ReelCell label="Content">
          <Badge tone="neutral">{humanizeCode(reel.contentType)}</Badge>
          <p className="mt-1 truncate text-xs text-muted">
            {reel.priceIndicator ?? 'No price indicator'}
          </p>
        </ReelCell>
      ) : null}
      {showColumn('media') ? (
        <ReelCell label="Media">
          <Badge tone={getUploadStatusTone(reel.media.uploadStatus)}>
            {humanizeCode(reel.media.uploadStatus)}
          </Badge>
          <p className="mt-1 text-xs text-muted">
            {reel.media.durationSeconds
              ? `${reel.media.durationSeconds} seconds`
              : 'Duration unavailable'}
          </p>
        </ReelCell>
      ) : null}
      {showColumn('moderation') ? (
        <ReelCell label="Moderation">
          <Badge tone={getModerationStatusTone(reel.moderation.status)}>
            {humanizeCode(reel.moderation.status)}
          </Badge>
          {reel.warnings.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              {reel.warnings.length} warning
              {reel.warnings.length === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="mt-1 truncate text-xs text-muted">
              {reel.nextRecommendedAction
                ? humanizeCode(reel.nextRecommendedAction)
                : 'No next action'}
            </p>
          )}
        </ReelCell>
      ) : null}
      {showColumn('visibility') ? (
        <ReelCell label="Visibility">
          <Badge
            tone={
              reel.publish.customerVisibility === 'VISIBLE'
                ? 'success'
                : 'neutral'
            }
          >
            {humanizeCode(reel.publish.customerVisibility)}
          </Badge>
          <p className="mt-1 truncate text-xs text-muted">
            Published {formatDateSafe(reel.publish.publishedAt)}
          </p>
        </ReelCell>
      ) : null}
      {showColumn('updatedAt') ? (
        <ReelCell label="Updated">
          <p className="font-semibold">{formatDateSafe(reel.updatedAt)}</p>
          <p className="mt-1 text-xs text-muted">
            Created {formatDateSafe(reel.createdAt)}
          </p>
        </ReelCell>
      ) : null}
    </>
  )

  const renderRowActions = (reel: AdminReel) => {
    const mediaItems = buildReelListMediaItems(reel)
    const primaryAction = getPrimaryReelAction({
      canDeleteReels,
      canModerateReels,
      reel,
    })
    const primaryActionText = primaryAction ? reelActionLabel(primaryAction) : ''

    return (
      <div className="workbench-sticky-action-cell flex min-w-0 flex-nowrap items-center justify-end gap-1.5 pl-2">
        <button
          aria-label={`Open media for ${reel.publicReelId}`}
          className="btn-icon disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!mediaItems.length}
          title="Open media"
          type="button"
          onClick={(event) => viewReelMedia(reel, event)}
        >
          <Eye className="size-4" />
        </button>
        {primaryAction ? (
          <Button
            className="w-[7.75rem] shrink-0 overflow-hidden px-2.5"
            disabled={actionMutation.isPending}
            size="sm"
            title={primaryActionText}
            type="button"
            variant={isDangerReelAction(primaryAction) ? 'danger' : 'primary'}
            onClick={(event) => openReelAction(primaryAction, reel, event)}
          >
            {primaryAction === 'APPROVE' ? (
              <CheckCircle2 className="mr-2 size-4 shrink-0" />
            ) : isDangerReelAction(primaryAction) ? (
              <XCircle className="mr-2 size-4 shrink-0" />
            ) : primaryAction === 'PAUSE' ? (
              <PauseCircle className="mr-2 size-4 shrink-0" />
            ) : (
              <PencilLine className="mr-2 size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">{primaryActionText}</span>
          </Button>
        ) : null}
        <button
          aria-label={`Open ${reel.publicReelId} details`}
          className="btn-icon"
          title="Open detail"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            viewDetails(reel)
          }}
        >
          <ArrowUpRight className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader layout="workspace" placement="topbar" title="Reels" />

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="flex min-w-0 flex-col xl:min-h-0 xl:flex-1">
        <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
          <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(8rem,auto)_minmax(24rem,1fr)_auto] xl:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Reels</h2>
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
                ariaLabel="Search reels"
                className="w-full min-w-0"
                placeholder="Search reels, captions, vendors..."
                value={search}
                onChange={(nextSearch) => {
                  clearSeededReelParams()
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
                      {reelDataColumns.map((column) => {
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
                  onClick={() => void reelsQuery.refetch()}
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
                const isActive = viewMode === queueItem.key

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
              onClearAll={clearReelFilters}
            />

            {filtersOpen ? (
              <div className="mt-3 rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(11rem,1fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(9rem,0.8fr)_auto] 2xl:items-end">
                  <MultiSelectFilter
                    label="Content"
                    options={contentTypeOptions}
                    placeholder="All content"
                    values={selectedContentTypes}
                    onChange={(values) => {
                      clearSeededReelParams()
                      setSelectedContentTypes(values as ReelContentType[])
                      resetToFirstPage()
                    }}
                  />
                  <MultiSelectFilter
                    label="Upload"
                    options={uploadStatusOptions}
                    placeholder="All uploads"
                    values={selectedUploadStatuses}
                    onChange={(values) => {
                      clearSeededReelParams()
                      setSelectedUploadStatuses(values as ReelUploadStatus[])
                      resetToFirstPage()
                    }}
                  />
                  <MultiSelectFilter
                    label="Moderation"
                    options={moderationStatusOptions}
                    placeholder="All statuses"
                    values={selectedModerationStatuses}
                    onChange={(values) => {
                      clearSeededReelParams()
                      setSelectedModerationStatuses(
                        values as ReelModerationStatus[],
                      )
                      resetToFirstPage()
                    }}
                  />
                  <LookupMultiSelect
                    fetchOptions={searchCategoryLookupOptions}
                    label="Category"
                    placeholder="Search category"
                    queryKey={['lookup', 'categories', 'reels']}
                    selectedOptions={selectedCategories}
                    onChange={(options) => {
                      clearSeededReelParams()
                      setSelectedCategories(options)
                      setSelectedVendors([])
                      resetToFirstPage()
                    }}
                  />
                  <LookupMultiSelect
                    fetchOptions={(term) =>
                      searchVendorLookupOptions(term, {
                        categoryIds,
                      })
                    }
                    label="Vendor"
                    placeholder={
                      categoryIds.length > 0
                        ? 'Search matching vendors'
                        : 'Search vendor'
                    }
                    queryKey={['lookup', 'vendors', 'reels', categoryIds]}
                    selectedOptions={selectedVendors}
                    onChange={(options) => {
                      clearSeededReelParams()
                      setSelectedVendors(options)
                      resetToFirstPage()
                    }}
                  />
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-muted">City</span>
                    <Input
                      className={REEL_FILTER_CONTROL_CLASS_NAME}
                      placeholder="Chennai"
                      value={city}
                      onChange={(event) => {
                        clearSeededReelParams()
                        setCity(event.target.value)
                        resetToFirstPage()
                      }}
                    />
                  </label>
                  <Button
                    className="h-10 w-full"
                    disabled={!hasActiveFilters}
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={clearReelFilters}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          {reelsQuery.isError ? (
            <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <ErrorState
                description="We could not load reel data. Please retry."
                title="Reel data unavailable"
                onRetry={() => void reelsQuery.refetch()}
              />
            </div>
          ) : isInitialLoading ? (
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <ReelRowsSkeleton />
            </div>
          ) : reels.length === 0 ? (
            <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <EmptyState
                actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
                description={
                  hasActiveFilters
                    ? 'No matches.'
                    : viewMode === 'pending'
                      ? 'No reels are waiting for review.'
                      : 'No live reels.'
                }
                title={viewMode === 'pending' ? 'No reels' : 'No live reels'}
                onAction={hasActiveFilters ? clearReelFilters : undefined}
              />
            </div>
          ) : (
            <div
              className={cn(
                'min-h-0 xl:flex-1',
                previewReel
                  ? 'grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-3 xl:p-3'
                  : 'flex flex-col',
              )}
            >
              <div className="flex min-w-0 flex-col overflow-hidden xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--reel-grid-min-width)]"
                    style={reelGridStyle}
                  >
                    <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--reel-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted shadow-[0_1px_0_var(--adaptive-border)] xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={reelSelection.allVisibleSelected}
                          indeterminate={reelSelection.someVisibleSelected}
                          label="Select visible reels"
                          onChange={reelSelection.setVisibleSelected}
                        />
                      </div>
                      {reelDataColumns
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
                            resetColumnWidth(REEL_ACTION_COLUMN_ID)
                          }
                          onPointerDown={(event) =>
                            startColumnResize(REEL_ACTION_COLUMN_ID, event)
                          }
                        />
                      </div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={reelSelection.allVisibleSelected}
                      selectedCount={reelSelection.selectedCount}
                      visibleCount={reelSelection.visibleCount}
                      onClear={reelSelection.clearSelection}
                      onSelectVisible={() =>
                        reelSelection.setVisibleSelected(true)
                      }
                    />

                    <div className="divide-y divide-border">
                      {reels.map((reel) => {
                        const isPreviewed = previewReelId === reel.reelId
                        const isSelected = reelSelection.isSelected(reel.reelId)

                        return (
                          <div
                            aria-label={`Preview reel ${reel.publicReelId}`}
                            aria-selected={isPreviewed || isSelected}
                            className={cn(
                              'workbench-grid-row grid w-full cursor-pointer gap-3 px-3 py-2.5 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--reel-grid-template)]',
                              isSelected && 'bg-primary/5 hover:bg-primary/10',
                              isPreviewed &&
                                'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
                            )}
                            key={reel.reelId}
                            role="button"
                            style={reelGridStyle}
                            tabIndex={0}
                            onClick={() => setPreviewReelId(reel.reelId)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return

                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setPreviewReelId(reel.reelId)
                              }
                            }}
                          >
                            <div className="flex min-w-0 items-start xl:items-center">
                              <ListSelectionCheckbox
                                checked={isSelected}
                                label={`Select reel ${reel.reelId}`}
                                onChange={(selected) =>
                                  reelSelection.setItemSelected(
                                    reel.reelId,
                                    selected,
                                  )
                                }
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                              {renderReelCells(reel)}
                            </div>
                            {renderRowActions(reel)}
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

              {previewReel ? (
                <ReelPreviewPanel
                  canDeleteReels={canDeleteReels}
                  canModerateReels={canModerateReels}
                  canReadVendors={canReadVendors}
                  isSubmitting={actionMutation.isPending}
                  reel={previewReel}
                  onClose={() => setPreviewReelId(null)}
                  onOpenAction={openReelAction}
                  onOpenDetails={viewDetails}
                  onOpenMedia={viewReelMedia}
                  onOpenVendor={viewVendor}
                />
              ) : null}
            </div>
          )}
        </main>
      </section>

      <ReelActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${selectedAction.reel.reelId}`
            : 'closed'
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
