import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  FileAudio,
  Image,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  ShieldOff,
} from 'lucide-react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type {
  DataListColumn,
  DataListQueueTab,
} from '../../../components/ui/DataList'
import { filterInputClass } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { ReasonModal } from '../../../components/ui/ReasonModal'
import {
  RowActionMenu,
  type RowActionMenuItem,
} from '../../../components/ui/RowActionMenu'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { creatorMusicService } from '../services/creatorMusic.service'
import type {
  AdminMusicTrack,
  MusicTrackStatus,
} from '../types/creatorMusic.types'
import { CreatorMusicFormModal } from './CreatorMusicFormModal'

const CREATOR_MUSIC_LIST_STORAGE_KEY = 'servicegram.creatorMusic.list.v1'
const DEFAULT_PAGE_SIZE = 50

type QueueKey = 'all' | 'draft' | 'active' | 'paused' | 'retired'
type LifecycleAction = 'ACTIVATE' | 'PAUSE' | 'RETIRE' | 'REVOKE_LICENSE'

function statusTone(status: MusicTrackStatus) {
  if (status === 'ACTIVE') return 'success' as const
  if (status === 'PAUSED') return 'warning' as const
  return 'neutral' as const
}

function licenseTone(status: AdminMusicTrack['licenseStatus']) {
  if (status === 'CLEARED') return 'success' as const
  if (status === 'REVOKED') return 'danger' as const
  return 'warning' as const
}

