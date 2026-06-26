import {
  BadgeCheck,
  CheckCircle2,
  PauseCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
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
  AdminInfluencerReel,
  InfluencerActionKind,
  InfluencerStatus,
} from '../types/influencer.types'

type InfluencerTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

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

function toneClasses(tone: InfluencerTone) {
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

function formatPaise(amountPaise: number, currency = 'INR') {
  return formatMoney(amountPaise / 100, currency)
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

function MetricCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: InfluencerTone
  value: string | number
}) {
  return (
    <div className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={`text-xs font-semibold uppercase tracking-normal ${toneClasses(tone)}`}>
        {label}
      </p>
      <p className={`mt-3 text-2xl font-semibold tracking-normal ${toneClasses(tone)}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
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
      <Badge tone={statusTone(influencer.status)}>{influencer.status}</Badge>
      {influencer.status === 'APPROVED' ? (
        <Badge tone="success">Approved Creator</Badge>
      ) : null}
      {influencer.application ? (
        <Badge tone={statusTone(influencer.application.status)}>
          Application {influencer.application.status}
        </Badge>
      ) : null}
    </div>
  )
}

function InfluencerHeaderActions({
  influencer,
  isSubmitting,
  onSelectAction,
}: {
  influencer: AdminInfluencer
  isSubmitting: boolean
  onSelectAction: (kind: InfluencerActionKind) => void
}) {
  const hasAction = (kind: InfluencerActionKind) =>
    influencer.availableActions.includes(kind)

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
      {hasAction('SUSPEND') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          variant="danger"
          onClick={() => onSelectAction('SUSPEND')}
        >
          <PauseCircle className="mr-2 size-4" />
          Suspend
        </Button>
      ) : null}
      {hasAction('REACTIVATE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          onClick={() => onSelectAction('REACTIVATE')}
        >
          <RotateCcw className="mr-2 size-4" />
          Reactivate
        </Button>
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

export function InfluencerDetailPage() {
  const { profileId } = useParams()
  const queryClient = useQueryClient()
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
        <Skeleton className="h-32 rounded-2xl" />
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

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <InfluencerHeaderActions
            influencer={influencer}
            isSubmitting={actionMutation.isPending}
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

      {influencer.warnings.length > 0 ? (
        <section className="flex flex-wrap gap-2 rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface">
          {influencer.warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {humanizeCode(warning)}
            </Badge>
          ))}
        </section>
      ) : null}

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total reels"
          meta={`${influencer.summary.pendingReelCount} pending moderation`}
          tone={influencer.summary.reelCount > 0 ? 'info' : 'neutral'}
          value={influencer.summary.reelCount}
        />
        <MetricCard
          label="Live reels"
          meta="Visible creator content"
          tone={influencer.summary.liveReelCount > 0 ? 'success' : 'neutral'}
          value={influencer.summary.liveReelCount}
        />
        <MetricCard
          label="Attributed bookings"
          meta="Orders connected to creator reels"
          tone={
            influencer.summary.attributedBookingCount > 0 ? 'info' : 'neutral'
          }
          value={influencer.summary.attributedBookingCount}
        />
        <MetricCard
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

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full border border-border bg-surface text-success">
              <BadgeCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-normal text-foreground">
                Creator profile
              </h2>
              <p className="text-sm text-muted">
                Customer identity stays active while creator capabilities are managed here.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DetailField label="Display name" value={influencer.displayName} />
            <DetailField label="Social handle" value={influencer.socialHandle} />
            <DetailField label="Customer status" value={influencer.customer.status} />
            <DetailField
              label="City"
              value={influencer.customer.zone?.zoneName ?? influencer.customer.city}
            />
            <DetailField label="Mobile" value={influencer.customer.mobileNumber} />
            <DetailField label="Email" value={influencer.customer.email} />
            <DetailField
              label="Approved at"
              value={
                influencer.approvedAt
                  ? formatDate(influencer.approvedAt, true)
                  : null
              }
            />
            <DetailField
              label="Last commission"
              value={
                influencer.summary.lastCommissionAt
                  ? formatDate(influencer.summary.lastCommissionAt, true)
                  : null
              }
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
        </div>

        <div className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
          <h2 className="text-base font-semibold tracking-normal text-foreground">
            Application
          </h2>
          {influencer.application ? (
            <div className="mt-5 space-y-4">
              <DetailField label="Status" value={influencer.application.status} />
              <DetailField label="City" value={influencer.application.city} />
              <DetailField
                label="Submitted"
                value={formatDate(influencer.application.createdAt, true)}
              />
              <DetailField
                label="Reviewed"
                value={
                  influencer.application.reviewedAt
                    ? formatDate(influencer.application.reviewedAt, true)
                    : null
                }
              />
              <DetailField
                label="Preferred categories"
                value={
                  influencer.application.preferredCategoryIds.length
                    ? influencer.application.preferredCategoryIds.join(', ')
                    : null
                }
              />
              <DetailField
                label="Social handle"
                value={influencer.application.socialHandle}
              />
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
        </div>
      </section>

      <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-normal text-foreground">
              Recent creator reels
            </h2>
            <p className="text-sm text-muted">
              Influencer reels still use the normal admin reel moderation queue.
            </p>
          </div>
          <Link to={routePaths.reels}>
            <Button size="sm" variant="secondary">
              Open reels queue
            </Button>
          </Link>
        </div>
        {influencer.reels.length === 0 ? (
          <EmptyState
            title="No reels yet"
            description="This creator has not uploaded any reels."
          />
        ) : (
          <DynamicTable
            columns={reelColumns}
            data={influencer.reels}
            getRowId={(row) => row.reelId}
          />
        )}
      </section>

      <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-normal text-foreground">
            Commission ledger
          </h2>
          <p className="text-sm text-muted">
            Phase 1 records manual commission entries; payout automation is not enabled.
          </p>
        </div>
        {influencer.commissions.length === 0 ? (
          <EmptyState
            title="No commissions yet"
            description="Commissions appear after an attributed order is paid and delivered."
          />
        ) : (
          <DynamicTable
            columns={commissionColumns}
            data={influencer.commissions}
            getRowId={(row) => row.commissionId}
          />
        )}
      </section>

      <InfluencerActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={
          selectedAction
            ? `${selectedAction.kind}-${selectedAction.influencer.influencerProfileId}`
            : 'influencer-action-empty'
        }
        onClose={() => setSelectedAction(null)}
        onSubmit={(values) =>
          selectedAction
            ? actionMutation.mutate({ action: selectedAction, values })
            : undefined
        }
      />
    </PageContainer>
  )
}
