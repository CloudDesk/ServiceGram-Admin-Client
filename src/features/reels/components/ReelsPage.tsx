import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
  PencilLine,
  RefreshCcw,
  SlidersHorizontal,
  Trash2,
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
import { useNavigate } from 'react-router-dom'
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
import { useAuthStore } from '../../../store/authStore'
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
  AdminReelsPagination,
  AdminReelsQueryParams,
  AdminReelsSummary,
  ReelContentType,
  ReelModerationStatus,
  ReelUploadStatus,
} from '../types/reel.types'

type ReelViewMode = 'pending' | 'live'
type ReelTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type ReelQueueKey = ReelViewMode

const DEFAULT_PAGE_SIZE = 10
const REEL_DEFAULT_COLUMN_WIDTH = 220
const REEL_GRID_COLUMN_GAP = 12
const REEL_GRID_INLINE_PADDING = 24
const REEL_ACTION_COLUMN_ID = 'actions'
const REEL_ACTION_COLUMN_DEFAULT_WIDTH = 640
const REEL_ACTION_COLUMN_MIN_WIDTH = 360
const REEL_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.reel.columnWidths.v2'

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

interface ReelMetric {
  label: string
  meta: string
  tone: ReelTone
  value: string
}

function toneClasses(tone: ReelTone) {
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

function buildReelMetrics(
  reels: AdminReel[],
  pagination?: AdminReelsPagination,
  summary?: AdminReelsSummary,
): ReelMetric[] {
  const total = pagination?.totalItems ?? summary?.total ?? reels.length
  const needsReview =
    summary?.byModerationStatus.PENDING_REVIEW ??
    reels.filter((reel) => reel.moderation.status === 'PENDING_REVIEW').length
  const readyMedia =
    summary?.byUploadStatus.READY ??
    reels.filter((reel) => reel.media.uploadStatus === 'READY').length
  const live =
    summary?.live ??
    reels.filter((reel) => reel.publish.customerVisibility === 'VISIBLE').length

  return [
    {
      label: 'Needs review',
      meta: 'Reels waiting for moderation',
      tone: needsReview > 0 ? 'warning' : 'neutral',
      value: String(needsReview),
    },
    {
      label: 'Ready media',
      meta: 'Video processing completed',
      tone: readyMedia > 0 ? 'success' : 'neutral',
      value: String(readyMedia),
    },
    {
      label: 'Live reels',
      meta: 'Visible to customers',
      tone: live > 0 ? 'info' : 'neutral',
      value: String(live),
    },
    {
      label: 'Visible reels',
      meta: 'Matching current filters',
      tone: 'info',
      value: String(total),
    },
  ]
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

function getReelColumnWidth(
  columnWidths: ReelColumnWidths,
  columnId: ReelColumnWidthId,
) {
  return columnWidths[columnId] ?? getReelColumnDefaultWidth(columnId)
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
      Object.entries(parsedValue).filter(([, width]) => typeof width === 'number'),
    ) as ReelColumnWidths
  } catch {
    return {}
  }
}

function formatRefreshTime(updatedAt: number) {
  if (!updatedAt) return 'Not refreshed yet'

  return `Updated ${formatDate(new Date(updatedAt).toISOString(), true)}`
}

