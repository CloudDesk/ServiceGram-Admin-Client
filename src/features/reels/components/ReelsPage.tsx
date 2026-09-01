import { Download, Film, MoreHorizontal, RefreshCcw } from 'lucide-react'
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
import { reelService } from '../services/reel.service'
import {
  formatDateSafe,
  getModerationStatusTone,
  getOverflowActions,
  getRowPrimaryAction,
  getUploadStatusTone,
  humanizeCode,
  isDangerReelAction,
  reelActionLabel,
  reelDuration,
  reelSignal,
  type ReelTone,
} from '../reelPresenters'
import type { AdminReel, AdminReelsQueryParams } from '../types/reel.types'
import {
  ReelActionModal,
  type ReelActionFormValues,
  type ReelActionKind,
  type ReelActionSelection,
} from './ReelActionModal'
import { ReelCommentsModerationQueue } from './ReelCommentsModerationQueue'
import { HashtagModerationQueue } from './HashtagModerationQueue'

const REEL_LIST_STORAGE_KEY = 'servicegram.reels.list.v1'
const DEFAULT_PAGE_SIZE = 50

type ReelViewMode = 'pending' | 'live'

function badgeTone(tone: ReelTone) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

/**
 * Falls back to an icon when the thumbnail fails to load, not just when the URL
 * is absent — signed Cloudflare URLs expire, and the browser's broken-image
 * glyph reads as a bug in the portal rather than a stale asset.
 */
function ReelThumbnail({ reel }: { reel: AdminReel }) {
  const [failed, setFailed] = useState(false)
  const src = reel.media.thumbnailUrl

  if (!src || failed) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-[0.25rem] border border-border text-muted">
        <Film className="size-3" />
      </span>
    )
  }

  return (
    <img
      alt=""
      className="size-6 shrink-0 rounded-[0.25rem] border border-border object-cover"
      loading="lazy"
      src={src}
      onError={() => setFailed(true)}
    />
  )
}

interface RowActionsProps {
  reel: AdminReel
  canDeleteReels: boolean
  canModerateReels: boolean
  onAction: (kind: ReelActionKind, reel: AdminReel) => void
}