function formatDateSafe(value: string) {
  try {
    return formatDate(value, true)
  } catch {
    return '—'
  }
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

function activationBlockMessage(track: AdminMusicTrack) {
  const missing: string[] = []
  const now = Date.now()

  if (track.licenseStatus !== 'CLEARED') missing.push('cleared licence status')
  if (!track.license?.provider) missing.push('licence provider')
  if (!track.license?.reference) missing.push('licence reference')
  if (!track.license?.territories.length) missing.push('licensed territory')
  if (track.media?.audioStatus !== 'AVAILABLE') missing.push('available audio')
  if (track.license?.validFrom && Date.parse(track.license.validFrom) > now) {
    missing.push('a licence that has already started')
  }
  if (track.license?.validUntil && Date.parse(track.license.validUntil) <= now) {
    missing.push('an unexpired licence')
  }

  return missing.length
    ? `Complete ${missing.join(', ')} before activation.`
    : null
}

function QuickUpload({
  accept,
  ariaLabel,
  disabled,
  icon,
  onFile,
}: {
  accept: string
  ariaLabel: string
  disabled: boolean
  icon: React.ReactNode
  onFile: (file: File) => void
}) {
  return (
    <label
      aria-label={ariaLabel}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-within:ring-2 focus-within:ring-ring',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
      title={ariaLabel}
    >
      {icon}
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </label>
  )
}

function TrackRowActions({
  canPublish,
  canUpdate,
  disabled,
  track,
  onLifecycle,
  onUpload,
}: {
  canPublish: boolean
  canUpdate: boolean
  disabled: boolean
  track: AdminMusicTrack
  onLifecycle: (action: LifecycleAction) => void
  onUpload: (kind: 'AUDIO' | 'ARTWORK', file: File) => void
}) {
  const menuItems: RowActionMenuItem[] = []

  if (canPublish && track.status !== 'ACTIVE') {
    menuItems.push({
      icon: <Play className="size-3.5" />,
      key: 'activate',
      label: 'Activate',
      onClick: () => onLifecycle('ACTIVATE'),
    })
  }
  if (canPublish && track.status === 'ACTIVE') {
    menuItems.push({
      icon: <Pause className="size-3.5" />,
      key: 'pause',
      label: 'Pause',
      onClick: () => onLifecycle('PAUSE'),
    })
  }
  if (canPublish) {
    menuItems.push({
      icon: <Archive className="size-3.5" />,
      key: 'retire',
      label: 'Retire',
      onClick: () => onLifecycle('RETIRE'),
    })
  }
  if (canPublish && track.licenseStatus !== 'REVOKED') {
    menuItems.push({
      icon: <ShieldOff className="size-3.5" />,
      key: 'revoke',
      label: 'Revoke licence',
      tone: 'danger',
      onClick: () => onLifecycle('REVOKE_LICENSE'),
    })
  }

  return (
    <div className="flex items-center gap-0.5">
      {canUpdate ? (
        <QuickUpload
          accept="audio/mpeg,audio/mp4,audio/aac,audio/wav"
          ariaLabel={`Upload audio for ${track.title}`}
          disabled={disabled}
          icon={<FileAudio className="size-4" />}
          onFile={(file) => onUpload('AUDIO', file)}
        />
      ) : null}
      {canUpdate ? (
        <QuickUpload
          accept="image/jpeg,image/png,image/webp"
          ariaLabel={`Upload artwork for ${track.title}`}
          disabled={disabled}
          icon={<Image className="size-4" />}
          onFile={(file) => onUpload('ARTWORK', file)}
        />
      ) : null}
      <RowActionMenu
        ariaLabel={`More actions for ${track.title}`}
        items={menuItems}
      />
    </div>
  )
}

export function CreatorMusicPage() {
  const queryClient = useQueryClient()
  const canUpdate = usePermission('creator_music:update')
  const canPublish = usePermission('creator_music:publish')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [queue, setQueue] = useState<QueueKey>('all')
  const [licenseFilter, setLicenseFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [moodFilter, setMoodFilter] = useState('')
  const [territoryFilter, setTerritoryFilter] = useState('')
  const [explicitFilter, setExplicitFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expiringFilter, setExpiringFilter] = useState('')
  const [formTarget, setFormTarget] = useState<AdminMusicTrack | null>()
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lifecycleTarget, setLifecycleTarget] = useState<{
    action: LifecycleAction
    track: AdminMusicTrack
  } | null>(null)

  const status: '' | MusicTrackStatus =
    queue === 'draft'
      ? 'DRAFT'
      : queue === 'active'
        ? 'ACTIVE'
        : queue === 'paused'
          ? 'PAUSED'
          : queue === 'retired'
            ? 'RETIRED'
            : ''

  const commonFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      licenseStatus: licenseFilter || undefined,
      sourceType: sourceFilter || undefined,
      mood: moodFilter.trim() || undefined,
      territory: territoryFilter.trim().toUpperCase() || undefined,
      explicit: explicitFilter || undefined,
      categoryId: categoryFilter.trim() || undefined,
      expiringBefore: expiringFilter
        ? new Date(`${expiringFilter}T23:59:59`).toISOString()
        : undefined,
    }),
    [
      categoryFilter,
      explicitFilter,
      expiringFilter,
      licenseFilter,
      moodFilter,
      search,
      sourceFilter,
      territoryFilter,
    ],
  )

  const query = useMemo(
    () => ({
      ...commonFilters,
      page,
      limit,
      status: status || undefined,
    }),
    [commonFilters, limit, page, status],
  )

  const tracksQuery = useQuery({
    queryKey: ['creator-music', query],
    queryFn: () => creatorMusicService.list(query),
  })

  const queueCountsQuery = useQuery({
    queryKey: ['creator-music', 'queue-counts', commonFilters],
    queryFn: async () => {
      const [all, draft, active, paused, retired] = await Promise.all([
        creatorMusicService.list({ ...commonFilters, page: 1, limit: 1 }),
        creatorMusicService.list({ ...commonFilters, page: 1, limit: 1, status: 'DRAFT' }),
        creatorMusicService.list({ ...commonFilters, page: 1, limit: 1, status: 'ACTIVE' }),
        creatorMusicService.list({ ...commonFilters, page: 1, limit: 1, status: 'PAUSED' }),
        creatorMusicService.list({ ...commonFilters, page: 1, limit: 1, status: 'RETIRED' }),
      ])

      return {
        all: all.pagination?.totalItems ?? all.data.length,
        draft: draft.pagination?.totalItems ?? draft.data.length,
        active: active.pagination?.totalItems ?? active.data.length,
        paused: paused.pagination?.totalItems ?? paused.data.length,
        retired: retired.pagination?.totalItems ?? retired.data.length,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const tracks = useMemo(() => tracksQuery.data?.data ?? [], [tracksQuery.data])
  const pagination = tracksQuery.data?.pagination
  const counts = queueCountsQuery.data

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: counts?.all },
    { key: 'draft', label: 'Draft', count: counts?.draft },
    { key: 'active', label: 'Active', count: counts?.active },
    { key: 'paused', label: 'Paused', count: counts?.paused, tone: 'warning' },
    { key: 'retired', label: 'Retired', count: counts?.retired },
  ]

  const appliedFilterCount = [
    licenseFilter,
    sourceFilter,
    moodFilter.trim(),
    territoryFilter.trim(),
    explicitFilter,
    categoryFilter.trim(),
    expiringFilter,
  ].filter(Boolean).length

  const columns: DataListColumn<AdminMusicTrack>[] = useMemo(
    () => [
      {
        id: 'track',
        label: 'Track',
        defaultWidth: 280,
        minWidth: 220,
        priority: 1,
        grow: true,
        locked: true,
        render: (track) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">{track.title}</span>
            <span className="shrink-0 text-xs text-muted">{track.artistName}</span>
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        defaultWidth: 96,
        minWidth: 88,
        priority: 1,
        render: (track) => <Badge tone={statusTone(track.status)}>{track.status}</Badge>,
      },
      {
        id: 'license',
        label: 'Licence',
        defaultWidth: 104,
        minWidth: 96,
        priority: 1,
        render: (track) => (
          <Badge tone={licenseTone(track.licenseStatus)}>{track.licenseStatus}</Badge>
        ),
      },
      {
        id: 'source',
        label: 'Source',
        defaultWidth: 128,
        minWidth: 112,
        priority: 2,
        render: (track) => <span>{humanize(track.sourceType)}</span>,
      },
      {
        id: 'duration',
        label: 'Duration',
        defaultWidth: 88,
        minWidth: 76,
        priority: 2,
        align: 'right',
        render: (track) => <span>{(track.durationMs / 1000).toFixed(1)}s</span>,
      },
      {
        id: 'moods',
        label: 'Moods',
        defaultWidth: 150,
        minWidth: 120,
        priority: 3,
        render: (track) => (
          <span className={track.moodTags.length ? '' : 'text-muted'}>
            {track.moodTags.join(', ') || '—'}
          </span>
        ),
      },
      {
        id: 'trackId',
        label: 'Track ID',
        defaultWidth: 132,
        minWidth: 116,
        priority: 4,
        defaultHidden: true,
        render: (track) => <span className="text-muted">{track.publicTrackId}</span>,
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 140,
        minWidth: 120,
        priority: 4,
        defaultHidden: true,
        render: (track) => (
          <span className="text-muted">{formatDateSafe(track.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const lifecycleMutation = useMutation({
    mutationFn: ({
      action,
      reason,
      track,
    }: {
      action: LifecycleAction
      reason: string
      track: AdminMusicTrack
    }) => creatorMusicService.lifecycle(track, action, reason),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setLifecycleTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['creator-music'] })
    },
    onError: (cause) =>
      setActionError(cause instanceof Error ? cause.message : 'Action failed.'),
  })

  const uploadMutation = useMutation({
    mutationFn: ({
      file,
      kind,
      trackId,
    }: {
      file: File
      kind: 'AUDIO' | 'ARTWORK'
      trackId: string
    }) => creatorMusicService.upload(trackId, kind, file),
    onMutate: () => setActionError(null),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['creator-music'] }),
    onError: (cause) =>
      setActionError(cause instanceof Error ? cause.message : 'Upload failed.'),
  })

  const runLifecycle = async (track: AdminMusicTrack, action: LifecycleAction) => {
    let currentTrack = track

    if (action === 'ACTIVATE') {
      try {
        const response = await creatorMusicService.detail(track.trackId)
        currentTrack = response.data
        const blockMessage = activationBlockMessage(currentTrack)

        if (blockMessage) {
          setActionError(null)
          setFormMessage(blockMessage)
          setFormTarget(track)
          return
        }
      } catch (cause) {
        setActionError(
          cause instanceof Error
            ? cause.message
            : 'Could not verify whether this track is ready to activate.',
        )
        return
      }
    }

    setActionError(null)
    setLifecycleTarget({ action, track: currentTrack })
  }

  const resetFilters = () => {
    setLicenseFilter('')
    setSourceFilter('')
    setMoodFilter('')
    setTerritoryFilter('')
    setExplicitFilter('')
    setCategoryFilter('')
    setExpiringFilter('')
    setPage(1)
  }

  const formSaved = () => {
    setFormTarget(undefined)
    setFormMessage(null)
    setActionError(null)
    void queryClient.invalidateQueries({ queryKey: ['creator-music'] })
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <div className="flex items-center gap-2">
            {canUpdate ? (
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setFormMessage(null)
                  setFormTarget(null)
                }}
              >
                <Plus className="mr-2 size-4" />
                Track
              </Button>
            ) : null}
            <Button
              aria-label="Refresh Creator Music"
              className="h-9"
              disabled={tracksQuery.isLoading}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void tracksQuery.refetch()}
            >
              <RefreshCcw
                className={cn(
                  'size-4 sm:mr-2',
                  tracksQuery.isFetching && 'animate-spin motion-reduce:animate-none',
                )}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        }
        layout="workspace"
        placement="topbar"
        title="Creator Music"
      />

      {actionError ? (
        <p className="mb-2 rounded-[0.6rem] border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      <DataList
        activeQueue={queue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint="Try a different search term, switch queue, or clear the active filters."
        emptyMessage="No music tracks match these filters"
        errorMessage="Could not load Creator Music."
        filters={
          <>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Licence</span>
              <select
                className={filterInputClass}
                value={licenseFilter}
                onChange={(event) => {
                  setLicenseFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">All licences</option>
                <option value="PENDING">Pending</option>
                <option value="CLEARED">Cleared</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Source</span>
              <select
                className={filterInputClass}
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">All sources</option>
                <option value="LICENSED">Licensed</option>
                <option value="ROYALTY_FREE">Royalty free</option>
                <option value="PLATFORM_OWNED">Platform owned</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Mood</span>
              <input
                className={filterInputClass}
                placeholder="Any mood"
                value={moodFilter}
                onChange={(event) => {
                  setMoodFilter(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Territory</span>
              <input
                className={filterInputClass}
                maxLength={2}
                placeholder="Any territory"
                value={territoryFilter}
                onChange={(event) => {
                  setTerritoryFilter(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Content</span>
              <select
                className={filterInputClass}
                value={explicitFilter}
                onChange={(event) => {
                  setExplicitFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">All content</option>
                <option value="false">Clean only</option>
                <option value="true">Explicit only</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Service category</span>
              <input
                className={filterInputClass}
                placeholder="Category UUID"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Expiring before</span>
              <input
                className={filterInputClass}
                type="date"
                value={expiringFilter}
                onChange={(event) => {
                  setExpiringFilter(event.target.value)
                  setPage(1)
                }}
              />
            </label>
          </>
        }
        getRowId={(track) => track.trackId}
        isError={tracksQuery.isError}
        isLoading={tracksQuery.isLoading}
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
        rowActions={
          canUpdate || canPublish
            ? (track) => (
                <TrackRowActions
                  canPublish={canPublish}
                  canUpdate={canUpdate}
                  disabled={uploadMutation.isPending}
                  track={track}
                  onLifecycle={(action) => void runLifecycle(track, action)}
                  onUpload={(kind, file) =>
                    uploadMutation.mutate({ trackId: track.trackId, kind, file })
                  }
                />
              )
            : undefined
        }
        rowActionsWidth={84}
        rows={tracks}
        search={search}
        searchPlaceholder="Search title, artist, track ID…"
        storageKey={CREATOR_MUSIC_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as QueueKey)
          setPage(1)
        }}
        onRowClick={
          canUpdate
            ? (track) => {
                setFormMessage(null)
                setFormTarget(track)
              }
            : undefined
        }
        onResetFilters={resetFilters}
        onRetry={() => void tracksQuery.refetch()}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {formTarget !== undefined ? (
        <CreatorMusicFormModal
          key={formTarget?.trackId ?? 'new'}
          initialMessage={formMessage}
          track={formTarget}
          onClose={() => {
            setFormMessage(null)
            setFormTarget(undefined)
          }}
          onSaved={formSaved}
        />
      ) : null}

      {lifecycleTarget ? (
        <ReasonModal
          confirmLabel={humanize(lifecycleTarget.action)}
          error={lifecycleMutation.error}
          isDestructive={
            lifecycleTarget.action === 'RETIRE' ||
            lifecycleTarget.action === 'REVOKE_LICENSE'
          }
          isSubmitting={lifecycleMutation.isPending}
          subtitle={lifecycleTarget.track.title}
          title={`${humanize(lifecycleTarget.action)} this track?`}
          onClose={() => setLifecycleTarget(null)}
          onSubmit={(reason) =>
            lifecycleMutation.mutate({
              action: lifecycleTarget.action,
              reason,
              track: lifecycleTarget.track,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
