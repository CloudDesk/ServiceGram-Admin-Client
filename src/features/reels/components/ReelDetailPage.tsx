import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  ExternalLink,
  Film,
  ImageIcon,
  PauseCircle,
  PencilLine,
  RefreshCcw,
  ShieldCheck,
  Store,
  Tags,
  Trash2,
  TriangleAlert,
  UserRound,
  Video,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { OverflowText } from '../../../components/ui/OverflowText'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { useMediaViewer, type MediaViewerItem } from '../../../components/media'
import { routePaths } from '../../../config/routes'
import {
  RecordHeaderActions,
  RecordMetricStrip,
  RecordTabs,
  type RecordAction,
  type RecordTabItem,
} from '../../../components/ui/RecordPage'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { reelService } from '../services/reel.service'
import {
  ReelActionModal,
  type ReelActionFormValues,
  type ReelActionKind,
  type ReelActionSelection,
} from './ReelActionModal'
import type {
  AdminReel,
  AdminReelChecklistItem,
  ReelModerationStatus,
  ReelUploadStatus,
} from '../types/reel.types'

type ReelTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const reelActionKinds: ReelActionKind[] = [
  'APPROVE',
  'REJECT',
  'REQUEST_EDIT',
  'PAUSE',
  'REMOVE',
  'SOFT_DELETE',
  'HARD_DELETE',
]

const reelDetailSectionIds = {
  checklist: 'reel-checklist',
  context: 'reel-context',
  media: 'reel-media',
  moderation: 'reel-moderation',
  overview: 'reel-overview',
  related: 'reel-related',
  signals: 'reel-signals',
} as const

const checklistColumns: DynamicTableColumn<AdminReelChecklistItem>[] = [
  {
    key: 'label',
    label: 'Check',
    minWidth: 240,
  },
  {
    key: 'passed',
    label: 'Status',
    format: 'status',
    statusTone: (value) => (value === 'PASSED' ? 'success' : 'warning'),
    minWidth: 160,
    getValue: (row) => (row.passed ? 'PASSED' : 'NEEDS_ATTENTION'),
  },
  {
    key: 'missingFields',
    label: 'Missing Fields',
    minWidth: 280,
    getValue: (row) =>
      row.missingFields?.length ? row.missingFields.join(', ') : 'None',
  },
]

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | boolean | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">
        {value === true ? 'Yes' : value === false ? 'No' : value ?? 'Not available'}
      </p>
    </div>
  )
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

  try {
    return formatDate(value, true)
  } catch {
    return value
  }
}

function formatDuration(value: number | null | undefined) {
  if (value == null) return 'Duration unavailable'

  if (value < 60) return `${value} sec`

  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function routeWithFilters(path: string, filters: Record<string, string | undefined>) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })

  const query = params.toString()

  return query ? `${path}?${query}` : path
}

function isReelActionKind(action: string): action is ReelActionKind {
  return reelActionKinds.includes(action as ReelActionKind)
}

function canRunReelAction({
  action,
  canDeleteReels,
  canModerateReels,
}: {
  action: string | null | undefined
  canDeleteReels: boolean
  canModerateReels: boolean
}) {
  if (!action) return false

  if (!isReelActionKind(action)) return false

  if (action === 'SOFT_DELETE' || action === 'HARD_DELETE') {
    return canDeleteReels
  }

  return canModerateReels
}