function RowActions({
  canDeleteReels,
  canModerateReels,
  onAction,
  reel,
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

  const primaryAction = getRowPrimaryAction({ canDeleteReels, canModerateReels, reel })
  const overflowActions = getOverflowActions({
    canDeleteReels,
    canModerateReels,
    primaryAction,
    reel,
  })

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {primaryAction ? (
        <Button
          className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
          size="xs"
          type="button"
          variant="primary"
          onClick={() => onAction(primaryAction, reel)}
        >
          {reelActionLabel(primaryAction)}
        </Button>
      ) : null}

      {overflowActions.length ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for ${reel.publicReelId}`}
            className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-[0.4rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-3.5" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              {overflowActions.map((kind) => (
                <button
                  className={cn(
                    'flex w-full items-center rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                    isDangerReelAction(kind) && 'text-danger',
                  )}
                  key={kind}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onAction(kind, reel)
                  }}
                >
                  {reelActionLabel(kind)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function ReelsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canModerateReels = usePermission('reels:moderate')
  // Hashtags are gated on social-moderation, a different family from reels:*.
  const canReadSocialModeration = usePermission('social-moderation:read')
  const canModerateHashtags = usePermission('social-moderation:update')
  const canDeleteReels = usePermission('reels:delete')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [viewMode, setViewMode] = useState<ReelViewMode>('pending')
  const [city, setCity] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<ReelActionSelection | null>(null)

  const query = useMemo<AdminReelsQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
    }),
    [city, limit, page, search],
  )

  const reelsQuery = useQuery({
    queryKey: ['reels', viewMode, query],
    queryFn: () =>
      viewMode === 'pending'
        ? reelService.getPendingReels(query)
        : reelService.getLiveReels(query),
  })

  const reels = useMemo(() => reelsQuery.data?.data ?? [], [reelsQuery.data])
  const pagination = reelsQuery.data?.pagination

  const countBase = useMemo<AdminReelsQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
    }),
    [city, search],
  )

  /** Both queues are separate endpoints, so counts are fetched together. */
  const queueCountsQuery = useQuery({
    queryKey: ['reels', 'queue-counts', countBase],
    queryFn: async () => {
      const [pending, live] = await Promise.all([
        reelService.getPendingReels(countBase),
        reelService.getLiveReels(countBase),
      ])

      return {
        pending: pending.pagination.totalItems,
        live: live.pagination.totalItems,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const counts = queueCountsQuery.data

  const queueTabs: DataListQueueTab[] = [
    {
      key: 'pending',
      label: 'Pending review',
      count: counts?.pending,
      tone: 'warning',
    },
    { key: 'live', label: 'Live', count: counts?.live },
  ]

  const clearSeededParams = () => {
    const seededKeys = ['search', 'vendorId', 'categoryId', 'moderationStatus', 'uploadStatus']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
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
        return reelService.approveReel(action.reel.reelId, { reason: values.reason })
      }

      if (!values.reason) {
        throw new Error('Reason is required for this reel action.')
      }

      if (action.kind === 'REJECT') {
        return reelService.rejectReel(action.reel.reelId, { reason: values.reason })
      }

      if (action.kind === 'REQUEST_EDIT') {
        return reelService.requestReelEdit(action.reel.reelId, { reason: values.reason })
      }

      if (action.kind === 'PAUSE') {
        return reelService.pauseReel(action.reel.reelId, { reason: values.reason })
      }

      if (action.kind === 'SOFT_DELETE' || action.kind === 'HARD_DELETE') {
        return reelService.deleteReel(action.reel.reelId, {
          hardDelete: action.kind === 'HARD_DELETE',
          reason: values.reason,
        })
      }

      return reelService.removeReel(action.reel.reelId, { reason: values.reason })
    },
    onMutate: () => setActionError(null),
    onSuccess: (_response, variables) => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['reels'] })
      void queryClient.invalidateQueries({
        queryKey: ['reel-detail', variables.action.reel.reelId],
      })
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Reel action failed.')
    },
  })

  const columns: DataListColumn<AdminReel>[] = useMemo(
    () => [
      {
        id: 'reel',
        label: 'Reel',
        defaultWidth: 240,
        minWidth: 190,
        priority: 1,
        grow: true,
        locked: true,
        // A moderation queue is judged on the content, so the frame earns its
        // place in the row: obviously-wrong uploads are caught without opening.
        render: (reel) => (
          <div className="flex min-w-0 items-center gap-2">
            <ReelThumbnail reel={reel} />
            <span className="truncate font-medium text-foreground">
              {reel.caption?.trim() || reel.publicReelId}
            </span>
          </div>
        ),
      },
      {
        id: 'moderation',
        label: 'Moderation',
        defaultWidth: 140,
        minWidth: 120,
        priority: 1,
        render: (reel) => (
          <span
            className="min-w-0 truncate"
            title={humanizeCode(reel.moderation.status)}
          >
            <Badge tone={badgeTone(getModerationStatusTone(reel.moderation.status))}>
              {humanizeCode(reel.moderation.status)}
            </Badge>
          </span>
        ),
      },
      {
        id: 'signal',
        label: 'Signal',
        defaultWidth: 140,
        minWidth: 115,
        priority: 1,
        render: (reel) => {
          const signal = reelSignal(reel)

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
        render: (reel) => (
          <span className="truncate text-muted">{reel.vendor.shopName || '—'}</span>
        ),
      },
      {
        id: 'media',
        label: 'Media',
        defaultWidth: 120,
        minWidth: 100,
        priority: 2,
        render: (reel) => (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span
              className={cn(
                'truncate text-xs',
                getUploadStatusTone(reel.media.uploadStatus) === 'danger' && 'text-danger',
                getUploadStatusTone(reel.media.uploadStatus) === 'warning' && 'text-warning',
                getUploadStatusTone(reel.media.uploadStatus) === 'success' && 'text-muted',
              )}
            >
              {humanizeCode(reel.media.uploadStatus)}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {reelDuration(reel)}
            </span>
          </span>
        ),
      },
      {
        id: 'visibility',
        label: 'Visibility',
        defaultWidth: 100,
        minWidth: 88,
        priority: 3,
        render: (reel) => (
          <span className={reel.publish.isPublished ? 'text-foreground' : 'text-muted'}>
            {reel.publish.isPublished ? 'Published' : humanizeCode(reel.publish.customerVisibility)}
          </span>
        ),
      },
      {
        id: 'category',
        label: 'Category',
        defaultWidth: 130,
        minWidth: 110,
        priority: 3,
        defaultHidden: true,
        render: (reel) => (
          <span className="truncate text-muted">{reel.category?.name ?? '—'}</span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (reel) => (
          <span className="text-muted">{formatDateSafe(reel.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedReels = useMemo(
    () => reels.filter((reel) => selectedIds.includes(reel.reelId)),
    [reels, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('reels'), selectedReels, [
      { header: 'Reel ID', value: (reel) => reel.publicReelId },
      { header: 'Caption', value: (reel) => reel.caption ?? '' },
      { header: 'Content type', value: (reel) => reel.contentType },
      { header: 'Vendor', value: (reel) => reel.vendor.shopName },
      { header: 'Category', value: (reel) => reel.category?.name ?? '' },
      { header: 'Moderation', value: (reel) => reel.moderation.status },
      { header: 'Upload status', value: (reel) => reel.media.uploadStatus },
      { header: 'Duration (s)', value: (reel) => reel.media.durationSeconds ?? '' },
      { header: 'Published', value: (reel) => String(reel.publish.isPublished) },
      { header: 'Visibility', value: (reel) => reel.publish.customerVisibility },
      { header: 'Blocking reasons', value: (reel) => reel.blockingReasons.join('; ') },
      { header: 'Missing fields', value: (reel) => reel.missingFields.join('; ') },
      { header: 'Created', value: (reel) => reel.createdAt },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <div className="flex items-center gap-2">
            <ReelCommentsModerationQueue canModerate={canModerateReels} />
            {canReadSocialModeration ? (
              <HashtagModerationQueue canModerate={canModerateHashtags} />
            ) : null}
            <Button
            aria-label="Refresh reels"
            className="h-9"
            disabled={reelsQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void reelsQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                reelsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
        layout="workspace"
        placement="topbar"
        title="Reels"
      />

      <DataList
        activeQueue={viewMode}
        appliedFilterCount={city.trim() ? 1 : 0}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No reels match these filters"
        errorMessage="Could not load reels."
        filters={
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
        }
        getRowId={(reel) => reel.reelId}
        isError={reelsQuery.isError}
        isLoading={reelsQuery.isLoading}
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
        rowActions={(reel) => (
          <RowActions
            canDeleteReels={canDeleteReels}
            canModerateReels={canModerateReels}
            reel={reel}
            onAction={(kind, target) => {
              setActionError(null)
              setSelectedAction({ kind, reel: target })
            }}
          />
        )}
        rowActionsWidth={130}
        rows={reels}
        search={search}
        searchPlaceholder="Search caption, vendor, reel id…"
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
        storageKey={REEL_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setViewMode(key as ReelViewMode)
          setPage(1)
        }}
        onResetFilters={() => {
          setCity('')
          setPage(1)
        }}
        onRetry={() => void reelsQuery.refetch()}
        onRowClick={(reel) => navigate(`${routePaths.reels}/${reel.reelId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {selectedAction ? (
        <ReelActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedAction(null)
              setActionError(null)
            }
          }}
          onSubmit={(values) =>
            void actionMutation.mutateAsync({ action: selectedAction, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
