import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  ExternalLink,
  Film,
  ImageIcon,
  PauseCircle,
  PencilLine,
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
import { Skeleton } from '../../../components/ui/Skeleton'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
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
  action: string
  canDeleteReels: boolean
  canModerateReels: boolean
}) {
  if (!isReelActionKind(action)) return false

  if (action === 'SOFT_DELETE' || action === 'HARD_DELETE') {
    return canDeleteReels
  }

  return canModerateReels
}

function DetailMetricCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: ReelTone
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold uppercase tracking-normal ${toneClasses(tone)}`}>
          {label}
        </p>
        <span className={toneClasses(tone)}>{icon}</span>
      </div>
      <p className={`mt-3 text-xl font-semibold tracking-normal ${toneClasses(tone)}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
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

function buildReelDetailMetrics(reel: AdminReel) {
  const riskCount =
    reel.warnings.length + reel.blockingReasons.length + reel.missingFields.length

  return [
    {
      label: 'Moderation',
      value: humanizeCode(reel.moderation.status),
      meta: reel.nextRecommendedAction
        ? `Next: ${humanizeCode(reel.nextRecommendedAction)}`
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

function ReelHeaderStatus({ reel }: { reel: AdminReel }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={getModerationStatusTone(reel.moderation.status)}>
        {reel.moderation.status}
      </Badge>
      <Badge tone={getUploadStatusTone(reel.media.uploadStatus)}>
        {reel.media.uploadStatus}
      </Badge>
      <Badge tone={reel.publish.customerVisibility === 'VISIBLE' ? 'success' : 'neutral'}>
        {reel.publish.customerVisibility}
      </Badge>
    </div>
  )
}

function ReelHeaderActions({
  canDeleteReels,
  canModerateReels,
  isSubmitting,
  onSelectAction,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  isSubmitting: boolean
  onSelectAction: (kind: ReelActionKind) => void
  reel: AdminReel
}) {
  const hasAction = (action: ReelActionKind) =>
    reel.availableActions.includes(action) &&
    canRunReelAction({ action, canDeleteReels, canModerateReels })

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {hasAction('APPROVE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          onClick={() => onSelectAction('APPROVE')}
        >
          <CheckCircle2 className="mr-2 size-4" />
          Approve
        </Button>
      ) : null}
      {hasAction('REJECT') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('REJECT')}
        >
          <XCircle className="mr-2 size-4" />
          Reject
        </Button>
      ) : null}
      {hasAction('REQUEST_EDIT') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('REQUEST_EDIT')}
        >
          <PencilLine className="mr-2 size-4" />
          Request Edit
        </Button>
      ) : null}
      {hasAction('PAUSE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="secondary"
          onClick={() => onSelectAction('PAUSE')}
        >
          <PauseCircle className="mr-2 size-4" />
          Pause
        </Button>
      ) : null}
      {hasAction('REMOVE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('REMOVE')}
        >
          <Trash2 className="mr-2 size-4" />
          Remove
        </Button>
      ) : null}
      {canDeleteReels && hasAction('SOFT_DELETE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('SOFT_DELETE')}
        >
          <Trash2 className="mr-2 size-4" />
          Soft Delete
        </Button>
      ) : null}
      {canDeleteReels && hasAction('HARD_DELETE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('HARD_DELETE')}
        >
          <Trash2 className="mr-2 size-4" />
          Hard Delete
        </Button>
      ) : null}
    </div>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{meta}</p>
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
  onNavigate,
  reel,
}: {
  canReadInfluencers: boolean
  canReadVendors: boolean
  onNavigate: (path: string) => void
  reel: AdminReel
}) {
  const canOpenPlayback = isOpenableUrl(reel.media.playbackUrl)
  const reelQueueView = reel.publish.customerVisibility === 'VISIBLE' ? 'live' : 'pending'

  return (
    <SectionShell
      description="Primary operational records attached to this reel."
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
              window.open(reel.media.playbackUrl as string, '_blank', 'noreferrer')
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
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  reel: AdminReel
}) {
  const permittedActions = reel.availableActions.filter((action) =>
    canRunReelAction({ action, canDeleteReels, canModerateReels }),
  )

  return (
    <SectionShell
      description="Backend workflow signals and actions permitted for this admin."
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
          value={humanizeCode(reel.nextRecommendedAction)}
        />
      </div>
    </SectionShell>
  )
}