function isOpenableUrl(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function buildReelMediaViewerItems(reel: AdminReel): MediaViewerItem[] {
  const relatedItems: MediaViewerItem[] = []
  const thumbnailUrl = isOpenableUrl(reel.media.thumbnailUrl)
    ? reel.media.thumbnailUrl
    : null
  const playbackUrl = isOpenableUrl(reel.media.playbackUrl)
    ? reel.media.playbackUrl
    : null

  if (thumbnailUrl) {
    relatedItems.push({
      description: `${humanizeCode(reel.media.uploadStatus)} thumbnail used in reel review.`,
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
      description: `${humanizeCode(reel.media.uploadStatus)} · ${formatDuration(
        reel.media.durationSeconds,
      )}`,
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
      description: `${humanizeCode(reel.media.uploadStatus)} · ${formatDuration(
        reel.media.durationSeconds,
      )}`,
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

function findReelMediaIndex(items: MediaViewerItem[], kind: 'image' | 'video') {
  return items.findIndex((item) => {
    if (kind === 'image') {
      return (
        item.kind === 'image' ||
        Boolean(item.relatedItems?.some((relatedItem) => relatedItem.kind === 'image'))
      )
    }

    return (
      item.kind === 'cloudflare-video' ||
      item.kind === 'video' ||
      Boolean(
        item.relatedItems?.some(
          (relatedItem) =>
            relatedItem.kind === 'cloudflare-video' || relatedItem.kind === 'video',
        ),
      )
    )
  })
}

function UrlDetailField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  if (!isOpenableUrl(value)) {
    return <DetailField label={label} value={value} />
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <a
        aria-label={`Open ${label} in a new tab`}
        className="inline-flex max-w-full items-start gap-1.5 break-all text-sm font-medium text-primary transition hover:underline"
        href={value}
        rel="noreferrer"
        target="_blank"
        title={value}
      >
        <span className="min-w-0 break-all">{value}</span>
        <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
      </a>
    </div>
  )
}

function getUploadStatusTone(status: ReelUploadStatus) {
  if (status === 'READY') {
    return 'success'
  }

  if (status === 'FAILED') {
    return 'danger'
  }

  return 'warning'
}

function getModerationStatusTone(status: ReelModerationStatus) {
  if (status === 'APPROVED') {
    return 'success'
  }

  if (status === 'REJECTED' || status === 'REMOVED') {
    return 'danger'
  }

  if (status === 'PENDING_REVIEW' || status === 'EDIT_REQUESTED') {
    return 'warning'
  }

  return 'neutral'
}

function buildReelDetailMetrics(
  reel: AdminReel,
  {
    canDeleteReels,
    canModerateReels,
  }: { canDeleteReels: boolean; canModerateReels: boolean },
) {
  const riskCount =
    reel.warnings.length + reel.blockingReasons.length + reel.missingFields.length
  const canRunRecommendedAction = canRunReelAction({
    action: reel.nextRecommendedAction,
    canDeleteReels,
    canModerateReels,
  })

  return [
    {
      label: 'Moderation',
      value: humanizeCode(reel.moderation.status),
      meta: reel.nextRecommendedAction
        ? canRunRecommendedAction
          ? `Next: ${humanizeCode(reel.nextRecommendedAction)}`
          : 'No permitted actions'
        : 'No pending action',
      tone: getModerationStatusTone(reel.moderation.status),
      icon: <ShieldCheck className="size-4" />,
    },
    {
      label: 'Upload',
      value: humanizeCode(reel.media.uploadStatus),
      meta: formatDuration(reel.media.durationSeconds),
      tone: getUploadStatusTone(reel.media.uploadStatus),
      icon: <Video className="size-4" />,
    },
    {
      label: 'Visibility',
      value: humanizeCode(reel.publish.customerVisibility),
      meta: reel.publish.isPublished ? 'Published reel' : 'Hidden from customers',
      tone: reel.publish.customerVisibility === 'VISIBLE' ? 'success' : 'neutral',
      icon: <Eye className="size-4" />,
    },
    {
      label: 'Signals',
      value: String(riskCount),
      meta: 'Warnings, blockers, and missing fields',
      tone: riskCount > 0 ? 'warning' : 'neutral',
      icon: <TriangleAlert className="size-4" />,
    },
  ] satisfies {
    icon: ReactNode
    label: string
    meta: string
    tone: ReelTone
    value: string
  }[]
}

export type ReelDetailTab =
  | 'overview'
  | 'media'
  | 'moderation'
  | 'context'
  | 'checklist'

const REEL_DETAIL_TABS: ReelDetailTab[] = [
  'overview',
  'media',
  'moderation',
  'context',
  'checklist',
]

function ReelDetailSectionNav({
  activeTab,
  reel,
  reelId,
}: {
  activeTab: ReelDetailTab
  reel: AdminReel
  reelId: string
}) {
  const mediaCount = buildReelMediaViewerItems(reel).length
  const items: RecordTabItem[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'media', label: 'Media', count: mediaCount },
    { key: 'moderation', label: 'Moderation' },
    { key: 'context', label: 'Context' },
    { key: 'checklist', label: 'Checklist', count: reel.reviewChecklist.length },
  ]

  return (
    <RecordTabs
      activeTab={activeTab}
      ariaLabel="Reel detail sections"
      basePath={`${routePaths.reels}/${reelId}`}
      tabPrefix="/tab"
      defaultTab="overview"
      items={items}
    />
  )
}

function ReelHeaderStatus({ reel }: { reel: AdminReel }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={getModerationStatusTone(reel.moderation.status)}>
        {humanizeCode(reel.moderation.status)}
      </Badge>
      <Badge tone={getUploadStatusTone(reel.media.uploadStatus)}>
        {humanizeCode(reel.media.uploadStatus)}
      </Badge>
      <Badge tone={reel.publish.customerVisibility === 'VISIBLE' ? 'success' : 'neutral'}>
        {humanizeCode(reel.publish.customerVisibility)}
      </Badge>
    </div>
  )
}

function ReelHeaderActions({
  canDeleteReels,
  canModerateReels,
  isRefreshing,
  isSubmitting,
  onRefresh,
  onSelectAction,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  isRefreshing: boolean
  isSubmitting: boolean
  onRefresh: () => void
  onSelectAction: (kind: ReelActionKind) => void
  reel: AdminReel
}) {
  const hasAction = (action: ReelActionKind) =>
    reel.availableActions.includes(action) &&
    canRunReelAction({ action, canDeleteReels, canModerateReels })

  const build = (
    kind: ReelActionKind,
    label: string,
    icon: ReactNode,
    intent: RecordAction['intent'],
  ): RecordAction | null =>
    hasAction(kind)
      ? { key: kind, label, icon, intent, onSelect: () => onSelectAction(kind) }
      : null

  const actions = [
    build('APPROVE', 'Approve', <CheckCircle2 className="size-4" />, 'primary'),
    build('REQUEST_EDIT', 'Request edit', <PencilLine className="size-4" />, 'secondary'),
    build('PAUSE', 'Pause', <PauseCircle className="size-4" />, 'secondary'),
    build('REJECT', 'Reject', <XCircle className="size-4" />, 'destructive'),
    build('REMOVE', 'Remove', <Trash2 className="size-4" />, 'destructive'),
    build('SOFT_DELETE', 'Soft delete', <Trash2 className="size-4" />, 'destructive'),
    build('HARD_DELETE', 'Hard delete', <Trash2 className="size-4" />, 'destructive'),
  ].filter(Boolean) as RecordAction[]

  return (
    <RecordHeaderActions
      actions={actions}
      disabled={isSubmitting}
      utility={
        <Button
          aria-label={isRefreshing ? 'Refreshing reel' : 'Refresh reel'}
          size="sm"
          title={isRefreshing ? 'Refreshing reel' : 'Refresh reel'}
          type="button"
          variant="secondary"
          onClick={onRefresh}
        >
          <RefreshCcw
            className={cn(
              'mr-2 size-4',
              isRefreshing && 'animate-spin motion-reduce:animate-none',
            )}
          />
          Refresh
        </Button>
      }
    />
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  id,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  id?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section
      className="scroll-mt-24 rounded-[1rem] border border-border bg-surface p-4 shadow-surface"
      id={id}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}

function RelatedRecordRow({
  actionLabel = 'Open',
  canOpen,
  icon,
  label,
  meta,
  onOpen,
  value,
}: {
  actionLabel?: string
  canOpen: boolean
  icon: ReactNode
  label: string
  meta: string
  onOpen?: () => void
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            {label}
          </p>
          <OverflowText
            as="p"
            className="mt-1 text-sm font-semibold text-foreground"
            title={value}
          >
            {value}
          </OverflowText>
          <OverflowText as="p" className="mt-1 text-xs text-muted" title={meta}>
            {meta}
          </OverflowText>
        </div>
      </div>
      {canOpen && onOpen ? (
        <Button className="shrink-0" size="sm" variant="secondary" onClick={onOpen}>
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function RelatedRecordsPanel({
  canReadInfluencers,
  canReadVendors,
  id,
  onNavigate,
  reel,
}: {
  canReadInfluencers: boolean
  canReadVendors: boolean
  id?: string
  onNavigate: (path: string) => void
  reel: AdminReel
}) {
  const { openMediaViewer } = useMediaViewer()
  const mediaItems = buildReelMediaViewerItems(reel)
  const videoIndex = findReelMediaIndex(mediaItems, 'video')
  const canOpenPlayback = videoIndex >= 0
  const reelQueueView = reel.publish.customerVisibility === 'VISIBLE' ? 'live' : 'pending'

  return (
    <SectionShell
      description="Primary operational records attached to this reel."
      id={id}
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          canOpen={canReadVendors}
          icon={<Store className="size-4" />}
          label="Vendor"
          meta={`${reel.vendor.publicVendorId} · ${reel.vendor.zone?.zoneName ?? reel.vendor.city}`}
          value={reel.vendor.shopName}
          onOpen={() => onNavigate(`${routePaths.vendors}/${reel.vendor.vendorId}`)}
        />
        <RelatedRecordRow
          actionLabel="Queue"
          canOpen
          icon={<Film className="size-4" />}
          label="Vendor reel queue"
          meta="Current moderation workspace filtered by this vendor"
          value={reel.vendor.shopName}
          onOpen={() =>
            onNavigate(
              routeWithFilters(routePaths.reels, {
                vendorId: reel.vendor.vendorId,
                vendorLabel: reel.vendor.shopName,
                view: reelQueueView,
              }),
            )
          }
        />
        {reel.influencer ? (
          <RelatedRecordRow
            actionLabel="Influencer"
            canOpen={canReadInfluencers}
            icon={<UserRound className="size-4" />}
            label="Influencer"
            meta={`${reel.influencer.publicInfluencerId} · ${humanizeCode(
              reel.influencer.status,
            )}`}
            value={
              reel.influencer.socialHandle
                ? `${reel.influencer.displayName} · ${reel.influencer.socialHandle}`
                : reel.influencer.displayName
            }
            onOpen={() =>
              onNavigate(
                `${routePaths.influencers}/${reel.influencer?.influencerProfileId}`,
              )
            }
          />
        ) : null}
        <RelatedRecordRow
          actionLabel="Queue"
          canOpen={Boolean(reel.category)}
          icon={<Tags className="size-4" />}
          label="Category"
          meta={reel.category?.categoryCode ?? 'No category code'}
          value={reel.category?.name ?? 'Unassigned category'}
          onOpen={() =>
            onNavigate(
              routeWithFilters(routePaths.reels, {
                categoryId: reel.category?.categoryId,
                categoryLabel: reel.category?.name,
                view: reelQueueView,
              }),
            )
          }
        />
        <RelatedRecordRow
          actionLabel="Playback"
          canOpen={canOpenPlayback}
          icon={<Film className="size-4" />}
          label="Media"
          meta={`${humanizeCode(reel.media.uploadStatus)} · ${formatDuration(
            reel.media.durationSeconds,
          )}`}
          value={reel.media.cloudflareVideoUid ?? reel.publicReelId}
          onOpen={() => {
            if (canOpenPlayback) {
              openMediaViewer({ items: mediaItems, startIndex: videoIndex })
            }
          }}
        />
      </div>
    </SectionShell>
  )
}

function SignalBadgeGroup({
  emptyLabel,
  items,
  tone,
}: {
  emptyLabel: string
  items: string[]
  tone: ReelTone
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <Badge key={item} tone={tone}>
            {humanizeCode(item)}
          </Badge>
        ))
      ) : (
        <Badge tone="success">{emptyLabel}</Badge>
      )}
    </div>
  )
}

function OperationalSignalsPanel({
  canDeleteReels,
  canModerateReels,
  id,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  id?: string
  reel: AdminReel
}) {
  const permittedActions = reel.availableActions.filter((action) =>
    canRunReelAction({ action, canDeleteReels, canModerateReels }),
  )
  const canRunRecommendedAction = canRunReelAction({
    action: reel.nextRecommendedAction,
    canDeleteReels,
    canModerateReels,
  })

  return (
    <SectionShell
      description="Backend workflow signals and actions permitted for this admin."
      id={id}
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <SignalBadgeGroup
            emptyLabel="No warnings"
            items={reel.warnings}
            tone="warning"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Blocking reasons
          </p>
          <SignalBadgeGroup
            emptyLabel="No blockers"
            items={reel.blockingReasons}
            tone="danger"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <SignalBadgeGroup
            emptyLabel="No permitted actions"
            items={permittedActions}
            tone="neutral"
          />
        </div>
        <DetailField
          label="Recommended next"
          value={
            canRunRecommendedAction
              ? humanizeCode(reel.nextRecommendedAction)
              : 'No permitted actions'
          }
        />
      </div>
    </SectionShell>
  )
}

function ReelMediaPanel({ id, reel }: { id?: string; reel: AdminReel }) {
  const { openMediaViewer } = useMediaViewer()
  const mediaItems = buildReelMediaViewerItems(reel)
  const hasThumbnail = isOpenableUrl(reel.media.thumbnailUrl)
  const thumbnailIndex = findReelMediaIndex(mediaItems, 'image')
  const videoIndex = findReelMediaIndex(mediaItems, 'video')
  const hasPlayback = videoIndex >= 0

  return (
    <SectionShell
      actionNode={
        hasPlayback ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => openMediaViewer({ items: mediaItems, startIndex: videoIndex })}
          >
            <Eye className="mr-2 size-4" />
            Playback
          </Button>
        ) : null
      }
      description="Cloudflare Stream state and media URLs for review."
      id={id}
      icon={<Video className="size-4" />}
      title="Media"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]">
        <div className="overflow-hidden rounded-[0.875rem] border border-border bg-surface-muted/40">
          <div className="flex aspect-video items-center justify-center">
            {hasThumbnail ? (
              <button
                className="group relative h-full w-full overflow-hidden text-left"
                type="button"
                onClick={() =>
                  openMediaViewer({
                    items: mediaItems,
                    startIndex: thumbnailIndex >= 0 ? thumbnailIndex : 0,
                  })
                }
              >
                <img
                  alt={`Thumbnail for ${reel.publicReelId}`}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  src={reel.media.thumbnailUrl as string}
                />
                <span className="absolute bottom-3 right-3 inline-flex items-center rounded-control bg-black/70 px-3 py-2 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Eye className="mr-2 size-4" />
                  View thumbnail
                </span>
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted">
                <ImageIcon className="size-8" />
                <span className="text-sm">No thumbnail</span>
              </div>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <DetailField
            label="Cloudflare Video UID"
            value={reel.media.cloudflareVideoUid}
          />
          <DetailField label="Duration" value={formatDuration(reel.media.durationSeconds)} />
          <DetailField
            label="Dimensions"
            value={
              reel.media.width && reel.media.height
                ? `${reel.media.width} x ${reel.media.height}`
                : null
            }
          />
          <DetailField label="Aspect Ratio" value={reel.media.aspectRatio} />
          <DetailField label="Upload Status" value={humanizeCode(reel.media.uploadStatus)} />
          <UrlDetailField label="Playback URL" value={reel.media.playbackUrl} />
          <UrlDetailField label="Thumbnail URL" value={reel.media.thumbnailUrl} />
        </div>
      </div>
    </SectionShell>
  )
}

export function ReelDetailPage() {
  const { reelId, tab: tabParam } = useParams()
  const activeTab: ReelDetailTab = REEL_DETAIL_TABS.includes(
    tabParam as ReelDetailTab,
  )
    ? (tabParam as ReelDetailTab)
    : 'overview' 
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canModerateReels = usePermission('reels:moderate')
  const canDeleteReels = usePermission('reels:delete')
  const canReadVendors = usePermission('vendors:read')
  const canReadInfluencers = usePermission('influencers:read')
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<ReelActionSelection | null>(null)

  const reelQuery = useQuery({
    enabled: Boolean(reelId),
    queryKey: ['reel-detail', reelId],
    queryFn: () => reelService.getReelById(reelId as string),
  })

  const reel = reelQuery.data?.data

  const refreshReel = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['reel-detail', reelId] }),
      queryClient.invalidateQueries({ queryKey: ['reels'] }),
    ])
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: ReelActionSelection
      values: ReelActionFormValues
    }) => {
      if (!reel) {
        throw new Error('Reel details are unavailable.')
      }

      if (action.kind === 'APPROVE') {
        return reelService.approveReel(reel.reelId, {
          reason: values.reason,
        })
      }

      if (!values.reason) {
        throw new Error('Reason is required for this reel action.')
      }

      if (action.kind === 'REJECT') {
        return reelService.rejectReel(reel.reelId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REQUEST_EDIT') {
        return reelService.requestReelEdit(reel.reelId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'PAUSE') {
        return reelService.pauseReel(reel.reelId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'SOFT_DELETE' || action.kind === 'HARD_DELETE') {
        return reelService.deleteReel(reel.reelId, {
          hardDelete: action.kind === 'HARD_DELETE',
          reason: values.reason,
        })
      }

      return reelService.removeReel(reel.reelId, {
        reason: values.reason,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: (_response, variables) => {
      setSelectedAction(null)

      if (
        variables.action.kind === 'SOFT_DELETE' ||
        variables.action.kind === 'HARD_DELETE'
      ) {
        void queryClient.invalidateQueries({ queryKey: ['reels'] })
        queryClient.removeQueries({ queryKey: ['reel-detail', reelId] })
        navigate(routePaths.reels)
        return
      }

      void refreshReel()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Reel action failed.',
      )
    },
  })

  const openAction = (kind: ReelActionKind) => {
    if (!reel) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, reel })
  }

  const submitAction = (values: ReelActionFormValues) => {
    if (!selectedAction) {
      return
    }

    void actionMutation.mutateAsync({
      action: selectedAction,
      values,
    })
  }

  if (!reelId) {
    return (
      <PageContainer>
        <ErrorState
          description="The reel route is missing a reel id."
          title="Reel not found"
        />
      </PageContainer>
    )
  }

  if (reelQuery.isLoading) {
    return (
      <PageContainer>
        <DetailPageHeaderSkeleton />
        <Skeleton className="h-[28rem] w-full" />
      </PageContainer>
    )
  }

  if (reelQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this reel. Please retry."
          title="Reel unavailable"
          onRetry={() => void reelQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!reel) {
    return (
      <PageContainer>
        <EmptyState
          description="The reel detail API returned no reel data."
          title="Reel not found"
        />
      </PageContainer>
    )
  }

  const detailMetrics = buildReelDetailMetrics(reel, {
    canDeleteReels,
    canModerateReels,
  })

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <ReelHeaderActions
            canDeleteReels={canDeleteReels}
            canModerateReels={canModerateReels}
            isRefreshing={reelQuery.isFetching}
            isSubmitting={actionMutation.isPending}
            reel={reel}
            onRefresh={() => void reelQuery.refetch()}
            onSelectAction={openAction}
          />
        }
        description={reel.caption ?? reel.publicReelId}
        listHref={routePaths.reels}
        listLabel="Reels"
        recordName={reel.publicReelId}
        titleMetaNode={<ReelHeaderStatus reel={reel} />}
      />

      <ReelDetailSectionNav
        activeTab={activeTab}
        reel={reel}
        reelId={reelId as string}
      />

      <RecordMetricStrip
        ariaLabel="Reel summary"
        metrics={detailMetrics.map((metric) => ({
          label: metric.label,
          value: metric.value,
          tone: metric.tone === 'warning' || metric.tone === 'danger' || metric.tone === 'success' ? metric.tone : undefined,
        }))}
      />

      {activeTab === 'overview' ? (
      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Core content, identity, and lifecycle timestamps."
          icon={<Film className="size-4" />}
          title="Reel information"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Reel ID" value={reel.reelId} />
            <DetailField label="Public Reel ID" value={reel.publicReelId} />
            <DetailField
              label="Creation Type"
              value={humanizeCode(reel.relation?.type ?? 'ORIGINAL')}
            />
            {reel.relation?.parentReelId ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase text-muted">
                  Parent Reel
                </p>
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-3 py-2 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() =>
                    navigate(`${routePaths.reels}/${reel.relation?.parentReelId}`)
                  }
                  type="button"
                >
                  {reel.relation.parentReelId}
                  <ArrowUpRight className="size-4 shrink-0" />
                </button>
              </div>
            ) : (
              <DetailField label="Parent Reel" value="Not applicable" />
            )}
            <DetailField
              label="Original Vendor ID"
              value={reel.relation?.originalVendorId}
            />
            <DetailField
              label="Attributed Influencer Customer ID"
              value={reel.relation?.attributedInfluencerCustomerId}
            />
            <DetailField label="Content Type" value={humanizeCode(reel.contentType)} />
            <DetailField label="Caption" value={reel.caption} />
            <DetailField label="Price Indicator" value={reel.priceIndicator} />
            <DetailField
              label="Missing Fields"
              value={reel.missingFields.length ? reel.missingFields.join(', ') : null}
            />
            <DetailField label="Created" value={formatDateSafe(reel.createdAt)} />
            <DetailField label="Updated" value={formatDateSafe(reel.updatedAt)} />
          </div>
        </SectionShell>

        <div className="space-y-3">
          <RelatedRecordsPanel
            canReadInfluencers={canReadInfluencers}
            canReadVendors={canReadVendors}
            id={reelDetailSectionIds.related}
            reel={reel}
            onNavigate={navigate}
          />
          <OperationalSignalsPanel
            canDeleteReels={canDeleteReels}
            canModerateReels={canModerateReels}
            id={reelDetailSectionIds.signals}
            reel={reel}
          />
        </div>
      </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        {activeTab === 'media' ? (
        <ReelMediaPanel id={reelDetailSectionIds.media} reel={reel} />
        ) : null}

        {activeTab === 'moderation' ? (
        <SectionShell
          description="Review decision state and customer visibility."
          id={reelDetailSectionIds.moderation}
          icon={<ShieldCheck className="size-4" />}
          title="Moderation & publish"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Moderation Status"
              value={humanizeCode(reel.moderation.status)}
            />
            <DetailField
              label="Rejection Reason"
              value={reel.moderation.rejectionReason}
            />
            <DetailField
              label="Approved By Admin ID"
              value={reel.moderation.approvedByAdminId}
            />
            <DetailField
              label="Approved At"
              value={formatDateSafe(reel.moderation.approvedAt)}
            />
            <DetailField label="Published" value={reel.publish.isPublished} />
            <DetailField
              label="Published At"
              value={formatDateSafe(reel.publish.publishedAt)}
            />
            <DetailField
              label="Customer Visibility"
              value={humanizeCode(reel.publish.customerVisibility)}
            />
          </div>
        </SectionShell>
        ) : null}
      </section>

      {activeTab === 'context' ? (
      <SectionShell
        description="Vendor, zone, and category context used by moderation and customer discovery."
        id={reelDetailSectionIds.context}
        icon={<Store className="size-4" />}
        title="Service context"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Shop" value={reel.vendor.shopName} />
          <DetailField label="Owner" value={reel.vendor.ownerName} />
          <DetailField label="Mobile" value={reel.vendor.mobileNumber} />
          <DetailField label="Vendor ID" value={reel.vendor.vendorId} />
          <DetailField label="Public Vendor ID" value={reel.vendor.publicVendorId} />
          <DetailField
            label="Uploader"
            value={humanizeCode(reel.uploaderType ?? 'VENDOR')}
          />
          <DetailField
            label="Influencer"
            value={reel.influencer?.displayName}
          />
          <DetailField
            label="Vendor Status"
            value={humanizeCode(reel.vendor.vendorStatus)}
          />
          <DetailField
            label="Onboarding Status"
            value={humanizeCode(reel.vendor.onboardingStatus)}
          />
          <DetailField label="City" value={reel.vendor.city} />
          <DetailField label="Zone" value={reel.vendor.zone?.zoneName} />
          <DetailField label="Zone City" value={reel.vendor.zone?.city} />
          <DetailField label="Category" value={reel.category?.name} />
          <DetailField label="Category Code" value={reel.category?.categoryCode} />
          <DetailField label="Category Active" value={reel.category?.isActive} />
        </div>
      </SectionShell>
      ) : null}

      {activeTab === 'checklist' ? (
      <div className="scroll-mt-24" id={reelDetailSectionIds.checklist}>
        <DynamicTable
          bodyMaxHeight={360}
          columns={checklistColumns}
          data={reel.reviewChecklist}
          emptyDescription="No review checklist items were returned for this reel."
          emptyTitle="No checklist"
          getRowId={(row) => row.code}
          stickyHeader
          title="Review Checklist"
        />
      </div>
      ) : null}

      <ReelActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={selectedAction ? `${selectedAction.kind}-${reel.reelId}` : 'closed'}
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={submitAction}
      />
    </PageContainer>
  )
}
