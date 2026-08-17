import { Download, MoreHorizontal, Plus, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { contentService } from '../services/content.service'
import {
  canArchive,
  canPublish,
  contentSignal,
  contentStatusTone,
  formatDateSafe,
  hasDraftDrift,
  humanizeCode,
  type ContentTone,
} from '../contentPresenters'
import type {
  ContentPage as ContentPageRecord,
  ContentPageStatus,
  ContentPagesQueryParams,
} from '../types/content.types'
import {
  ContentActionModal,
  type ContentActionKind,
  type ContentActionSelection,
} from './ContentActionModal'

const CONTENT_LIST_STORAGE_KEY = 'servicegram.content.list.v1'
const DEFAULT_PAGE_SIZE = 50

type ContentQueueKey = 'all' | 'draft' | 'published' | 'hidden' | 'archived'

const CONTENT_QUEUES: Record<
  ContentQueueKey,
  {
    label: string
    status?: ContentPageStatus[]
    visibleToCustomers?: boolean
    tone?: 'neutral' | 'warning' | 'danger'
  }
> = {
  all: { label: 'All' },
  draft: { label: 'Draft', status: ['DRAFT'], tone: 'warning' },
  published: { label: 'Published', status: ['PUBLISHED'] },
  hidden: { label: 'Hidden', visibleToCustomers: false, tone: 'warning' },
  archived: { label: 'Archived', status: ['ARCHIVED'] },
}

function badgeTone(tone: ContentTone) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

interface RowActionsProps {
  page: ContentPageRecord
  canPublishContent: boolean
  canUpdateContent: boolean
  onAction: (kind: ContentActionKind, page: ContentPageRecord) => void
}

/**
 * Publish is constructive and gets the row button. Archive removes a page from
 * customers, so it stays behind the overflow.
 */
function RowActions({
  canPublishContent,
  canUpdateContent,
  onAction,
  page,
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

  const showPublish = canPublishContent && canPublish(page)
  const showArchive = canUpdateContent && canArchive(page)

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {showPublish ? (
        <Button
          className="h-7 whitespace-nowrap px-2 text-xs"
          size="sm"
          type="button"
          variant="primary"
          onClick={() => onAction('PUBLISH', page)}
        >
          Publish
        </Button>
      ) : null}

      {showArchive ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for ${page.title}`}
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
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  onAction('ARCHIVE', page)
                }}
              >
                Archive
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function ContentPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canCreateContent = usePermission('content:update')
  const canPublishContent = usePermission('content:publish')
  const canUpdateContent = usePermission('content:update')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<ContentQueueKey>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<ContentActionSelection | null>(null)

  const activeQueue = CONTENT_QUEUES[queue]

  const query = useMemo<ContentPagesQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: activeQueue.status,
      isVisibleToCustomers: activeQueue.visibleToCustomers,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [activeQueue, dateFrom, dateTo, limit, page, search],
  )

  const pagesQuery = useQuery({
    queryKey: ['content-pages', query],
    queryFn: () => contentService.getPages(query),
  })

  const pages = useMemo(() => pagesQuery.data?.data ?? [], [pagesQuery.data])
  const pagination = pagesQuery.data?.pagination

  const countBase = useMemo<ContentPagesQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [dateFrom, dateTo, search],
  )

  /** Queue counts span the whole result set, not the current page. */
  const queueCountsQuery = useQuery({
    queryKey: ['content-pages', 'queue-counts', countBase],
    queryFn: async () => {
      const keys = Object.keys(CONTENT_QUEUES) as ContentQueueKey[]
      const responses = await Promise.all(
        keys.map((key) =>
          contentService.getPages({
            ...countBase,
            status: CONTENT_QUEUES[key].status,
            isVisibleToCustomers: CONTENT_QUEUES[key].visibleToCustomers,
          }),
        ),
      )

      return Object.fromEntries(
        keys.map((key, index) => [
          key,
          responses[index]?.pagination.totalItems ?? 0,
        ]),
      ) as Record<ContentQueueKey, number>
    },
    placeholderData: (previousData) => previousData,
  })

  const counts = queueCountsQuery.data

  const queueTabs: DataListQueueTab[] = (
    Object.keys(CONTENT_QUEUES) as ContentQueueKey[]
  ).map((key) => ({
    key,
    label: CONTENT_QUEUES[key].label,
    count: counts?.[key],
    tone: CONTENT_QUEUES[key].tone,
  }))

  const clearSeededParams = () => {
    const seededKeys = ['search', 'status', 'pageType', 'contentFormat']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
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
    onMutate: () => setActionError(null),
    onSuccess: (_response, variables) => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['content-pages'] })
      void queryClient.invalidateQueries({
        queryKey: ['content-page-detail', variables.pageRecord.pageId],
      })
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Content action failed.')
    },
  })

  const columns: DataListColumn<ContentPageRecord>[] = useMemo(
    () => [
      {
        id: 'page',
        label: 'Page',
        defaultWidth: 240,
        minWidth: 190,
        priority: 1,
        grow: true,
        locked: true,
        // The title identifies the page, so it keeps its width and the slug
        // gives way — the reverse squeezed titles down to a few characters.
        render: (record) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="max-w-[65%] shrink-0 truncate font-medium text-foreground">
              {record.title}
            </span>
            <span className="min-w-0 truncate text-xs text-muted" title={record.slug}>
              /{record.slug}
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
        render: (record) => (
          <Badge tone={badgeTone(contentStatusTone(record.status))}>
            {humanizeCode(record.status)}
          </Badge>
        ),
      },
      {
        id: 'signal',
        label: 'Signal',
        defaultWidth: 150,
        minWidth: 120,
        priority: 1,
        render: (record) => {
          const signal = contentSignal(record)

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
        id: 'visibility',
        label: 'Visibility',
        defaultWidth: 100,
        minWidth: 88,
        priority: 2,
        render: (record) => (
          <span
            className={record.isVisibleToCustomers ? 'text-foreground' : 'text-muted'}
          >
            {record.isVisibleToCustomers ? 'Visible' : 'Hidden'}
          </span>
        ),
      },
      {
        id: 'version',
        label: 'Version',
        defaultWidth: 90,
        minWidth: 78,
        priority: 2,
        align: 'right',
        render: (record) => (
          <span className={hasDraftDrift(record) ? 'text-warning' : ''}>
            v{record.version}
          </span>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        defaultWidth: 130,
        minWidth: 110,
        priority: 3,
        render: (record) => (
          <span className="truncate text-muted">{humanizeCode(record.pageType)}</span>
        ),
      },
      {
        id: 'format',
        label: 'Format',
        defaultWidth: 110,
        minWidth: 94,
        priority: 4,
        defaultHidden: true,
        render: (record) => (
          <span className="truncate text-muted">
            {humanizeCode(record.contentFormat)}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 3,
        render: (record) => (
          <span className="text-muted">
            {formatDateSafe(record.lifecycle.updatedAt)}
          </span>
        ),
      },
    ],
    [],
  )

  const selectedPages = useMemo(
    () => pages.filter((record) => selectedIds.includes(record.pageId)),
    [pages, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('content-pages'), selectedPages, [
      { header: 'Page ID', value: (record) => record.pageId },
      { header: 'Title', value: (record) => record.title },
      { header: 'Slug', value: (record) => record.slug },
      { header: 'Status', value: (record) => record.status },
      { header: 'Type', value: (record) => record.pageType },
      { header: 'Format', value: (record) => record.contentFormat },
      { header: 'Version', value: (record) => record.version },
      { header: 'Published version', value: (record) => record.publishedVersion ?? '' },
      {
        header: 'Visible to customers',
        value: (record) => String(record.isVisibleToCustomers),
      },
      { header: 'Warnings', value: (record) => record.warnings.join('; ') },
      { header: 'Blocking', value: (record) => record.blockingReasons.join('; ') },
      { header: 'Updated', value: (record) => record.lifecycle.updatedAt },
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
              aria-label="Refresh content pages"
              className="h-9"
              disabled={pagesQuery.isLoading}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void pagesQuery.refetch()}
            >
              <RefreshCcw
                className={cn(
                  'size-4 sm:mr-2',
                  pagesQuery.isFetching && 'animate-spin motion-reduce:animate-none',
                )}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {canCreateContent ? (
              <Link to={`${routePaths.content}/new`}>
                <Button className="h-9" size="sm" type="button" variant="primary">
                  <Plus className="size-4 sm:mr-2" />
                  <span className="hidden sm:inline">New page</span>
                </Button>
              </Link>
            ) : null}
          </div>
        }
        layout="workspace"
        placement="topbar"
        title="Content"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={[dateFrom, dateTo].filter(Boolean).length}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No content pages match these filters"
        errorMessage="Could not load content pages."
        filters={
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
        }
        getRowId={(record) => record.pageId}
        isError={pagesQuery.isError}
        isLoading={pagesQuery.isLoading}
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
        rowActions={(record) => (
          <RowActions
            canPublishContent={canPublishContent}
            canUpdateContent={canUpdateContent}
            page={record}
            onAction={(kind, target) => {
              setActionError(null)
              setSelectedAction({ kind, page: target })
            }}
          />
        )}
        rowActionsWidth={110}
        rows={pages}
        search={search}
        searchPlaceholder="Search title, slug…"
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
        storageKey={CONTENT_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as ContentQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        onRetry={() => void pagesQuery.refetch()}
        onRowClick={(record) => navigate(`${routePaths.content}/${record.pageId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {selectedAction ? (
        <ContentActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedAction(null)
              setActionError(null)
            }
          }}
          onSubmit={(reason) =>
            void actionMutation.mutateAsync({
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