function MetricCard({ label, meta, tone, value }: ReelMetric) {
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

function ReelCell({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 min-w-0 text-sm text-foreground">{children}</div>
    </div>
  )
}

export function ReelsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canModerateReels = useAuthStore((state) => state.can('reels:moderate'))
  const canDeleteReels = useAuthStore((state) => state.can('reels:delete'))
  const [viewMode, setViewMode] = useState<ReelViewMode>('pending')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<LookupOption[]>([])
  const [selectedVendors, setSelectedVendors] = useState<LookupOption[]>([])
  const [selectedContentTypes, setSelectedContentTypes] = useState<ReelContentType[]>([])
  const [selectedUploadStatuses, setSelectedUploadStatuses] = useState<ReelUploadStatus[]>([])
  const [selectedModerationStatuses, setSelectedModerationStatuses] = useState<ReelModerationStatus[]>([])
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
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
  const summary = reelsQuery.data?.summary
  const reelSelection = useListSelection(reels, (reel) => reel.reelId)
  const isInitialLoading = reelsQuery.isLoading && !reelsQuery.data
  const isRefreshing = reelsQuery.isFetching && Boolean(reelsQuery.data)
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing now'
    : formatRefreshTime(reelsQuery.dataUpdatedAt)
  const metrics = buildReelMetrics(reels, pagination, summary)
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
    setViewMode(nextQueue)
    setPage(1)
  }

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
        [columnId]: Math.max(
          getReelColumnMinWidth(columnId),
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
          <p className="truncate font-semibold">{reel.vendor.shopName}</p>
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
    const hasAction = (action: ReelActionKind) =>
      reel.availableActions.includes(action)

    return (
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {canModerateReels && hasAction('APPROVE') ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={(event) => openReelAction('APPROVE', reel, event)}
          >
            <CheckCircle2 className="mr-2 size-4" />
            Approve
          </Button>
        ) : null}
        {canModerateReels && hasAction('REJECT') ? (
          <Button
            size="sm"
            type="button"
            variant="danger"
            onClick={(event) => openReelAction('REJECT', reel, event)}
          >
            <XCircle className="mr-2 size-4" />
            Reject
          </Button>
        ) : null}
        {canModerateReels && hasAction('REQUEST_EDIT') ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={(event) => openReelAction('REQUEST_EDIT', reel, event)}
          >
            <PencilLine className="mr-2 size-4" />
            Edit
          </Button>
        ) : null}
        {canModerateReels && hasAction('PAUSE') ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={(event) => openReelAction('PAUSE', reel, event)}
          >
            <PauseCircle className="mr-2 size-4" />
            Pause
          </Button>
        ) : null}
        {canModerateReels && hasAction('REMOVE') ? (
          <Button
            size="sm"
            type="button"
            variant="danger"
            onClick={(event) => openReelAction('REMOVE', reel, event)}
          >
            <Trash2 className="mr-2 size-4" />
            Remove
          </Button>
        ) : null}
        {canDeleteReels && hasAction('SOFT_DELETE') ? (
          <Button
            size="sm"
            type="button"
            variant="danger"
            onClick={(event) => openReelAction('SOFT_DELETE', reel, event)}
          >
            <Trash2 className="mr-2 size-4" />
            Soft Delete
          </Button>
        ) : null}
        {canDeleteReels && hasAction('HARD_DELETE') ? (
          <Button
            size="sm"
            type="button"
            variant="danger"
            onClick={(event) => openReelAction('HARD_DELETE', reel, event)}
          >
            <Trash2 className="mr-2 size-4" />
            Hard Delete
          </Button>
        ) : null}
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation()
            viewDetails(reel)
          }}
        >
          <ArrowUpRight className="mr-2 size-4" />
          Open
        </Button>
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description={
          viewMode === 'pending'
            ? 'Moderate reels waiting for review.'
            : 'Review approved reels currently visible to customers.'
        }
        placement="topbar"
        title="Reels"
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
                  aria-label="Expand reel filters"
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
                      aria-label="Collapse reel filters"
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
                          viewMode === queueItem.key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-surface-muted/50 text-foreground hover:border-primary/35',
                        )}
                        key={queueItem.key}
                        type="button"
                        onClick={() => applyQueue(queueItem.key)}
                      >
                        <span className="font-medium">{queueItem.label}</span>
                        <span className="text-xs font-semibold">
                          {queueItem.count ?? '...'}
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
                        onClick={clearReelFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <MultiSelectFilter
                      label="Content type"
                      options={contentTypeOptions}
                      placeholder="All content"
                      values={selectedContentTypes}
                      onChange={(values) => {
                        setSelectedContentTypes(values as ReelContentType[])
                        resetToFirstPage()
                      }}
                    />
                    <MultiSelectFilter
                      label="Upload status"
                      options={uploadStatusOptions}
                      placeholder="All upload states"
                      values={selectedUploadStatuses}
                      onChange={(values) => {
                        setSelectedUploadStatuses(values as ReelUploadStatus[])
                        resetToFirstPage()
                      }}
                    />
                    <MultiSelectFilter
                      label="Moderation status"
                      options={moderationStatusOptions}
                      placeholder="All moderation states"
                      values={selectedModerationStatuses}
                      onChange={(values) => {
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
                        setSelectedVendors(options)
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
                          setCity(event.target.value)
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
                  Reel moderation
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} reels matching current filters`
                    : 'Search, filter, and moderate reels.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  ariaLabel="Search reels"
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search reel, caption, vendor"
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
                  description={
                    viewMode === 'pending'
                      ? 'No reels are currently waiting for review.'
                      : 'No live reels matched the current filters.'
                  }
                  title={viewMode === 'pending' ? 'Queue is empty' : 'No live reels'}
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--reel-grid-min-width)]"
                    style={reelGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--reel-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
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
                      <div className="relative flex min-w-0 items-center justify-end pr-3">
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
                      onSelectVisible={() => reelSelection.setVisibleSelected(true)}
                    />

                    <div className="divide-y divide-border">
                      {reels.map((reel) => (
                        <div
                          aria-label={`Open reel ${reel.reelId}`}
                          aria-selected={reelSelection.isSelected(reel.reelId)}
                          className={cn(
                            'grid w-full cursor-pointer gap-3 px-3 py-3 text-left transition hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--reel-grid-template)]',
                            reelSelection.isSelected(reel.reelId) &&
                              'bg-primary/5 hover:bg-primary/10',
                          )}
                          key={reel.reelId}
                          role="button"
                          style={reelGridStyle}
                          tabIndex={0}
                          onClick={() => viewDetails(reel)}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget) return

                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              viewDetails(reel)
                            }
                          }}
                        >
                          <div className="flex min-w-0 items-start xl:items-center">
                            <ListSelectionCheckbox
                              checked={reelSelection.isSelected(reel.reelId)}
                              label={`Select reel ${reel.reelId}`}
                              onChange={(selected) =>
                                reelSelection.setItemSelected(reel.reelId, selected)
                              }
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:contents">
                            {renderReelCells(reel)}
                          </div>
                          <div className="flex min-w-0 items-center justify-start xl:justify-end">
                            {renderRowActions(reel)}
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

      <ReelActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={selectedAction ? `${selectedAction.kind}-${selectedAction.reel.reelId}` : 'closed'}
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
