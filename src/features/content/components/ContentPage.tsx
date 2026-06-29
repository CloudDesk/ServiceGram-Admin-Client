import {
  Archive,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type {
  CSSProperties,
  FormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
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
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { TableSkeleton } from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { usePermission } from '../../../hooks/usePermission'
import type { LookupOption } from '../../../types/lookup.types'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { contentService } from '../services/content.service'
import type {
  ContentFormat,
  ContentPage as ContentPageRecord,
  ContentPagesQueryParams,
  ContentPageStatus,
  ContentPageType,
} from '../types/content.types'

const DEFAULT_PAGE_SIZE = 10
const CONTENT_DEFAULT_COLUMN_WIDTH = 220
const CONTENT_GRID_COLUMN_GAP = 12
const CONTENT_GRID_INLINE_PADDING = 24
const CONTENT_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.content.columnWidths.v1'
const CONTENT_ACTION_COLUMN_WIDTH = 310

const statuses: ContentPageStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const pageTypes: ContentPageType[] = [
  'LEGAL',
  'FAQ',
  'SUPPORT',
  'ONBOARDING',
  'POLICY',
  'MARKETING',
]
const formats: ContentFormat[] = ['MARKDOWN', 'HTML', 'PLAIN_TEXT']

const contentDataColumns = [
  { id: 'page', label: 'Page', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 210 },
  { id: 'status', label: 'Status', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 160 },
  { id: 'type', label: 'Type', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 155 },
  { id: 'format', label: 'Format', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 150 },
  { id: 'version', label: 'Version', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 150 },
  { id: 'visibility', label: 'Visibility', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 170 },
  { id: 'warnings', label: 'Signals', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 220 },
  { id: 'updatedAt', label: 'Updated', defaultWidth: CONTENT_DEFAULT_COLUMN_WIDTH, minWidth: 170 },
] as const

type ContentColumnId = (typeof contentDataColumns)[number]['id']
type ContentColumnWidths = Partial<Record<ContentColumnId, number>>
type ContentQueueKey = 'all' | 'custom' | 'draft' | 'published' | 'hidden' | 'archived'
type ContentActionKind = 'PUBLISH' | 'ARCHIVE'
type ContentTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning'

const defaultContentColumns: ContentColumnId[] = [
  'page',
  'status',
  'type',
  'version',
  'visibility',
  'updatedAt',
]
const EMPTY_CONTENT_PAGES: ContentPageRecord[] = []

interface ContentGridStyle extends CSSProperties {
  '--content-grid-template': string
  '--content-grid-min-width': string
}

interface ContentMetric {
  label: string
  meta: string
  tone: ContentTone
  value: string
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

function statusTone(status: ContentPageStatus): StatusTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function metricToneClass(tone: ContentTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function buildLookupOptions<TValue extends string>(values: readonly TValue[]): LookupOption[] {
  return values.map((value) => ({ label: humanizeCode(value), value }))
}

function readSearchList(searchParams: URLSearchParams, key: string) {
  return searchParams
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

function readSearchEnumList<TValue extends string>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: readonly TValue[],
) {
  const allowed = new Set<string>(allowedValues)

  return readSearchList(searchParams, key).filter((value): value is TValue =>
    allowed.has(value),
  )
}

function readSearchVisibility(searchParams: URLSearchParams) {
  const rawVisibility =
    searchParams.get('isVisibleToCustomers') ?? searchParams.get('visibility')

  if (rawVisibility === 'true' || rawVisibility === 'visible') return 'visible'
  if (rawVisibility === 'false' || rawVisibility === 'hidden') return 'hidden'

  return 'all'
}

function queueKeyForFilters(
  selectedStatuses: ContentPageStatus[],
  selectedVisibility: 'all' | 'hidden' | 'visible',
): ContentQueueKey {
  if (selectedVisibility === 'hidden' && selectedStatuses.length === 0) return 'hidden'
  if (selectedVisibility !== 'all') return 'custom'
  if (selectedStatuses.length === 0) return 'all'
  if (selectedStatuses.length > 1) return 'custom'

  const [status] = selectedStatuses

  if (status === 'DRAFT') return 'draft'
  if (status === 'PUBLISHED') return 'published'
  if (status === 'ARCHIVED') return 'archived'

  return 'custom'
}

function buildContentAuditPath(page: ContentPageRecord) {
  const params = new URLSearchParams({
    moduleCode: 'content',
    entityType: 'content_page',
    entityId: page.pageId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function getContentColumnDefaultWidth(columnId: ContentColumnId) {
  return (
    contentDataColumns.find((column) => column.id === columnId)?.defaultWidth ??
    CONTENT_DEFAULT_COLUMN_WIDTH
  )
}

function getContentColumnMinWidth(columnId: ContentColumnId) {
  return contentDataColumns.find((column) => column.id === columnId)?.minWidth ?? 140
}

function getContentColumnWidth(
  columnWidths: ContentColumnWidths,
  columnId: ContentColumnId,
) {
  return columnWidths[columnId] ?? getContentColumnDefaultWidth(columnId)
}

function getContentGridTemplate(
  visibleColumns: ContentColumnId[],
  columnWidths: ContentColumnWidths,
) {
  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...visibleColumns.map(
      (columnId) => `${getContentColumnWidth(columnWidths, columnId)}px`,
    ),
    `${CONTENT_ACTION_COLUMN_WIDTH}px`,
  ]
    .join(` ${CONTENT_GRID_COLUMN_GAP}px `)
}

function getContentGridMinWidth(
  visibleColumns: ContentColumnId[],
  columnWidths: ContentColumnWidths,
) {
  const columnsWidth = visibleColumns.reduce(
    (sum, columnId) => sum + getContentColumnWidth(columnWidths, columnId),
    0,
  )

  return (
    columnsWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    CONTENT_ACTION_COLUMN_WIDTH +
    Math.max(visibleColumns.length + 1, 0) * CONTENT_GRID_COLUMN_GAP +
    CONTENT_GRID_INLINE_PADDING
  )
}

function loadColumnWidths(): ContentColumnWidths {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(CONTENT_COLUMN_WIDTH_STORAGE_KEY)

    if (!rawValue) return {}

    const parsed = JSON.parse(rawValue) as ContentColumnWidths
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [ContentColumnId, number] => {
        const [columnId, value] = entry
        return (
          contentDataColumns.some((column) => column.id === columnId) &&
          typeof value === 'number' &&
          Number.isFinite(value)
        )
      }),
    )
  } catch {
    return {}
  }
}

function buildContentMetrics(
  pages: ContentPageRecord[],
  totalItems: number,
  queueCounts?: ContentQueueCounts,
): ContentMetric[] {
  const drafts =
    queueCounts?.draft ?? pages.filter((page) => page.status === 'DRAFT').length
  const published =
    queueCounts?.published ??
    pages.filter((page) => page.status === 'PUBLISHED').length
  const hidden =
    queueCounts?.hidden ??
    pages.filter((page) => !page.isVisibleToCustomers).length
  const matched = queueCounts?.all ?? totalItems

  return [
    {
      label: 'Drafts',
      meta: queueCounts ? 'Drafts under base filters' : 'Visible draft pages',
      tone: drafts > 0 ? 'warning' : 'neutral',
      value: String(drafts),
    },
    {
      label: 'Published',
      meta: queueCounts
        ? 'Published under base filters'
        : 'Visible published pages',
      tone: 'success',
      value: String(published),
    },
    {
      label: 'Hidden',
      meta: queueCounts ? 'Hidden under base filters' : 'Visible hidden pages',
      tone: hidden > 0 ? 'danger' : 'neutral',
      value: String(hidden),
    },
    {
      label: 'Matched pages',
      meta: queueCounts
        ? 'Total matching base filters'
        : 'Total matching current filters',
      tone: 'info',
      value: String(matched),
    },
  ]
}

interface ContentQueueCounts {
  all: number
  draft: number
  published: number
  hidden: number
  archived: number
}

function buildQueueItems(counts?: ContentQueueCounts) {
  return [
    { key: 'all' as const, label: 'All content', count: counts?.all },
    {
      key: 'draft' as const,
      label: 'Drafts',
      count: counts?.draft,
    },
    {
      key: 'published' as const,
      label: 'Published',
      count: counts?.published,
    },
    {
      key: 'hidden' as const,
      label: 'Hidden',
      count: counts?.hidden,
    },
    {
      key: 'archived' as const,
      label: 'Archived',
      count: counts?.archived,
    },
  ]
}

function SummaryCard({ metric }: { metric: ContentMetric }) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', metricToneClass(metric.tone))}>
        {metric.label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', metricToneClass(metric.tone))}>
        {metric.value}
      </p>
      <p className="mt-1 text-xs text-muted">{metric.meta}</p>
    </article>
  )
}

function canRunContentListAction({
  action,
  canPublishContent,
  canUpdateContent,
  page,
}: {
  action: 'ARCHIVE' | 'PUBLISH' | 'UPDATE'
  canPublishContent: boolean
  canUpdateContent: boolean
  page: ContentPageRecord
}) {
  if (!page.availableActions.includes(action)) return false
  if (action === 'PUBLISH') return canPublishContent
  return canUpdateContent
}

function ContentActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: { kind: ContentActionKind; page: ContentPageRecord }
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const isArchive = action.kind === 'ARCHIVE'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    setFormError(null)

    if (trimmedReason.length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    onSubmit(trimmedReason)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isArchive ? 'Archive content' : 'Publish content'}
            </h2>
            <p className="mt-1 text-sm text-muted">{action.page.title}</p>
          </div>
          <button
            aria-label="Close content action"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-semibold text-foreground">Reason *</span>
            <textarea
              className="form-input min-h-28 resize-y"
              placeholder={
                isArchive
                  ? 'Replacing this page with updated content.'
                  : 'Approved after final content review.'
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              size="sm"
              type="submit"
              variant={isArchive ? 'danger' : 'primary'}
            >
              {isArchive ? 'Archive' : 'Publish'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ContentCell({
  columnId,
  page,
}: {
  columnId: ContentColumnId
  page: ContentPageRecord
}) {
  if (columnId === 'page') {
    return (
      <div className="min-w-0 space-y-1">
        <p className="truncate font-semibold text-foreground">{page.title}</p>
        <p className="truncate text-xs text-muted">{page.slug}</p>
        <p className="line-clamp-1 text-xs text-muted">
          {page.excerpt ?? page.bodyPreview}
        </p>
      </div>
    )
  }

  if (columnId === 'status') {
    return (
      <div className="space-y-1">
        <Badge tone={statusTone(page.status)}>{humanizeCode(page.status)}</Badge>
        <p className="text-xs text-muted">
          {page.nextRecommendedAction
            ? humanizeCode(page.nextRecommendedAction)
            : 'No next action'}
        </p>
      </div>
    )
  }

  if (columnId === 'type') {
    return <Badge tone="info">{humanizeCode(page.pageType)}</Badge>
  }

  if (columnId === 'format') {
    return <Badge tone="neutral">{humanizeCode(page.contentFormat)}</Badge>
  }

  if (columnId === 'version') {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">v{page.version}</p>
        <p className="text-xs text-muted">
          Published {page.publishedVersion ? `v${page.publishedVersion}` : 'not yet'}
        </p>
      </div>
    )
  }

  if (columnId === 'visibility') {
    return (
      <div className="space-y-1">
        <Badge tone={page.isVisibleToCustomers ? 'success' : 'danger'}>
          {page.isVisibleToCustomers ? 'Visible' : 'Hidden'}
        </Badge>
        <p className="text-xs text-muted">Customer-facing surfaces</p>
      </div>
    )
  }

  if (columnId === 'warnings') {
    const signals = [...page.warnings, ...page.blockingReasons]

    return signals.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {signals.slice(0, 2).map((signal) => (
          <Badge key={signal} tone={page.blockingReasons.includes(signal) ? 'danger' : 'warning'}>
            {signal}
          </Badge>
        ))}
        {signals.length > 2 ? <Badge tone="neutral">+{signals.length - 2}</Badge> : null}
      </div>
    ) : (
      <Badge tone="success">Clear</Badge>
    )
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">
        {formatDateSafe(page.lifecycle.updatedAt)}
      </p>
      <p className="text-xs text-muted">
        Published {formatDateSafe(page.lifecycle.publishedAt)}
      </p>
    </div>
  )
}

export function ContentPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canCreateContent = usePermission('content:update')
  const canPublishContent = usePermission('content:publish')
  const canReadAudit = usePermission('audit:read')
  const canUpdateContent = usePermission('content:update')
  const initialStatuses = readSearchEnumList(searchParams, 'status', statuses)
  const initialVisibility = readSearchVisibility(searchParams)
  const [dateFrom, setDateFrom] = useState(() => searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(() => searchParams.get('dateTo') ?? '')
  const [formatsFilter, setFormatsFilter] = useState<ContentFormat[]>(() =>
    readSearchEnumList(searchParams, 'contentFormat', formats),
  )
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [isFilterRailCollapsed, setIsFilterRailCollapsed] = useState(false)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [pageTypesFilter, setPageTypesFilter] = useState<ContentPageType[]>(() =>
    readSearchEnumList(searchParams, 'pageType', pageTypes),
  )
  const [queueKey, setQueueKey] = useState<ContentQueueKey>(() =>
    queueKeyForFilters(initialStatuses, initialVisibility),
  )
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [statusesFilter, setStatusesFilter] =
    useState<ContentPageStatus[]>(initialStatuses)
  const [visibility, setVisibility] = useState<'all' | 'hidden' | 'visible'>(
    initialVisibility,
  )
  const [visibleColumns, setVisibleColumns] = useState<ContentColumnId[]>(
    defaultContentColumns,
  )
  const [columnWidths, setColumnWidths] =
    useState<ContentColumnWidths>(() => loadColumnWidths())
  const [selectedAction, setSelectedAction] = useState<{
    kind: ContentActionKind
    page: ContentPageRecord
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    window.localStorage.setItem(
      CONTENT_COLUMN_WIDTH_STORAGE_KEY,
      JSON.stringify(columnWidths),
    )
  }, [columnWidths])

  useEffect(() => {
    if (!isColumnMenuOpen) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && columnMenuRef.current?.contains(target)) {
        return
      }

      setIsColumnMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsColumnMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isColumnMenuOpen])

  const query = useMemo<ContentPagesQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: statusesFilter.length > 0 ? statusesFilter : undefined,
      pageType: pageTypesFilter.length > 0 ? pageTypesFilter : undefined,
      contentFormat: formatsFilter.length > 0 ? formatsFilter : undefined,
      isVisibleToCustomers:
        visibility === 'all' ? undefined : visibility === 'visible',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      dateFrom,
      dateTo,
      formatsFilter,
      limit,
      page,
      pageTypesFilter,
      search,
      statusesFilter,
      visibility,
    ],
  )

  const contentQuery = useQuery({
    queryKey: ['content-pages', query],
    queryFn: () => contentService.getPages(query),
  })
  const queueCountBaseQuery = useMemo<ContentPagesQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      pageType: pageTypesFilter.length > 0 ? pageTypesFilter : undefined,
      contentFormat: formatsFilter.length > 0 ? formatsFilter : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      dateFrom,
      dateTo,
      formatsFilter,
      pageTypesFilter,
      search,
    ],
  )
  const queueCountsQuery = useQuery({
    queryKey: ['content-pages', 'queue-counts', queueCountBaseQuery],
    queryFn: async (): Promise<ContentQueueCounts> => {
      const [statusSummary, hiddenSummary] = await Promise.all([
        contentService.getPages(queueCountBaseQuery),
        contentService.getPages({
          ...queueCountBaseQuery,
          isVisibleToCustomers: false,
        }),
      ])

      return {
        all: statusSummary.pagination.totalItems,
        draft: statusSummary.summary.draft,
        published: statusSummary.summary.published,
        hidden: hiddenSummary.pagination.totalItems,
        archived: statusSummary.summary.archived,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const pages = contentQuery.data?.data ?? EMPTY_CONTENT_PAGES
  const pagination = contentQuery.data?.pagination
  const contentSelection = useListSelection(pages, (pageRecord) => pageRecord.pageId)
  const isLoading = contentQuery.isLoading
  const isRefreshing = contentQuery.isFetching
  const queueItems = buildQueueItems(queueCountsQuery.data)
  const metrics = buildContentMetrics(
    pages,
    pagination?.totalItems ?? pages.length,
    queueCountsQuery.data,
  )
  const gridStyle = useMemo<ContentGridStyle>(
    () => ({
      '--content-grid-template': getContentGridTemplate(visibleColumns, columnWidths),
      '--content-grid-min-width': `${getContentGridMinWidth(
        visibleColumns,
        columnWidths,
      )}px`,
    }),
    [columnWidths, visibleColumns],
  )

  const resetToFirstPage = () => setPage(1)

  const clearSeededContentParams = () => {
    const seededKeys = [
      'contentFormat',
      'dateFrom',
      'dateTo',
      'isVisibleToCustomers',
      'pageType',
      'search',
      'status',
      'visibility',
    ]

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const applyQueue = (nextQueueKey: ContentQueueKey) => {
    clearSeededContentParams()
    setQueueKey(nextQueueKey)
    setPage(1)

    if (nextQueueKey === 'all') {
      setStatusesFilter([])
      setVisibility('all')
      return
    }

    if (nextQueueKey === 'draft') {
      setStatusesFilter(['DRAFT'])
      setVisibility('all')
      return
    }

    if (nextQueueKey === 'published') {
      setStatusesFilter(['PUBLISHED'])
      setVisibility('all')
      return
    }

    if (nextQueueKey === 'hidden') {
      setStatusesFilter([])
      setVisibility('hidden')
      return
    }

    if (nextQueueKey === 'archived') {
      setStatusesFilter(['ARCHIVED'])
      setVisibility('all')
    }
  }

  const clearFilters = () => {
    clearSeededContentParams()
    setDateFrom('')
    setDateTo('')
    setFormatsFilter([])
    setPageTypesFilter([])
    setQueueKey('all')
    setSearch('')
    setStatusesFilter([])
    setVisibility('all')
    setPage(1)
  }

  const toggleColumn = (columnId: ContentColumnId) => {
    setVisibleColumns((current) => {
      if (current.includes(columnId)) {
        return current.length === 1
          ? current
          : current.filter((visibleColumn) => visibleColumn !== columnId)
      }

      const next = [...current, columnId]
      return contentDataColumns
        .map((column) => column.id)
        .filter((id) => next.includes(id))
    })
  }

  const startColumnResize = (
    columnId: ContentColumnId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getContentColumnWidth(columnWidths, columnId)
    const minWidth = getContentColumnMinWidth(columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.max(
        minWidth,
        Math.min(560, startWidth + moveEvent.clientX - startX),
      )
      setColumnWidths((current) => ({ ...current, [columnId]: nextWidth }))
    }

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      pageRecord,
      reason,
    }: {
      action: ContentActionKind
      pageRecord: ContentPageRecord
      reason: string
    }) => {
      if (action === 'PUBLISH') {
        return contentService.publishPage(pageRecord.pageId, { reason })
      }

      return contentService.archivePage(pageRecord.pageId, { reason })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response, variables) => {
      setSelectedAction(null)
      setActionMessage(
        response.message ??
          (variables.action === 'PUBLISH'
            ? 'Content page published.'
            : 'Content page archived.'),
      )
      void queryClient.invalidateQueries({ queryKey: ['content-pages'] })
      void queryClient.invalidateQueries({
        queryKey: ['content-page-detail', variables.pageRecord.pageId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Content action failed.',
      )
    },
  })

  const openContentAction = (
    kind: ContentActionKind,
    pageRecord: ContentPageRecord,
    event?: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation()

    if (
      !canRunContentListAction({
        action: kind,
        canPublishContent,
        canUpdateContent,
        page: pageRecord,
      })
    ) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, page: pageRecord })
  }

  const openContentDetail = (pageRecord: ContentPageRecord) => {
    navigate(`${routePaths.content}/${pageRecord.pageId}`)
  }

  const renderRowActions = (pageRecord: ContentPageRecord) => {
    const canPublish = canRunContentListAction({
      action: 'PUBLISH',
      canPublishContent,
      canUpdateContent,
      page: pageRecord,
    })
    const canArchive = canRunContentListAction({
      action: 'ARCHIVE',
      canPublishContent,
      canUpdateContent,
      page: pageRecord,
    })

    return (
      <div className="flex min-w-0 flex-wrap justify-start gap-1.5 xl:justify-end">
        <Button
          size="sm"
          title="Open content detail"
          type="button"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation()
            openContentDetail(pageRecord)
          }}
        >
          <ArrowUpRight className="mr-2 size-4" />
          Open
        </Button>
        {canPublish ? (
          <Button
            disabled={actionMutation.isPending}
            size="sm"
            title="Publish content page"
            type="button"
            onClick={(event) => openContentAction('PUBLISH', pageRecord, event)}
          >
            <Send className="mr-2 size-4" />
            Publish
          </Button>
        ) : null}
        {canArchive ? (
          <Button
            disabled={actionMutation.isPending}
            size="sm"
            title="Archive content page"
            type="button"
            variant="secondary"
            onClick={(event) => openContentAction('ARCHIVE', pageRecord, event)}
          >
            <Archive className="mr-2 size-4" />
            Archive
          </Button>
        ) : null}
        {canReadAudit ? (
          <Button
            size="sm"
            title="Open audit logs"
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation()
              navigate(buildContentAuditPath(pageRecord))
            }}
          >
            <ClipboardList className="mr-2 size-4" />
            Audit
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col gap-3 !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Manage app content pages, policies, FAQs, and support copy."
        layout="workspace"
        placement="topbar"
        title="Content"
      />

      <section className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} />
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
          isFilterRailCollapsed
            ? 'lg:grid-cols-[3rem_minmax(0,1fr)]'
            : 'lg:grid-cols-[18rem_minmax(0,1fr)]',
        )}
      >
        <aside className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
            {!isFilterRailCollapsed ? (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Queue totals</h2>
                <p className="mt-0.5 text-xs text-muted">Counts match base filters.</p>
              </div>
            ) : null}
            <button
              aria-label={isFilterRailCollapsed ? 'Expand filters' : 'Collapse filters'}
              className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
              type="button"
              onClick={() => setIsFilterRailCollapsed((current) => !current)}
            >
              <ChevronLeft
                className={cn('size-4 transition', isFilterRailCollapsed && 'rotate-180')}
              />
            </button>
          </div>

          {isFilterRailCollapsed ? null : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              <div className="space-y-2">
                {queueItems.map((item) => (
                  <button
                    className={cn(
                      'flex min-h-10 w-full items-center justify-between rounded-[0.75rem] border border-border bg-surface px-3 text-left text-sm transition hover:border-primary/35 hover:bg-surface-muted/60',
                      queueKey === item.key &&
                        'border-primary bg-primary/5 text-primary',
                    )}
                    key={item.key}
                    type="button"
                    onClick={() => applyQueue(item.key)}
                    >
                      <span className="font-medium">{item.label}</span>
                    <span className="text-xs font-semibold">
                      {item.count ?? '...'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Filter stack</h3>
                  <button
                    className="text-xs font-semibold text-primary hover:text-primary-hover"
                    type="button"
                    onClick={clearFilters}
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  <MultiSelectFilter
                    label="Status"
                    options={buildLookupOptions(statuses)}
                    placeholder="All statuses"
                    values={statusesFilter}
                    onChange={(values) => {
                      clearSeededContentParams()
                      setStatusesFilter(values as ContentPageStatus[])
                      setQueueKey(values.length > 0 ? 'custom' : 'all')
                      resetToFirstPage()
                    }}
                  />
                  <MultiSelectFilter
                    label="Type"
                    options={buildLookupOptions(pageTypes)}
                    placeholder="All types"
                    values={pageTypesFilter}
                    onChange={(values) => {
                      clearSeededContentParams()
                      setPageTypesFilter(values as ContentPageType[])
                      resetToFirstPage()
                    }}
                  />
                  <MultiSelectFilter
                    label="Format"
                    options={buildLookupOptions(formats)}
                    placeholder="All formats"
                    values={formatsFilter}
                    onChange={(values) => {
                      clearSeededContentParams()
                      setFormatsFilter(values as ContentFormat[])
                      resetToFirstPage()
                    }}
                  />
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-muted">Visibility</span>
                    <select
                      className="h-10 w-full rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                      value={visibility}
                      onChange={(event) => {
                        clearSeededContentParams()
                        setVisibility(event.target.value as 'all' | 'hidden' | 'visible')
                        setQueueKey(event.target.value === 'all' ? 'all' : 'custom')
                        resetToFirstPage()
                      }}
                    >
                      <option value="all">All</option>
                      <option value="visible">Visible</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-muted">Date from</span>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                          clearSeededContentParams()
                          setDateFrom(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold text-muted">Date to</span>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                          clearSeededContentParams()
                          setDateTo(event.target.value)
                          resetToFirstPage()
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        <section
          className="flex min-w-0 scroll-mt-4 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0"
          id="content-pages"
        >
          <div className="flex flex-col gap-3 border-b border-border px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Content pages</h2>
              <p className="mt-1 text-sm text-muted">
                {pagination
                  ? `${pagination.totalItems} pages matching current filters`
                  : `${pages.length} pages in the current window`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ListHeaderSearch
                className="w-full min-w-[16rem] sm:w-72"
                placeholder="Search title, slug, excerpt"
                value={search}
                onChange={(value) => {
                  clearSeededContentParams()
                  setSearch(value)
                  resetToFirstPage()
                }}
              />
              <div className="relative" ref={columnMenuRef}>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setIsColumnMenuOpen((current) => !current)}
                >
                  <SlidersHorizontal className="mr-2 size-4" />
                  Columns
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {visibleColumns.length}
                  </span>
                </Button>
                {isColumnMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.35rem)] z-[70] w-64 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface">
                    {contentDataColumns.map((column) => (
                      <button
                        className="flex min-h-9 w-full items-center justify-between rounded-[0.65rem] px-2 text-sm text-foreground transition hover:bg-surface-muted"
                        key={column.id}
                        type="button"
                        onClick={() => toggleColumn(column.id)}
                      >
                        <span>{column.label}</span>
                        <span
                          className={cn(
                            'inline-flex size-4 items-center justify-center rounded border border-border',
                            visibleColumns.includes(column.id) &&
                              'border-primary bg-primary',
                          )}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Button
                isLoading={isRefreshing}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void contentQuery.refetch()}
              >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
              </Button>
              {canCreateContent ? (
                <Link to={`${routePaths.content}/new`}>
                  <Button size="sm" type="button">
                    <FilePlus2 className="mr-2 size-4" />
                    New
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          {contentQuery.isError ? (
            <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <ErrorState
                description="We could not load content pages."
                title="Content unavailable"
                onRetry={() => void contentQuery.refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <TableSkeleton columnCount={visibleColumns.length + 2} hasFooter rowCount={8} />
            </div>
          ) : pages.length === 0 ? (
            <div className="p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
              <EmptyState description="No content pages matched this filter." title="No content pages" />
            </div>
          ) : (
            <div className="flex flex-col xl:min-h-0 xl:flex-1">
              <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                <div className="min-w-[var(--content-grid-min-width)]" style={gridStyle}>
                  <div className="sticky top-0 z-10 grid grid-cols-[var(--content-grid-template)] gap-x-3 border-b border-border bg-surface-muted px-3 py-3 text-xs font-semibold uppercase tracking-normal text-muted">
                    <div className="flex min-w-0 items-center">
                      <ListSelectionCheckbox
                        checked={contentSelection.allVisibleSelected}
                        indeterminate={contentSelection.someVisibleSelected}
                        label="Select visible content pages"
                        onChange={contentSelection.setVisibleSelected}
                      />
                    </div>
                    {visibleColumns.map((columnId) => {
                      const column = contentDataColumns.find((item) => item.id === columnId)

                      return (
                        <div
                          className="group relative flex min-w-0 items-center gap-2"
                          key={columnId}
                        >
                          <span className="truncate">{column?.label}</span>
                          <button
                            aria-label={`Resize ${column?.label ?? columnId} column`}
                            className="absolute -right-2 top-1/2 h-6 w-2 -translate-y-1/2 cursor-col-resize rounded-full border-r border-border opacity-60 transition hover:border-primary hover:opacity-100"
                            type="button"
                            onPointerDown={(event) => startColumnResize(columnId, event)}
                          />
                        </div>
                      )
                    })}
                    <div className="flex min-w-0 items-center justify-end">
                      <span>Actions</span>
                    </div>
                  </div>
                  <ListSelectionToolbar
                    allVisibleSelected={contentSelection.allVisibleSelected}
                    selectedCount={contentSelection.selectedCount}
                    visibleCount={contentSelection.visibleCount}
                    onClear={contentSelection.clearSelection}
                    onSelectVisible={() => contentSelection.setVisibleSelected(true)}
                  />

                  <div className="divide-y divide-border">
                    {pages.map((contentPage) => (
                      <div
                        aria-selected={contentSelection.isSelected(contentPage.pageId)}
                        className={cn(
                          'grid min-h-[5.5rem] cursor-pointer grid-cols-[var(--content-grid-template)] gap-x-3 px-3 py-3 text-left transition hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          contentSelection.isSelected(contentPage.pageId) &&
                            'bg-primary/5 hover:bg-primary/10',
                        )}
                        key={contentPage.pageId}
                        role="button"
                        tabIndex={0}
                        onClick={() => openContentDetail(contentPage)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.target !== keyboardEvent.currentTarget) return

                          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                            keyboardEvent.preventDefault()
                            openContentDetail(contentPage)
                          }
                        }}
                      >
                        <div className="flex min-w-0 items-start self-center">
                          <ListSelectionCheckbox
                            checked={contentSelection.isSelected(contentPage.pageId)}
                            label={`Select ${contentPage.title}`}
                            onChange={(selected) =>
                              contentSelection.setItemSelected(
                                contentPage.pageId,
                                selected,
                              )
                            }
                          />
                        </div>
                        {visibleColumns.map((columnId) => (
                          <div
                            className="min-w-0 self-center text-sm"
                            key={`${contentPage.pageId}-${columnId}`}
                          >
                            <ContentCell columnId={columnId} page={contentPage} />
                          </div>
                        ))}
                        <div className="min-w-0 self-center text-sm">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-muted xl:hidden">
                            Actions
                          </span>
                          {renderRowActions(contentPage)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {pagination ? (
                <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span>
                      Showing {(pagination.page - 1) * pagination.limit + 1}-
                      {Math.min(
                        pagination.page * pagination.limit,
                        pagination.totalItems,
                      )}{' '}
                      of {pagination.totalItems}
                    </span>
                    <span>Rows</span>
                    <select
                      className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
                      value={limit}
                      onChange={(event) => {
                        setLimit(Number(event.target.value))
                        setPage(1)
                      }}
                    >
                      {[10, 20, 50, 100].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      disabled={!pagination.hasPreviousPage}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => setPage(Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm font-semibold text-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <Button
                      disabled={!pagination.hasNextPage}
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </section>

      {selectedAction ? (
        <ContentActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          key={`${selectedAction.kind}-${selectedAction.page.pageId}`}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedAction(null)
              setActionError(null)
            }
          }}
          onSubmit={(reason) =>
            actionMutation.mutate({
              action: selectedAction.kind,
              pageRecord: selectedAction.page,
              reason,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