function ReelMediaPanel({ reel }: { reel: AdminReel }) {
  const hasThumbnail = isOpenableUrl(reel.media.thumbnailUrl)
  const hasPlayback = isOpenableUrl(reel.media.playbackUrl)

  return (
    <SectionShell
      actionNode={
        hasPlayback ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() =>
              window.open(reel.media.playbackUrl as string, '_blank', 'noreferrer')
            }
          >
            <ArrowUpRight className="mr-2 size-4" />
            Playback
          </Button>
        ) : null
      }
      description="Cloudflare Stream state and media URLs for review."
      icon={<Video className="size-4" />}
      title="Media"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.75fr)]">
        <div className="overflow-hidden rounded-[0.875rem] border border-border bg-surface-muted/40">
          <div className="flex aspect-video items-center justify-center">
            {hasThumbnail ? (
              <img
                alt={`Thumbnail for ${reel.publicReelId}`}
                className="h-full w-full object-cover"
                src={reel.media.thumbnailUrl as string}
              />
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
  const { reelId } = useParams()
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
        <Skeleton className="h-12 w-full" />
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

  const detailMetrics = buildReelDetailMetrics(reel)

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <ReelHeaderActions
            canDeleteReels={canDeleteReels}
            canModerateReels={canModerateReels}
            isSubmitting={actionMutation.isPending}
            reel={reel}
            onSelectAction={openAction}
          />
        }
        description={reel.caption ?? reel.publicReelId}
        listHref={routePaths.reels}
        listLabel="Reels"
        recordName={reel.publicReelId}
        titleMetaNode={<ReelHeaderStatus reel={reel} />}
      />

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {detailMetrics.map((metric) => (
          <DetailMetricCard
            icon={metric.icon}
            key={metric.label}
            label={metric.label}
            meta={metric.meta}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
      </section>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Core content, identity, and lifecycle timestamps."
          icon={<Film className="size-4" />}
          title="Reel information"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Reel ID" value={reel.reelId} />
            <DetailField label="Public Reel ID" value={reel.publicReelId} />
            <DetailField label="Content Type" value={humanizeCode(reel.contentType)} />
            <DetailField label="Caption" value={reel.caption} />
            <DetailField label="Price Indicator" value={reel.priceIndicator} />
            <DetailField
              label="Missing Fields"
              value={reel.missingFields.length ? reel.missingFields.join(', ') : null}
            />
            <DetailField label="Created At" value={formatDateSafe(reel.createdAt)} />
            <DetailField label="Updated At" value={formatDateSafe(reel.updatedAt)} />
          </div>
        </SectionShell>

        <div className="space-y-3">
          <RelatedRecordsPanel
            canReadInfluencers={canReadInfluencers}
            canReadVendors={canReadVendors}
            reel={reel}
            onNavigate={navigate}
          />
          <OperationalSignalsPanel
            canDeleteReels={canDeleteReels}
            canModerateReels={canModerateReels}
            reel={reel}
          />
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <ReelMediaPanel reel={reel} />

        <SectionShell
          description="Review decision state and customer visibility."
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
      </section>

      <SectionShell
        description="Vendor, zone, and category context used by moderation and customer discovery."
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

      <DynamicTable
        bodyMaxHeight={360}
        columns={checklistColumns}
        data={reel.reviewChecklist}
        emptyDescription="No review checklist items were returned for this reel."
        emptyTitle="No checklist"
        getRowId={(row) => row.code}
        title="Review Checklist"
      />

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
