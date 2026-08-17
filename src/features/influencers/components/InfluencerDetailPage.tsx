import {
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Film,
  HandCoins,
  ReceiptText,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  Store,
  TriangleAlert,
  UserRound,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { OverflowText } from '../../../components/ui/OverflowText'
import { Skeleton } from '../../../components/ui/Skeleton'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import {
  RecordHeaderActions,
  RecordTabs,
  type RecordAction,
  type RecordTabItem,
} from '../../../components/ui/RecordPage'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { influencerService } from '../services/influencer.service'
import {
  InfluencerActionModal,
  type InfluencerActionFormValues,
  type InfluencerActionSelection,
} from './InfluencerActionModal'
import type {
  AdminInfluencer,
  AdminInfluencerCommission,
  AdminInfluencerDetail,
  AdminInfluencerPreferredCategory,
  AdminInfluencerReel,
  InfluencerSocialProfile,
  InfluencerActionKind,
  InfluencerStatus,
} from '../types/influencer.types'

type InfluencerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'
type PreferredCategoryDisplay = Pick<
  AdminInfluencerPreferredCategory,
  'categoryCode' | 'categoryId' | 'name'
>

const influencerActionKinds: InfluencerActionKind[] = [
  'APPROVE',
  'REJECT',
  'SUSPEND',
  'REACTIVATE',
]

const influencerDetailSectionIds = {
  overview: 'influencer-overview',
  profile: 'influencer-profile',
  application: 'influencer-application',
  reels: 'influencer-reels',
  commission: 'influencer-commission',
  related: 'influencer-related',
  signals: 'influencer-signals',
} as const

function statusTone(status: InfluencerStatus | string): InfluencerTone {
  if (status === 'APPROVED' || status === 'CONFIRMED' || status === 'READY') {
    return 'success'
  }
  if (
    status === 'PENDING_REVIEW' ||
    status === 'PENDING' ||
    status === 'HELD' ||
    status === 'PROCESSING'
  ) {
    return 'warning'
  }
  if (
    status === 'REJECTED' ||
    status === 'SUSPENDED' ||
    status === 'CANCELLED' ||
    status === 'FAILED'
  ) {
    return 'danger'
  }
  return 'neutral'
}

function toneTextClasses(tone: InfluencerTone) {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function metricToneClasses(tone: InfluencerTone) {
  if (tone === 'success') return 'border-success/20 bg-success/5'
  if (tone === 'warning') return 'border-warning/25 bg-warning/5'
  if (tone === 'danger') return 'border-danger/20 bg-danger/5'
  if (tone === 'info') return 'border-primary/20 bg-primary/5'
  return 'border-border bg-surface'
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatPaise(amountPaise: number, currency = 'INR') {
  return formatMoney(amountPaise / 100, currency)
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'

  try {
    return formatDate(value, true)
  } catch {
    return value
  }
}

function routeWithFilters(path: string, filters: Record<string, string | undefined>) {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })

  const query = params.toString()

  return query ? `${path}?${query}` : path
}

function uniqueNonEmpty(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

function addPreferredCategory(
  categoriesById: Map<string, PreferredCategoryDisplay>,
  category: AdminInfluencerPreferredCategory | null | undefined,
) {
  if (!category?.categoryId || !category.name) return

  categoriesById.set(category.categoryId, {
    categoryCode: category.categoryCode,
    categoryId: category.categoryId,
    name: category.name,
  })
}

function buildPreferredCategoryMap({
  influencer,
}: {
  influencer: AdminInfluencer
}) {
  const categoriesById = new Map<string, PreferredCategoryDisplay>()

  influencer.preferredCategories?.forEach((category) =>
    addPreferredCategory(categoriesById, category),
  )
  influencer.application?.preferredCategories?.forEach((category) =>
    addPreferredCategory(categoriesById, category),
  )

  return categoriesById
}

function fallbackCategoryLabel(categoryId: string) {
  return categoryId.length > 12 ? `${categoryId.slice(0, 8)}...` : categoryId
}

function socialHandleUrl(handle: string | null | undefined) {
  const trimmed = handle?.trim()

  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^(www\.)?instagram\.com\//i.test(trimmed)) {
    return `https://${trimmed.replace(/^https?:\/\//i, '')}`
  }

  const normalized = trimmed
    .replace(/^@/, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^\/+|\/+$/g, '')

  return normalized
    ? `https://www.instagram.com/${encodeURIComponent(normalized)}`
    : null
}

function socialPlatformLabel(platform: InfluencerSocialProfile['platform']) {
  if (platform === 'INSTAGRAM') return 'Instagram'
  if (platform === 'YOUTUBE') return 'YouTube'
  if (platform === 'FACEBOOK') return 'Facebook'
  return 'X'
}

function formatFollowerCount(value: number | null | undefined) {
  if (typeof value !== 'number') return null

  return new Intl.NumberFormat('en-IN', {
    notation: value >= 100000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function isInfluencerActionKind(action: string): action is InfluencerActionKind {
  return influencerActionKinds.includes(action as InfluencerActionKind)
}

function canRunInfluencerAction({
  action,
  canReviewInfluencers,
}: {
  action: string
  canReviewInfluencers: boolean
}) {
  return isInfluencerActionKind(action) && canReviewInfluencers
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function DetailNodeField({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <div className="break-words text-sm text-foreground">{children}</div>
    </div>
  )
}

function SocialHandleLink({
  handle,
}: {
  handle: string | null | undefined
}) {
  const url = socialHandleUrl(handle)

  if (!handle) {
    return <span>Not available</span>
  }

  if (!url) {
    return <span>{handle}</span>
  }

  return (
    <a
      className="inline-flex max-w-full items-center gap-1.5 break-all font-medium text-primary transition hover:underline"
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      <span>{handle}</span>
      <ArrowUpRight className="size-3.5 shrink-0" />
    </a>
  )
}

function SocialProfilesList({
  fallbackHandle,
  profiles,
}: {
  fallbackHandle?: string | null
  profiles?: InfluencerSocialProfile[]
}) {
  if (!profiles?.length) {
    return <SocialHandleLink handle={fallbackHandle} />
  }

  return (
    <div className="flex flex-col gap-2">
      {profiles.map((profile) => {
        const followerCount = formatFollowerCount(profile.followerCount)

        return (
          <a
            className="inline-flex max-w-full items-center justify-between gap-3 rounded-[0.75rem] border border-border bg-surface-muted/45 px-3 py-2 text-left transition hover:border-primary/40 hover:text-primary"
            href={profile.profileUrl}
            key={`${profile.platform}-${profile.profileUrl}`}
            rel="noreferrer"
            target="_blank"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {socialPlatformLabel(profile.platform)}
              </span>
              <OverflowText
                className="block text-xs text-muted"
                title={`${profile.handle ?? profile.profileUrl}${
                  followerCount ? ` / ${followerCount} followers` : ''
                }`}
              >
                {profile.handle ?? profile.profileUrl}
                {followerCount ? ` · ${followerCount} followers` : ''}
              </OverflowText>
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-primary" />
          </a>
        )
      })}
    </div>
  )
}

function PreferredCategoryLinks({
  canReadSettings,
  categoryIds,
  categoriesById,
  onNavigate,
}: {
  canReadSettings: boolean
  categoryIds: string[]
  categoriesById: Map<string, PreferredCategoryDisplay>
  onNavigate: (path: string) => void
}) {
  const visibleCategoryIds = uniqueNonEmpty(categoryIds)

  if (!visibleCategoryIds.length) {
    return <span>Not available</span>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visibleCategoryIds.map((categoryId) => {
        const category = categoriesById.get(categoryId)
        const label = category?.name ?? fallbackCategoryLabel(categoryId)
        const path = canReadSettings
          ? `${routePaths.settings}/categories/${encodeURIComponent(categoryId)}`
          : routeWithFilters(routePaths.influencers, {
              categoryId,
              categoryLabel: category?.name,
            })

        return (
          <button
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-muted/50 px-2.5 py-1 text-left text-xs font-semibold text-foreground transition hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={categoryId}
            title={category ? `${category.name} · ${category.categoryCode}` : categoryId}
            type="button"
            onClick={() => onNavigate(path)}
          >
            <span className="truncate">{label}</span>
            {category?.categoryCode ? (
              <span className="text-muted">{category.categoryCode}</span>
            ) : null}
            <ArrowUpRight className="size-3 shrink-0 text-muted" />
          </button>
        )
      })}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: InfluencerTone
  value: string | number
}) {
  return (
    <div
      className={cn(
        'min-h-[4.35rem] rounded-[0.75rem] border px-3 py-2.5 shadow-surface',
        metricToneClasses(tone),
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className={cn(
            'text-xs font-semibold uppercase tracking-normal',
            toneTextClasses(tone),
          )}
        >
          {label}
        </p>
        <span className={toneTextClasses(tone)}>{icon}</span>
      </div>
      <OverflowText
        as="p"
        className={cn(
          'mt-2 text-xl font-semibold tracking-normal',
          toneTextClasses(tone),
        )}
        title={String(value)}
      >
        {value}
      </OverflowText>
      <OverflowText as="p" className="mt-1 text-xs text-muted" title={meta}>
        {meta}
      </OverflowText>
    </div>
  )
}

function InfluencerHeaderStatus({
  influencer,
}: {
  influencer: AdminInfluencer
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={statusTone(influencer.status)}>
        {humanizeCode(influencer.status)}
      </Badge>
      {influencer.status === 'APPROVED' ? (
        <Badge tone="success">Approved creator</Badge>
      ) : null}
      {influencer.application ? (
        <Badge tone={statusTone(influencer.application.status)}>
          Application {humanizeCode(influencer.application.status)}
        </Badge>
      ) : null}
    </div>
  )
}

const reelColumns: DynamicTableColumn<AdminInfluencerReel>[] = [
  {
    key: 'publicReelId',
    label: 'Reel',
    minWidth: 240,
    renderCell: (row) => (
      <div>
        <p className="font-semibold text-foreground">{row.publicReelId}</p>
        <p className="line-clamp-1 text-xs text-muted">
          {row.caption ?? 'No caption'}
        </p>
      </div>
    ),
  },
  {
    key: 'taggedVendor',
    label: 'Tagged Vendor',
    minWidth: 220,
    getValue: (row) => row.taggedVendor.shopName,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.taggedVendor.shopName}</p>
        <p className="text-xs text-muted">
          {row.taggedVendor.city ?? row.taggedVendor.publicVendorId}
        </p>
      </div>
    ),
  },
  {
    key: 'uploadStatus',
    label: 'Upload',
    format: 'status',
    statusTone: (value) => statusTone(String(value)),
    getValue: (row) => row.media.uploadStatus,
    minWidth: 140,
  },
  {
    key: 'moderationStatus',
    label: 'Moderation',
    format: 'status',
    statusTone: (value) => statusTone(String(value)),
    getValue: (row) => row.moderation.status,
    minWidth: 160,
  },
  {
    key: 'published',
    label: 'Published',
    format: 'status',
    statusTone: (value) => (value === 'LIVE' ? 'success' : 'neutral'),
    getValue: (row) => (row.publish.isPublished ? 'LIVE' : 'HIDDEN'),
    minWidth: 130,
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

const commissionColumns: DynamicTableColumn<AdminInfluencerCommission>[] = [
  {
    key: 'publicOrderId',
    label: 'Order',
    minWidth: 180,
    renderCell: (row) => (
      <div>
        <p className="font-semibold text-foreground">{row.publicOrderId}</p>
        <p className="text-xs text-muted">{row.publicReelId}</p>
      </div>
    ),
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 220,
    getValue: (row) => row.vendor.shopName,
  },
  {
    key: 'grossAmountPaise',
    label: 'Gross',
    align: 'right',
    minWidth: 140,
    renderCell: (row) => formatPaise(row.grossAmountPaise, row.currency),
  },
  {
    key: 'commissionAmountPaise',
    label: 'Commission',
    align: 'right',
    minWidth: 150,
    renderCell: (row) => formatPaise(row.commissionAmountPaise, row.currency),
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) => statusTone(String(value)),
    minWidth: 140,
  },
  {
    key: 'createdAt',
    label: 'Created',
    format: 'date',
    minWidth: 180,
  },
]

function InfluencerHeaderActions({
  canReviewInfluencers,
  influencer,
  isRefreshing,
  isSubmitting,
  onRefresh,
  onSelectAction,
}: {
  canReviewInfluencers: boolean
  influencer: AdminInfluencer
  isRefreshing: boolean
  isSubmitting: boolean
  onRefresh: () => void
  onSelectAction: (kind: InfluencerActionKind) => void
}) {
  const hasAction = (kind: InfluencerActionKind) =>
    influencer.availableActions.includes(kind) &&
    canRunInfluencerAction({ action: kind, canReviewInfluencers })

  const build = (
    kind: InfluencerActionKind,
    label: string,
    icon: ReactNode,
    intent: RecordAction['intent'],
  ): RecordAction | null =>
    hasAction(kind)
      ? { key: kind, label, icon, intent, onSelect: () => onSelectAction(kind) }
      : null

  const actions = [
    build('APPROVE', 'Approve', <CheckCircle2 className="size-4" />, 'primary'),
    build('REACTIVATE', 'Reactivate', <RotateCcw className="size-4" />, 'primary'),
    build('SUSPEND', 'Suspend', <PauseCircle className="size-4" />, 'destructive'),
    build('REJECT', 'Reject', <XCircle className="size-4" />, 'destructive'),
  ].filter(Boolean) as RecordAction[]

  return (
    <RecordHeaderActions
      actions={actions}
      disabled={isSubmitting}
      utility={
        <Button
          aria-label={isRefreshing ? 'Refreshing influencer' : 'Refresh influencer'}
          size="sm"
          title={isRefreshing ? 'Refreshing influencer' : 'Refresh influencer'}
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

export type InfluencerDetailTab =
  | 'overview'
  | 'profile'
  | 'application'
  | 'reels'
  | 'commission'

const INFLUENCER_DETAIL_TABS: InfluencerDetailTab[] = [
  'overview',
  'profile',
  'application',
  'reels',
  'commission',
]

function InfluencerDetailSectionNav({
  activeTab,
  influencer,
  profileId,
}: {
  activeTab: InfluencerDetailTab
  influencer: AdminInfluencerDetail
  profileId: string
}) {
  const items: RecordTabItem[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'profile', label: 'Profile' },
    { key: 'application', label: 'Application' },
    { key: 'reels', label: 'Reels', count: influencer.reels.length },
    {
      key: 'commission',
      label: 'Commission',
      count: influencer.commissions.length,
    },
  ]

  return (
    <RecordTabs
      activeTab={activeTab}
      ariaLabel="Influencer detail sections"
      basePath={`${routePaths.influencers}/${profileId}`}
      tabPrefix="/tab"
      defaultTab="overview"
      items={items}
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
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              {title}
            </h2>
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
  canReadCustomers,
  canReadOrders,
  canReadReels,
  id,
  influencer,
  onNavigate,
}: {
  canReadCustomers: boolean
  canReadOrders: boolean
  canReadReels: boolean
  id?: string
  influencer: AdminInfluencer
  onNavigate: (path: string) => void
}) {
  const reelQueueView =
    influencer.summary.pendingReelCount > 0 ? 'pending' : 'live'

  return (
    <SectionShell
      description="Primary records connected to this creator profile."
      id={id}
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          canOpen={canReadCustomers}
          icon={<UserRound className="size-4" />}
          label="Customer"
          meta={influencer.customer.mobileNumber ?? influencer.customer.email ?? influencer.customer.status}
          value={influencer.customer.fullName ?? influencer.publicInfluencerId}
          onOpen={() => onNavigate(`${routePaths.customers}/${influencer.customer.customerId}`)}
        />
        <RelatedRecordRow
          actionLabel="Reels"
          canOpen={canReadReels}
          icon={<Film className="size-4" />}
          label="Creator reels"
          meta={`${influencer.summary.liveReelCount} live · ${influencer.summary.pendingReelCount} pending`}
          value={`${influencer.summary.reelCount} reels`}
          onOpen={() =>
            onNavigate(
              routeWithFilters(routePaths.reels, {
                search: influencer.publicInfluencerId,
                view: reelQueueView,
              }),
            )
          }
        />
        <RelatedRecordRow
          actionLabel="Ledger"
          canOpen={false}
          icon={<ReceiptText className="size-4" />}
          label="Attributed bookings"
          meta={
            canReadOrders
              ? 'Open individual orders from the commission ledger below'
              : `${formatPaise(influencer.summary.confirmedCommissionPaise)} confirmed commission`
          }
          value={`${influencer.summary.attributedBookingCount} bookings`}
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
  tone: InfluencerTone
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
  canReviewInfluencers,
  id,
  influencer,
}: {
  canReviewInfluencers: boolean
  id?: string
  influencer: AdminInfluencer
}) {
  const permittedActions = influencer.availableActions.filter((action) =>
    canRunInfluencerAction({ action, canReviewInfluencers }),
  )
  const permittedRecommendedAction =
    influencer.nextRecommendedAction &&
    canRunInfluencerAction({
      action: influencer.nextRecommendedAction,
      canReviewInfluencers,
    })
      ? influencer.nextRecommendedAction
      : null

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
            items={influencer.warnings}
            tone="warning"
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
            permittedRecommendedAction
              ? humanizeCode(permittedRecommendedAction)
              : null
          }
        />
      </div>
    </SectionShell>
  )
}

function LifecyclePanel({ influencer }: { influencer: AdminInfluencer }) {
  return (
    <SectionShell
      description="Creator profile lifecycle timestamps and ledger activity."
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Created" value={formatDateSafe(influencer.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(influencer.updatedAt)} />
        <DetailField label="Approved at" value={formatDateSafe(influencer.approvedAt)} />
        <DetailField
          label="Last commission"
          value={formatDateSafe(influencer.summary.lastCommissionAt)}
        />
      </div>
    </SectionShell>
  )
}

export function InfluencerDetailPage() {
  const { profileId, tab: tabParam } = useParams()
  const activeTab: InfluencerDetailTab = INFLUENCER_DETAIL_TABS.includes(
    tabParam as InfluencerDetailTab,
  )
    ? (tabParam as InfluencerDetailTab)
    : 'overview' 
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReadOrders = usePermission('orders:read')
  const canReadReels = usePermission('reels:read')
  const canReadVendors = usePermission('vendors:read')
  const canReadSettings = usePermission('settings:read')
  const canReviewInfluencers = usePermission('influencers:review')
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] =
    useState<InfluencerActionSelection | null>(null)

  const influencerQuery = useQuery({
    enabled: Boolean(profileId),
    queryKey: ['influencer-detail', profileId],
    queryFn: () => influencerService.getInfluencerById(profileId as string),
  })

  const influencer = influencerQuery.data?.data

  const refreshInfluencer = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['influencer-detail', profileId],
      }),
      queryClient.invalidateQueries({ queryKey: ['influencers'] }),
    ])
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: InfluencerActionSelection
      values: InfluencerActionFormValues
    }) => {
      if (!influencer) {
        throw new Error('Influencer details are unavailable.')
      }

      if (action.kind === 'APPROVE') {
        return influencerService.approveInfluencer(
          influencer.influencerProfileId,
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
          influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      if (action.kind === 'SUSPEND') {
        return influencerService.suspendInfluencer(
          influencer.influencerProfileId,
          { reason: values.reason },
        )
      }

      return influencerService.reactivateInfluencer(
        influencer.influencerProfileId,
        { reason: values.reason },
      )
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void refreshInfluencer()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Influencer action could not be completed.',
      )
    },
  })

  if (!profileId) {
    return (
      <PageContainer>
        <ErrorState
          title="Influencer not found"
          description="The route is missing an influencer profile id."
        />
      </PageContainer>
    )
  }

  if (influencerQuery.isLoading) {
    return (
      <PageContainer>
        <DetailPageHeaderSkeleton />
        <div className="grid gap-4 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </PageContainer>
    )
  }

  if (influencerQuery.isError || !influencer) {
    return (
      <PageContainer>
        <ErrorState
          title="Influencer unavailable"
          description="We could not load this creator profile."
          onRetry={() => void influencerQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const applicationReason =
    influencer.application?.reviewReason ??
    influencer.rejectionReason ??
    influencer.suspensionReason
  const creatorReelsPath = routeWithFilters(routePaths.reels, {
    search: influencer.publicInfluencerId,
    view: influencer.summary.pendingReelCount > 0 ? 'pending' : 'live',
  })
  const preferredCategoriesById = buildPreferredCategoryMap({
    influencer,
  })

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <InfluencerHeaderActions
            canReviewInfluencers={canReviewInfluencers}
            influencer={influencer}
            isRefreshing={influencerQuery.isFetching}
            isSubmitting={actionMutation.isPending}
            onRefresh={() => void influencerQuery.refetch()}
            onSelectAction={(kind) =>
              setSelectedAction({ kind, influencer })
            }
          />
        }
        description={`${influencer.publicInfluencerId} · ${
          influencer.customer.fullName ?? influencer.customer.mobileNumber ?? 'Customer'
        }`}
        listHref={routePaths.influencers}
        listLabel="Influencers"
        recordName={influencer.displayName}
        titleMetaNode={<InfluencerHeaderStatus influencer={influencer} />}
      />

      <InfluencerDetailSectionNav
        activeTab={activeTab}
        influencer={influencer}
        profileId={profileId as string}
      />

      {activeTab === 'overview' ? (
      <div
        className="grid scroll-mt-24 gap-2.5 md:grid-cols-2 xl:grid-cols-4"
        id={influencerDetailSectionIds.overview}
      >
        <MetricCard
          icon={<Film className="size-4" />}
          label="Total reels"
          meta={`${influencer.summary.pendingReelCount} pending moderation`}
          tone={influencer.summary.reelCount > 0 ? 'info' : 'neutral'}
          value={influencer.summary.reelCount}
        />
        <MetricCard
          icon={<BadgeCheck className="size-4" />}
          label="Live reels"
          meta="Visible creator content"
          tone={influencer.summary.liveReelCount > 0 ? 'success' : 'neutral'}
          value={influencer.summary.liveReelCount}
        />
        <MetricCard
          icon={<ReceiptText className="size-4" />}
          label="Attributed bookings"
          meta="Orders connected to creator reels"
          tone={
            influencer.summary.attributedBookingCount > 0 ? 'info' : 'neutral'
          }
          value={influencer.summary.attributedBookingCount}
        />
        <MetricCard
          icon={<CircleDollarSign className="size-4" />}
          label="Confirmed commission"
          meta={`Pending ${formatPaise(influencer.summary.pendingCommissionPaise)}`}
          tone={
            influencer.summary.confirmedCommissionPaise > 0
              ? 'success'
              : 'neutral'
          }
          value={formatPaise(influencer.summary.confirmedCommissionPaise)}
        />
      </div>
      ) : null}

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          {activeTab === 'overview' ? <LifecyclePanel influencer={influencer} /> : null}

          <section className="grid gap-3 2xl:grid-cols-[1.15fr_0.85fr]">
            {activeTab === 'profile' ? (
            <SectionShell
              description="Customer identity stays active while creator capabilities are managed here."
              id={influencerDetailSectionIds.profile}
              icon={<BadgeCheck className="size-4" />}
              title="Creator profile"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <DetailField label="Display name" value={influencer.displayName} />
                <DetailNodeField label="Social profiles">
                  <SocialProfilesList
                    fallbackHandle={influencer.socialHandle}
                    profiles={influencer.socialProfiles}
                  />
                </DetailNodeField>
                <DetailField
                  label="Customer status"
                  value={humanizeCode(influencer.customer.status)}
                />
                <DetailField
                  label="City"
                  value={influencer.customer.zone?.zoneName ?? influencer.customer.city}
                />
                <DetailField label="Mobile" value={influencer.customer.mobileNumber} />
                <DetailField label="Email" value={influencer.customer.email} />
                <DetailField
                  label="Approved at"
                  value={formatDateSafe(influencer.approvedAt)}
                />
                <DetailField
                  label="Last commission"
                  value={formatDateSafe(influencer.summary.lastCommissionAt)}
                />
              </div>
              {influencer.bio ? (
                <div className="mt-5 rounded-[0.875rem] border border-border bg-surface-muted/45 p-4">
                  <p className="text-xs font-semibold uppercase text-muted">Bio</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {influencer.bio}
                  </p>
                </div>
              ) : null}
            </SectionShell>
            ) : null}

            {activeTab === 'application' ? (
            <SectionShell
              description="Submitted creator application and latest review context."
              id={influencerDetailSectionIds.application}
              icon={<UserRound className="size-4" />}
              title="Application"
            >
              {influencer.application ? (
                <div className="mt-5 space-y-4">
                  <DetailField
                    label="Status"
                    value={humanizeCode(influencer.application.status)}
                  />
                  <DetailField label="City" value={influencer.application.city} />
                  <DetailField
                    label="Submitted"
                    value={formatDateSafe(influencer.application.createdAt)}
                  />
                  <DetailField
                    label="Reviewed"
                    value={formatDateSafe(influencer.application.reviewedAt)}
                  />
                  <DetailNodeField label="Preferred categories">
                    <PreferredCategoryLinks
                      canReadSettings={canReadSettings}
                      categoriesById={preferredCategoriesById}
                      categoryIds={influencer.application.preferredCategoryIds}
                      onNavigate={navigate}
                    />
                  </DetailNodeField>
                  <DetailNodeField label="Social profiles">
                    <SocialProfilesList
                      fallbackHandle={influencer.application.socialHandle}
                      profiles={influencer.application.socialProfiles}
                    />
                  </DetailNodeField>
                  {influencer.application.motivation ? (
                    <div className="rounded-[0.875rem] border border-border bg-surface-muted/45 p-4">
                      <p className="text-xs font-semibold uppercase text-muted">
                        Motivation
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {influencer.application.motivation}
                      </p>
                    </div>
                  ) : null}
                  {applicationReason ? (
                    <div className="rounded-[0.875rem] border border-border bg-surface-muted/45 p-4">
                      <p className="text-xs font-semibold uppercase text-muted">
                        Review reason
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {applicationReason}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  title="No application"
                  description="This creator profile does not have an application payload."
                />
              )}
            </SectionShell>
            ) : null}
          </section>
        </div>

        {activeTab === 'overview' ? (
        <div className="space-y-3">
          <RelatedRecordsPanel
            canReadCustomers={canReadCustomers}
            canReadOrders={canReadOrders}
            canReadReels={canReadReels}
            id={influencerDetailSectionIds.related}
            influencer={influencer}
            onNavigate={navigate}
          />
          <OperationalSignalsPanel
            canReviewInfluencers={canReviewInfluencers}
            id={influencerDetailSectionIds.signals}
            influencer={influencer}
          />
        </div>
        ) : null}
      </section>

      {activeTab === 'reels' ? (
      <SectionShell
        actionNode={
          canReadReels ? (
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => navigate(creatorReelsPath)}
            >
              <ArrowUpRight className="mr-2 size-4" />
              Open reels queue
            </Button>
          ) : null
        }
        description="Influencer reels still use the normal admin reel moderation queue."
        id={influencerDetailSectionIds.reels}
        icon={<Film className="size-4" />}
        title="Recent creator reels"
      >
        {influencer.reels.length === 0 ? (
          <EmptyState
            title="No reels yet"
            description="This creator has not uploaded any reels."
          />
        ) : (
          <DynamicTable
            actionColumnLabel="Reel Actions"
            actionColumnMinWidth={260}
            columns={reelColumns}
            data={influencer.reels}
            getRowId={(row) => row.reelId}
            stickyHeader
            rowActions={(reel) => [
              {
                icon: <ArrowUpRight className="size-4" />,
                isVisible: canReadReels,
                key: 'open-reel',
                label: 'Open Reel',
                onClick: () => navigate(`${routePaths.reels}/${reel.reelId}`),
                variant: 'ghost',
              },
              {
                icon: <Store className="size-4" />,
                isVisible: canReadVendors,
                key: 'open-vendor',
                label: 'Open Vendor',
                onClick: () =>
                  navigate(`${routePaths.vendors}/${reel.taggedVendor.vendorId}`),
                variant: 'secondary',
              },
            ]}
            onRowClick={
              canReadReels
                ? (reel) => navigate(`${routePaths.reels}/${reel.reelId}`)
                : undefined
            }
          />
        )}
      </SectionShell>
      ) : null}

      {activeTab === 'commission' ? (
      <SectionShell
        description="Phase 1 records manual commission entries; payout automation is not enabled."
        id={influencerDetailSectionIds.commission}
        icon={<HandCoins className="size-4" />}
        title="Commission ledger"
      >
        {influencer.commissions.length === 0 ? (
          <EmptyState
            title="No commissions yet"
            description="Commissions appear after an attributed order is paid and delivered."
          />
        ) : (
          <DynamicTable
            actionColumnLabel="Ledger Actions"
            actionColumnMinWidth={300}
            columns={commissionColumns}
            data={influencer.commissions}
            getRowId={(row) => row.commissionId}
            stickyHeader
            rowActions={(commission) => [
              {
                icon: <ReceiptText className="size-4" />,
                isVisible: canReadOrders,
                key: 'open-order',
                label: 'Open Order',
                onClick: () =>
                  navigate(`${routePaths.orders}/${commission.orderId}`),
                variant: 'ghost',
              },
              {
                icon: <Film className="size-4" />,
                isVisible: canReadReels,
                key: 'open-reel',
                label: 'Open Reel',
                onClick: () => navigate(`${routePaths.reels}/${commission.reelId}`),
                variant: 'secondary',
              },
              {
                icon: <Store className="size-4" />,
                isVisible: canReadVendors,
                key: 'open-vendor',
                label: 'Open Vendor',
                onClick: () =>
                  navigate(`${routePaths.vendors}/${commission.vendor.vendorId}`),
                variant: 'secondary',
              },
            ]}
            onRowClick={
              canReadOrders
                ? (commission) =>
                    navigate(`${routePaths.orders}/${commission.orderId}`)
                : undefined
            }
          />
        )}
      </SectionShell>
      ) : null}

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
        onSubmit={(values) =>
          selectedAction
            ? actionMutation.mutate({ action: selectedAction, values })
            : undefined
        }
      />
    </PageContainer>
  )
}
