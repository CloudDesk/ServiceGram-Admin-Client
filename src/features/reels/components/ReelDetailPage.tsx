import {
  CheckCircle2,
  ExternalLink,
  PauseCircle,
  PencilLine,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
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
  isSubmitting,
  onSelectAction,
  reel,
}: {
  isSubmitting: boolean
  onSelectAction: (kind: ReelActionKind) => void
  reel: AdminReel
}) {
  const hasAction = (action: ReelActionKind) =>
    reel.availableActions.includes(action)

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
    </div>
  )
}

export function ReelDetailPage() {
  const { reelId } = useParams()
  const queryClient = useQueryClient()
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

      return reelService.removeReel(reel.reelId, {
        reason: values.reason,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
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

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <ReelHeaderActions
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">
            Reel Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Reel ID" value={reel.reelId} />
            <DetailField label="Public Reel ID" value={reel.publicReelId} />
            <DetailField label="Content Type" value={reel.contentType} />
            <DetailField label="Caption" value={reel.caption} />
            <DetailField label="Price Indicator" value={reel.priceIndicator} />
            <DetailField
              label="Next Recommended Action"
              value={reel.nextRecommendedAction}
            />
            <DetailField
              label="Available Actions"
              value={
                reel.availableActions.length
                  ? reel.availableActions.join(', ')
                  : null
              }
            />
            <DetailField
              label="Warnings"
              value={reel.warnings.length ? reel.warnings.join(', ') : null}
            />
            <DetailField
              label="Blocking Reasons"
              value={
                reel.blockingReasons.length
                  ? reel.blockingReasons.join(', ')
                  : null
              }
            />
            <DetailField
              label="Missing Fields"
              value={
                reel.missingFields.length ? reel.missingFields.join(', ') : null
              }
            />
            <DetailField label="Created At" value={reel.createdAt} />
            <DetailField label="Updated At" value={reel.updatedAt} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Vendor</h2>
          <DetailField label="Shop" value={reel.vendor.shopName} />
          <DetailField label="Owner" value={reel.vendor.ownerName} />
          <DetailField label="Mobile" value={reel.vendor.mobileNumber} />
          <DetailField label="Vendor ID" value={reel.vendor.vendorId} />
          <DetailField label="Public Vendor ID" value={reel.vendor.publicVendorId} />
          <DetailField label="Vendor Status" value={reel.vendor.vendorStatus} />
          <DetailField
            label="Onboarding Status"
            value={reel.vendor.onboardingStatus}
          />
          <DetailField label="City" value={reel.vendor.city} />
          <DetailField label="Zone" value={reel.vendor.zone?.zoneName} />
          <DetailField label="Category" value={reel.category?.name} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Media</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField
              label="Cloudflare Video UID"
              value={reel.media.cloudflareVideoUid}
            />
            <DetailField
              label="Duration Seconds"
              value={reel.media.durationSeconds}
            />
            <DetailField label="Upload Status" value={reel.media.uploadStatus} />
            <UrlDetailField label="Playback URL" value={reel.media.playbackUrl} />
            <UrlDetailField label="Thumbnail URL" value={reel.media.thumbnailUrl} />
          </div>
        </div>

        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            Moderation & Publish
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Moderation Status" value={reel.moderation.status} />
            <DetailField
              label="Rejection Reason"
              value={reel.moderation.rejectionReason}
            />
            <DetailField
              label="Approved By Admin ID"
              value={reel.moderation.approvedByAdminId}
            />
            <DetailField label="Approved At" value={reel.moderation.approvedAt} />
            <DetailField label="Published" value={reel.publish.isPublished} />
            <DetailField label="Published At" value={reel.publish.publishedAt} />
            <DetailField
              label="Customer Visibility"
              value={reel.publish.customerVisibility}
            />
          </div>
        </div>
      </section>

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
