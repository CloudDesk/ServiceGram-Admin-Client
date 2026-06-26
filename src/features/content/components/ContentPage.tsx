import {
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  RefreshCcw,
  SlidersHorizontal,
} from 'lucide-react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
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
import { useAuthStore } from '../../../store/authStore'
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
    Math.max(visibleColumns.length, 0) * CONTENT_GRID_COLUMN_GAP +
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
): ContentMetric[] {
  const drafts = pages.filter((page) => page.status === 'DRAFT').length
  const published = pages.filter((page) => page.status === 'PUBLISHED').length
  const hidden = pages.filter((page) => !page.isVisibleToCustomers).length

  return [
    {
      label: 'Drafts',
      meta: 'Visible draft pages',
      tone: drafts > 0 ? 'warning' : 'neutral',
      value: String(drafts),
    },
    {
      label: 'Published',
      meta: 'Customer-ready pages',
      tone: 'success',
      value: String(published),
    },
    {
      label: 'Hidden',
      meta: 'Not visible to customers',
      tone: hidden > 0 ? 'danger' : 'neutral',
      value: String(hidden),
    },
    {
      label: 'Visible pages',
      meta: 'Matching current filters',
      tone: 'info',
      value: String(totalItems),
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
  const can = useAuthStore((state) => state.can)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [formatsFilter, setFormatsFilter] = useState<ContentFormat[]>([])
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [isFilterRailCollapsed, setIsFilterRailCollapsed] = useState(false)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [pageTypesFilter, setPageTypesFilter] = useState<ContentPageType[]>([])
  const [queueKey, setQueueKey] = useState<ContentQueueKey>('all')
  const [search, setSearch] = useState('')
  const [statusesFilter, setStatusesFilter] = useState<ContentPageStatus[]>([])
  const [visibility, setVisibility] = useState<'all' | 'hidden' | 'visible'>('all')
  const [visibleColumns, setVisibleColumns] = useState<ContentColumnId[]>(
    defaultContentColumns,
  )
  const [columnWidths, setColumnWidths] =
    useState<ContentColumnWidths>(() => loadColumnWidths())
  const columnMenuRef = useRef<HTMLDivElement | null>(null)

  const canCreateContent = can('content:update')

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
  const metrics = buildContentMetrics(pages, pagination?.totalItems ?? pages.length)
  const queueItems = buildQueueItems(queueCountsQuery.data)
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

  const applyQueue = (nextQueueKey: ContentQueueKey) => {
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

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage app content pages, policies, FAQs, and support copy."
        placement="topbar"
        title="Content"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section
        className={cn(
          'grid min-h-[calc(100vh-16rem)] gap-3 transition-[grid-template-columns]',
          isFilterRailCollapsed
            ? 'lg:grid-cols-[3rem_minmax(0,1fr)]'
            : 'lg:grid-cols-[18rem_minmax(0,1fr)]',
        )}
      >
        <aside className="min-w-0 rounded-[0.875rem] border border-border bg-surface shadow-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
            {!isFilterRailCollapsed ? (
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Review queues</h2>
                <p className="mt-0.5 text-xs text-muted">Publishing states</p>
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
            <div className="space-y-4 p-3">
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

        <section className="min-w-0 rounded-[0.875rem] border border-border bg-surface shadow-surface">
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
            <div className="p-4">
              <ErrorState
                description="We could not load content pages."
                title="Content unavailable"
                onRetry={() => void contentQuery.refetch()}
              />
            </div>
          ) : isLoading ? (
            <div className="p-4">
              <TableSkeleton columnCount={visibleColumns.length + 1} hasFooter rowCount={8} />
            </div>
          ) : pages.length === 0 ? (
            <div className="p-4">
              <EmptyState description="No content pages matched this filter." title="No content pages" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[var(--content-grid-min-width)]" style={gridStyle}>
                  <div className="grid grid-cols-[var(--content-grid-template)] gap-x-3 border-b border-border bg-surface-muted/60 px-3 py-3 text-xs font-semibold uppercase tracking-normal text-muted">
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
                        onClick={() => navigate(`${routePaths.content}/${contentPage.pageId}`)}
                        onKeyDown={(keyboardEvent) => {
                          if (keyboardEvent.target !== keyboardEvent.currentTarget) return

                          if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                            keyboardEvent.preventDefault()
                            navigate(`${routePaths.content}/${contentPage.pageId}`)
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
            </>
          )}
        </section>
      </section>
    </PageContainer>
  )
}
