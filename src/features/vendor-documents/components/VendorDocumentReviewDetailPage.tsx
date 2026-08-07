import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileWarning,
  History,
  MessageSquarePlus,
  RefreshCcw,
  XCircle,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { DetailPageHeader, DetailPageHeaderSkeleton } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import {
  inferMediaViewerKind,
  isOpenableMediaUrl,
  useMediaViewer,
  type MediaViewerItem,
} from '../../../components/media'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { VendorActionModal, type VendorActionFormValues, type VendorActionKind } from '../../vendors/components/VendorActionModal'
import { vendorService } from '../../vendors/services/vendor.service'
import type {
  VendorDetail,
  VendorDocument,
} from '../../vendors/types/vendor.types'

const documentReviewSectionIds = {
  overview: 'vendor-document-review-overview',
  documents: 'vendor-document-review-documents',
  vendor: 'vendor-document-review-vendor',
  timeline: 'vendor-document-review-timeline',
} as const

type DocumentReviewActionKind = Extract<
  VendorActionKind,
  'ADD_NOTE' | 'VERIFY_DOCUMENT' | 'REJECT_DOCUMENT'
>

interface DocumentReviewActionSelection {
  kind: DocumentReviewActionKind
  document?: VendorDocument
}

interface DocumentReviewSummary {
  expired: number
  pending: number
  rejected: number
  total: number
  verified: number
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatNullableDate(value: string | null | undefined, withTime = true) {
  return value ? formatDate(value, withTime) : 'Not available'
}

function formatFileSize(value: number | null | undefined) {
  if (!value) return 'Size not available'
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function documentTone(status: string): StatusTone {
  if (status === 'VERIFIED') return 'success'
  if (status === 'REJECTED' || status === 'EXPIRED') return 'danger'
  return 'warning'
}

function onboardingTone(status: string): StatusTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'DOCUMENTS_PENDING' || status === 'UNDER_REVIEW') {
    return 'warning'
  }

  return 'info'
}

function vendorStatusTone(status: string): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED' || status === 'INACTIVE') return 'danger'
  return 'warning'
}

function buildDocumentReviewSummary(documents: VendorDocument[]) {
  return documents.reduce<DocumentReviewSummary>(
    (summary, document) => {
      summary.total += 1

      if (document.status === 'PENDING') summary.pending += 1
      if (document.status === 'VERIFIED') summary.verified += 1
      if (document.status === 'REJECTED') summary.rejected += 1
      if (document.status === 'EXPIRED') summary.expired += 1

      return summary
    },
    {
      expired: 0,
      pending: 0,
      rejected: 0,
      total: 0,
      verified: 0,
    },
  )
}

function reviewState(summary: DocumentReviewSummary) {
  if (summary.pending > 0) return { label: 'Needs review', tone: 'warning' as const }
  if (summary.rejected > 0) return { label: 'Correction needed', tone: 'danger' as const }
  if (summary.expired > 0) return { label: 'Expired', tone: 'danger' as const }
  if (summary.total > 0 && summary.verified === summary.total) {
    return { label: 'Complete', tone: 'success' as const }
  }

  return { label: 'No documents', tone: 'neutral' as const }
}

