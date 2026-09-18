import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileCheck2,
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
import {
  RecordField,
  RecordFieldList,
  RecordHeaderActions,
  RecordMetricStrip,
  RecordSection,
  RecordTabs,
  type RecordAction,
  type RecordTabItem,
} from '../../../components/ui/RecordPage'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { VendorActionModal, type VendorActionFormValues, type VendorActionKind } from '../../vendors/components/VendorActionModal'
import { vendorService } from '../../vendors/services/vendor.service'
import { getOnboardingStatusTone, getVendorStatusTone, humanizeCode } from '../../vendors/vendorPresenters'
import type {
  VendorDetail,
  VendorDocument,
} from '../../vendors/types/vendor.types'

const DOCUMENT_REVIEW_TABS = ['documents', 'vendor', 'timeline'] as const
type DocumentReviewTab = (typeof DOCUMENT_REVIEW_TABS)[number]

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

function canVerifyVendorDocument(document: VendorDocument) {
  return ['PENDING', 'REJECTED'].includes(document.status)
}

function canRejectVendorDocument(document: VendorDocument) {
  return ['PENDING', 'VERIFIED'].includes(document.status)
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

function DocumentMeta({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-xs">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      <span
        className="truncate font-medium text-foreground"
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </span>
    </div>
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
      <Badge tone={getOnboardingStatusTone(vendor.onboardingStatus)}>
        {humanizeCode(vendor.onboardingStatus)}
      </Badge>
      <Badge tone={getVendorStatusTone(vendor.vendorStatus)}>
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
}: {
  canApproveVendors: boolean
  document: VendorDocument
  isPreviewPending: boolean
  isSubmitting: boolean
  onPreview: (document: VendorDocument) => void
  onSelectAction: (action: DocumentReviewActionSelection) => void
}) {
  const canApproveDocument =
    canApproveVendors && canVerifyVendorDocument(document)
  const canRejectDocument =
    canApproveVendors && canRejectVendorDocument(document)
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
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
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
              Verify
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
      <Skeleton className="h-11 rounded-[0.75rem]" />
      <Skeleton className="h-[28rem] rounded-[0.875rem]" />
    </PageContainer>
  )
}

export function VendorDocumentReviewDetailPage() {
  const { vendorId, tab: tabParam } = useParams()
  const activeTab: DocumentReviewTab = DOCUMENT_REVIEW_TABS.includes(
    tabParam as DocumentReviewTab,
  )
    ? (tabParam as DocumentReviewTab)
    : 'documents'
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

  const headerActions: RecordAction[] = [
    {
      key: 'add-note',
      label: 'Add note',
      icon: <MessageSquarePlus className="size-3.5" />,
      intent: 'secondary',
      onSelect: () => setSelectedAction({ kind: 'ADD_NOTE' }),
    },
    {
      key: 'open-vendor',
      label: 'Open vendor',
      icon: <ArrowUpRight className="size-3.5" />,
      intent: 'primary',
      onSelect: () => navigate(`${routePaths.vendors}/${vendor.vendorId}`),
    },
  ]

  const tabItems: RecordTabItem[] = [
    { key: 'documents', label: 'Documents', count: vendor.documents.length },
    { key: 'vendor', label: 'Vendor' },
    { key: 'timeline', label: 'Timeline', count: vendor.reviewTimeline.length },
  ]

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <RecordHeaderActions
            actions={headerActions}
            utility={
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
            }
          />
        }
        description={vendor.publicVendorId}
        listHref={routePaths.vendorDocuments}
        listLabel="Document Review"
        recordName={vendor.shopName}
        titleMetaNode={<HeaderStatus summary={summary} vendor={vendor} />}
      />

      <RecordMetricStrip
        ariaLabel="Document review summary"
        metrics={[
          {
            label: 'Review',
            value: state.label,
            tone: state.tone === 'neutral' ? undefined : state.tone,
          },
          {
            label: 'Pending',
            value: String(summary.pending),
            tone: summary.pending ? 'warning' : undefined,
          },
          {
            label: 'Approved',
            value: `${summary.verified}/${summary.total}`,
            tone: summary.total && summary.verified === summary.total ? 'success' : undefined,
          },
          {
            label: 'Updated',
            value: formatNullableDate(vendor.updatedAt, false),
          },
        ]}
      />

      {!canApproveVendors ? (
        <div className="rounded-[0.875rem] border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
          Your role can view documents but cannot approve or reject them.
        </div>
      ) : null}

      {vendor.onboardingStatus === 'APPROVED' && summary.pending > 0 ? (
        <div className="rounded-[0.875rem] border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
          This vendor is already approved, but pending document updates still need review.
        </div>
      ) : null}

      {previewError ? (
        <div className="rounded-[0.875rem] border border-danger/20 bg-danger/10 p-3 text-sm text-danger">
          {previewError}
        </div>
      ) : null}

      <RecordTabs
        activeTab={activeTab}
        ariaLabel="Document review sections"
        basePath={`${routePaths.vendorDocuments}/${vendor.vendorId}`}
        defaultTab="documents"
        items={tabItems}
        tabPrefix="/tab"
      />

      {activeTab === 'documents' ? (
        <RecordSection
          description="Preview each submitted file, then approve it or reject it with a clear resubmission reason."
          icon={<FileCheck2 className="size-4" />}
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
        </RecordSection>
      ) : null}

      {activeTab === 'vendor' ? (
        <RecordSection
          description="Business and contact context for the reviewer."
          icon={<ArrowUpRight className="size-4" />}
          title="Vendor context"
        >
          <RecordFieldList>
            <RecordField label="Owner" value={vendor.ownerName ?? 'Not available'} />
            <RecordField label="Mobile" value={vendor.mobileNumber} />
            <RecordField label="Email" value={vendor.businessEmail ?? 'No email'} />
            <RecordField label="Category" value={vendor.category?.name ?? 'Unassigned'} />
            <RecordField label="City" value={vendor.address.city || 'No city'} />
            <RecordField label="Zone" value={vendor.address.zone?.zoneName ?? 'No zone'} />
          </RecordFieldList>
        </RecordSection>
      ) : null}

      {activeTab === 'timeline' ? (
        <RecordSection
          description="Recent vendor review activity."
          icon={<History className="size-4" />}
          title="Timeline"
        >
          <TimelineSection vendor={vendor} />
        </RecordSection>
      ) : null}

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