function buildVendorDocumentMediaItem(
  vendor: VendorDetail,
  document: VendorDocument,
): MediaViewerItem | null {
  const downloadUrl = document.download?.downloadUrl

  if (!isOpenableMediaUrl(downloadUrl)) return null

  const fileName = document.fileName ?? document.documentType
  const mimeType = document.mimeType ?? null

  return {
    description: `${humanizeCode(document.status)} vendor document for ${vendor.shopName}.`,
    downloadUrl,
    expiresAt: document.download?.expiresAt,
    fileName,
    id: document.documentId,
    kind: inferMediaViewerKind({
      fileName,
      mimeType,
      src: downloadUrl,
    }),
    mimeType,
    ownerLabel: vendor.shopName,
    providerStatus: document.download?.providerStatus,
    sizeBytes: document.sizeBytes ?? null,
    sourceLabel: 'Vendor document',
    src: downloadUrl,
    title: humanizeCode(document.documentType),
    warnings: document.download?.warnings ?? [],
  }
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-2 min-w-0 break-words text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

function DocumentMeta({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 text-xs leading-5">
      <span className="font-semibold uppercase tracking-normal text-muted">
        {label}
      </span>
      <span className="ml-1 font-medium text-foreground">{value}</span>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: StatusTone
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          {label}
        </p>
        <span
          className={cn(
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-danger',
            tone === 'info' && 'text-info',
            tone === 'neutral' && 'text-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  id,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  id: string
  title: string
}) {
  return (
    <section
      className="scroll-mt-24 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
      id={id}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? <span className="shrink-0 text-primary">{icon}</span> : null}
            <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
              {title}
            </h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}

function DocumentReviewNav() {
  const items = [
    { href: `#${documentReviewSectionIds.overview}`, label: 'Overview' },
    { href: `#${documentReviewSectionIds.documents}`, label: 'Documents' },
    { href: `#${documentReviewSectionIds.vendor}`, label: 'Vendor' },
    { href: `#${documentReviewSectionIds.timeline}`, label: 'Timeline' },
  ]

  return (
    <nav
      aria-label="Document review sections"
      className="sticky top-[3.2rem] z-10 -mx-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface/95 p-1 shadow-surface backdrop-blur"
    >
      <div className="flex min-w-max gap-1">
        {items.map((item) => (
          <a
            className="inline-flex h-8 items-center rounded-[0.65rem] px-3 text-sm font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  )
}

function HeaderStatus({
  summary,
  vendor,
}: {
  summary: DocumentReviewSummary
  vendor: VendorDetail
}) {
  const state = reviewState(summary)

  return (
    <>
      <Badge tone={state.tone}>{state.label}</Badge>
      <Badge tone={onboardingTone(vendor.onboardingStatus)}>
        {humanizeCode(vendor.onboardingStatus)}
      </Badge>
      <Badge tone={vendorStatusTone(vendor.vendorStatus)}>
        {humanizeCode(vendor.vendorStatus)}
      </Badge>
    </>
  )
}

function DocumentCard({
  canApproveVendors,
  document,
  isPreviewPending,
  isSubmitting,
  onPreview,
  onSelectAction,
  vendor,
}: {
  canApproveVendors: boolean
  document: VendorDocument
  isPreviewPending: boolean
  isSubmitting: boolean
  onPreview: (document: VendorDocument) => void
  onSelectAction: (action: DocumentReviewActionSelection) => void
  vendor: VendorDetail
}) {
  const canReviewDocument =
    canApproveVendors && vendor.onboardingStatus !== 'APPROVED'
  const canApproveDocument = canReviewDocument && document.status !== 'VERIFIED'
  const canRejectDocument =
    canReviewDocument &&
    (document.status === 'PENDING' || document.status === 'VERIFIED')
  const mediaLabel = document.mediaAssetId
    ? document.mimeType
      ? `${document.mimeType} / ${formatFileSize(document.sizeBytes)}`
      : 'Media linked'
    : 'Not uploaded'

  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileCheck2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                {humanizeCode(document.documentType)}
              </h3>
              <Badge tone={documentTone(document.status)}>
                {humanizeCode(document.status)}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {document.fileName ?? document.mediaAssetId ?? 'Media not linked'}
            </p>
            <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2 xl:grid-cols-4">
              <DocumentMeta label="Media" value={mediaLabel} />
              <DocumentMeta
                label="Updated"
                value={formatNullableDate(document.updatedAt)}
              />
              <DocumentMeta
                label="Verified"
                value={formatNullableDate(document.verifiedAt)}
              />
              <DocumentMeta
                label="Expires"
                value={formatNullableDate(document.expiresAt, false)}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button
            disabled={!document.mediaAssetId}
            isLoading={isPreviewPending}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => onPreview(document)}
          >
            <Eye className="mr-1.5 size-3.5" />
            Preview
          </Button>
          {canApproveDocument ? (
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              onClick={() => onSelectAction({ kind: 'VERIFY_DOCUMENT', document })}
            >
              <CheckCircle2 className="mr-1.5 size-3.5" />
              Approve
            </Button>
          ) : null}
          {canRejectDocument ? (
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="danger"
              onClick={() => onSelectAction({ kind: 'REJECT_DOCUMENT', document })}
            >
              <XCircle className="mr-1.5 size-3.5" />
              Reject
            </Button>
          ) : null}
        </div>
      </div>

      {document.rejectionReason ? (
        <div className="mt-3 rounded-[0.75rem] border border-danger/20 bg-danger/10 px-3 py-2 text-sm leading-5 text-danger">
          {document.rejectionReason}
        </div>
      ) : null}
    </article>
  )
}

function TimelineSection({ vendor }: { vendor: VendorDetail }) {
  if (!vendor.reviewTimeline.length) {
    return (
      <EmptyState
        description="Document review activity will appear here."
        title="No timeline"
      />
    )
  }

  return (
    <div className="space-y-2">
      {vendor.reviewTimeline.map((event) => (
        <div
          className="flex gap-3 rounded-[0.75rem] border border-border bg-surface-muted/30 p-3"
          key={event.reviewEventId}
        >
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary">
            <History className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                {humanizeCode(event.actionCode)}
              </p>
              <span className="text-xs text-muted">
                {formatNullableDate(event.createdAt)}
              </span>
            </div>
            {event.reason ? (
              <p className="mt-1 text-sm leading-5 text-muted">{event.reason}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeaderSkeleton />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-28 rounded-[0.875rem]" key={index} />
        ))}
      </div>
      <Skeleton className="h-[28rem] rounded-[0.875rem]" />
    </PageContainer>
  )
}

export function VendorDocumentReviewDetailPage() {
  const { vendorId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { openMediaViewer } = useMediaViewer()
  const { pushToast } = useToast()
  const canApproveVendors = useAuthStore((state) => state.can('vendors:approve'))
  const [selectedAction, setSelectedAction] =
    useState<DocumentReviewActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const vendorOverviewQuery = useQuery({
    enabled: Boolean(vendorId),
    queryKey: ['vendor-overview', vendorId],
    queryFn: () => vendorService.getVendorOverview(vendorId as string),
    staleTime: 30_000,
  })

  const vendor = vendorOverviewQuery.data?.data.vendor
  const summary = buildDocumentReviewSummary(vendor?.documents ?? [])
  const state = reviewState(summary)

  const refreshVendor = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['vendor-overview', vendorId] }),
      queryClient.invalidateQueries({ queryKey: ['vendor-detail', vendorId] }),
      queryClient.invalidateQueries({ queryKey: ['vendor-documents'] }),
      queryClient.invalidateQueries({ queryKey: ['vendors'] }),
      queryClient.invalidateQueries({ queryKey: ['vendor-onboarding'] }),
    ])
  }

  const previewMutation = useMutation({
    mutationFn: async (document: VendorDocument) => {
      if (!vendor) throw new Error('Vendor details are unavailable.')
      if (!document.mediaAssetId) throw new Error('Document media is not linked.')

      const response = await vendorService.getVendorDocumentDownloadTarget(
        vendor.vendorId,
        document.documentId,
      )

      return {
        document: {
          ...document,
          download: response.data.download,
          fileName: response.data.fileName ?? document.fileName,
          mediaStatus: response.data.mediaStatus ?? document.mediaStatus,
          mimeType: response.data.mimeType ?? document.mimeType,
          sizeBytes: response.data.sizeBytes ?? document.sizeBytes,
        },
      }
    },
    onMutate: () => setPreviewError(null),
    onSuccess: ({ document }) => {
      if (!vendor) return

      const mediaItem = buildVendorDocumentMediaItem(vendor, document)

      if (mediaItem) {
        openMediaViewer({ items: [mediaItem] })
        return
      }

      setPreviewError('Signed document preview is unavailable for this file.')
    },
    onError: (error) => {
      setPreviewError(
        error instanceof Error
          ? error.message
          : 'We could not load this document preview.',
      )
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: DocumentReviewActionSelection
      values: VendorActionFormValues
    }) => {
      if (!vendor) throw new Error('Vendor details are unavailable.')

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return vendorService.addVendorNote(vendor.vendorId, {
          note: values.note,
        })
      }

      if (!action.document) {
        throw new Error('Document details are unavailable.')
      }

      if (action.kind === 'VERIFY_DOCUMENT') {
        return vendorService.verifyVendorDocument(
          vendor.vendorId,
          action.document.documentId,
          { reason: values.reason },
        )
      }

      if (!values.reason) throw new Error('Rejection reason is required.')

      return vendorService.rejectVendorDocument(
        vendor.vendorId,
        action.document.documentId,
        { reason: values.reason },
      )
    },
    onMutate: () => setActionError(null),
    onSuccess: async (_response, variables) => {
      const toastTitle =
        variables.action.kind === 'ADD_NOTE'
          ? 'Note added'
          : variables.action.kind === 'VERIFY_DOCUMENT'
            ? 'Document approved'
            : 'Document rejected'

      pushToast({
        tone: 'success',
        title: toastTitle,
        description: vendor?.shopName,
      })
      setSelectedAction(null)
      await refreshVendor()
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Document action failed.',
      )
    },
  })

  if (vendorOverviewQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (vendorOverviewQuery.isError || !vendor) {
    return (
      <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
        <DetailPageHeader
          listHref={routePaths.vendorDocuments}
          listLabel="Document Review"
          recordName="Document review"
          title="Document review unavailable"
        />
        <ErrorState
          description="Retry the vendor document review page."
          title="Document review unavailable"
          onRetry={() => void vendorOverviewQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const isSubmitting = actionMutation.isPending
  const canReviewDocuments =
    canApproveVendors && vendor.onboardingStatus !== 'APPROVED'

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void vendorOverviewQuery.refetch()}
            >
              <RefreshCcw
                className={cn(
                  'mr-1.5 size-3.5',
                  vendorOverviewQuery.isFetching &&
                    'animate-spin motion-reduce:animate-none',
                )}
              />
              Refresh
            </Button>
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setSelectedAction({ kind: 'ADD_NOTE' })}
            >
              <MessageSquarePlus className="mr-1.5 size-3.5" />
              Add note
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => navigate(`${routePaths.vendors}/${vendor.vendorId}`)}
            >
              <ArrowUpRight className="mr-1.5 size-3.5" />
              Open vendor
            </Button>
          </>
        }
        description={vendor.publicVendorId}
        listHref={routePaths.vendorDocuments}
        listLabel="Document Review"
        recordName={vendor.shopName}
        titleMetaNode={<HeaderStatus summary={summary} vendor={vendor} />}
      />

      <DocumentReviewNav />

      <section
        className="grid scroll-mt-24 gap-3 md:grid-cols-2 xl:grid-cols-4"
        id={documentReviewSectionIds.overview}
      >
        <SummaryCard
          icon={<FileCheck2 className="size-4" />}
          label="Review"
          meta={canReviewDocuments ? 'Ready for document decisions' : 'Review locked'}
          tone={state.tone}
          value={state.label}
        />
        <SummaryCard
          icon={<FileWarning className="size-4" />}
          label="Pending"
          meta={`${summary.rejected} rejected / ${summary.expired} expired`}
          tone={summary.pending ? 'warning' : 'neutral'}
          value={String(summary.pending)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Approved"
          meta={`${summary.total} submitted document${summary.total === 1 ? '' : 's'}`}
          tone={summary.verified === summary.total && summary.total ? 'success' : 'info'}
          value={`${summary.verified}/${summary.total}`}
        />
        <SummaryCard
          icon={<History className="size-4" />}
          label="Updated"
          meta={vendor.address.city || 'No city'}
          tone="info"
          value={formatNullableDate(vendor.updatedAt, false)}
        />
      </section>

      {!canApproveVendors ? (
        <div className="rounded-[0.875rem] border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
          Your role can view documents but cannot approve or reject them.
        </div>
      ) : null}

      {vendor.onboardingStatus === 'APPROVED' ? (
        <div className="rounded-[0.875rem] border border-border bg-surface-muted/50 p-3 text-sm text-muted">
          This vendor is already approved, so document review actions are locked.
        </div>
      ) : null}

      {previewError ? (
        <div className="rounded-[0.875rem] border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
          {previewError}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <SectionShell
          description="Preview each submitted file, then approve it or reject it with a clear resubmission reason."
          icon={<FileCheck2 className="size-4" />}
          id={documentReviewSectionIds.documents}
          title="Submitted documents"
        >
          {vendor.documents.length ? (
            <div className="space-y-2">
              {vendor.documents.map((document) => (
                <DocumentCard
                  canApproveVendors={canApproveVendors}
                  document={document}
                  isPreviewPending={previewMutation.isPending}
                  isSubmitting={isSubmitting}
                  key={document.documentId}
                  vendor={vendor}
                  onPreview={(nextDocument) => previewMutation.mutate(nextDocument)}
                  onSelectAction={setSelectedAction}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              description="This vendor has not uploaded onboarding documents yet."
              title="No documents"
            />
          )}
        </SectionShell>

        <div className="space-y-3">
          <SectionShell
            description="Business and contact context for the reviewer."
            icon={<ArrowUpRight className="size-4" />}
            id={documentReviewSectionIds.vendor}
            title="Vendor context"
          >
            <div className="space-y-2">
              <DetailField label="Owner" value={vendor.ownerName ?? 'Not available'} />
              <DetailField label="Mobile" value={vendor.mobileNumber} />
              <DetailField label="Email" value={vendor.businessEmail ?? 'No email'} />
              <DetailField
                label="Category"
                value={vendor.category?.name ?? 'Unassigned'}
              />
              <DetailField label="City" value={vendor.address.city || 'No city'} />
              <DetailField
                label="Zone"
                value={vendor.address.zone?.zoneName ?? 'No zone'}
              />
            </div>
          </SectionShell>

          <SectionShell
            description="Recent vendor review activity."
            icon={<History className="size-4" />}
            id={documentReviewSectionIds.timeline}
            title="Timeline"
          >
            <TimelineSection vendor={vendor} />
          </SectionShell>
        </div>
      </div>

      {selectedAction ? (
        <VendorActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          vendor={{
            ownerName: vendor.ownerName,
            publicVendorId: vendor.publicVendorId,
            shopName: vendor.shopName,
          }}
          onClose={() => {
            if (!actionMutation.isPending) setSelectedAction(null)
          }}
          onSubmit={(values) =>
            actionMutation.mutate({ action: selectedAction, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
