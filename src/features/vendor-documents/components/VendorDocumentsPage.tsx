import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  FileWarning,
  MessageSquarePlus,
  RefreshCcw,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { Skeleton } from '../../../components/ui/Skeleton'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  inferMediaViewerKind,
  isOpenableMediaUrl,
  useMediaViewer,
  type MediaViewerItem,
} from '../../../components/media'
import { routePaths } from '../../../config/routes'
import { useToast } from '../../../hooks/useToast'
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
} from '../../vendors/components/VendorActionModal'
import { vendorService } from '../../vendors/services/vendor.service'
import type {
  VendorDocument,
  VendorDocumentDownload,
  VendorDocumentListItem,
  VendorDocumentListQueryParams,
  VendorDocumentListVendor,
  VendorDocumentMediaStatus,
  VendorDocumentStatus,
  VendorDocumentType,
  VendorOnboardingStatus,
  VendorStatus,
} from '../../vendors/types/vendor.types'
import type { StatusTone } from '../../../types/status.types'

const DEFAULT_PAGE_SIZE = 20

const documentStatuses: VendorDocumentStatus[] = [
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
]

const documentTypes: VendorDocumentType[] = [
  'BUSINESS_REGISTRATION',
  'ADDRESS_PROOF',
  'OWNER_ID_PROOF',
  'BANK_PROOF',
  'SHOP_PHOTO',
  'GST_CERTIFICATE',
]

const mediaStatuses: VendorDocumentMediaStatus[] = [
  'UPLOAD_REQUESTED',
  'AVAILABLE',
  'FAILED',
  'DELETED',
]

const onboardingStatuses: VendorOnboardingStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'DOCUMENTS_PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]

const vendorStatuses: VendorStatus[] = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
]

type DocumentActionKind = Extract<
  VendorActionKind,
  'ADD_NOTE' | 'VERIFY_DOCUMENT' | 'REJECT_DOCUMENT'
>
type DocumentReviewQueueKey =
  | 'all'
  | 'needsReview'
  | 'rejected'
  | 'mediaIssue'
  | 'verified'
type DocumentReviewTab = 'documents' | 'vendorInfo' | 'timeline'

const DOCUMENT_FILTER_CONTROL_CLASS_NAME =
  'h-9 w-full rounded-[0.65rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

const documentReviewQueueItems: {
  key: DocumentReviewQueueKey
  label: string
}[] = [
  { key: 'all', label: 'All' },
  { key: 'needsReview', label: 'Needs review' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'mediaIssue', label: 'Media issue' },
  { key: 'verified', label: 'Verified' },
]

interface ActiveFilterChip {
  key: string
  label: string
  onClear: () => void
}

interface VendorDocumentGroupCounts {
  expired: number
  mediaIssues: number
  pending: number
  rejected: number
  total: number
  verified: number
  warnings: number
}

interface VendorDocumentGroup {
  counts: VendorDocumentGroupCounts
  documents: VendorDocumentListItem[]
  latestUpdatedAt: string
  vendor: VendorDocumentListVendor
}

interface DocumentActionTarget {
  group: VendorDocumentGroup
  kind: DocumentActionKind
  row?: VendorDocumentListItem
}

interface ReviewState {
  label: string
  tone: StatusTone
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function positiveIntegerParam(value: string | null, fallback: number) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
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

function documentTone(status: VendorDocumentStatus): StatusTone {
  if (status === 'VERIFIED') return 'success'
  if (status === 'REJECTED' || status === 'EXPIRED') return 'danger'

  return 'warning'
}

function onboardingTone(status: VendorOnboardingStatus): StatusTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'DOCUMENTS_PENDING' || status === 'UNDER_REVIEW') {
    return 'warning'
  }

  return 'info'
}

function vendorStatusTone(status: VendorStatus): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED' || status === 'INACTIVE') return 'danger'
  return 'warning'
}

function mediaTone(status: VendorDocumentMediaStatus | undefined): StatusTone {
  if (status === 'AVAILABLE') return 'success'
  if (status === 'FAILED' || status === 'DELETED') return 'danger'

  return 'warning'
}

function documentHasMediaIssue(row: VendorDocumentListItem) {
  return !row.mediaAssetId || Boolean(row.media && row.media.status !== 'AVAILABLE')
}

function documentNeedsAdminAction(row: VendorDocumentListItem) {
  return (
    row.availableActions.includes('VERIFY_DOCUMENT') ||
    row.availableActions.includes('REJECT_DOCUMENT')
  )
}

function getUpdatedTime(value: string | null | undefined) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function compareDocumentRows(
  left: VendorDocumentListItem,
  right: VendorDocumentListItem,
) {
  const statusPriority: Record<VendorDocumentStatus, number> = {
    PENDING: 0,
    REJECTED: 1,
    EXPIRED: 2,
    VERIFIED: 3,
  }

  const statusDelta = statusPriority[left.status] - statusPriority[right.status]
  if (statusDelta !== 0) return statusDelta

  return getUpdatedTime(right.updatedAt) - getUpdatedTime(left.updatedAt)
}

function buildDocumentGroups(
  documents: VendorDocumentListItem[],
): VendorDocumentGroup[] {
  const groupsByVendor = new Map<string, VendorDocumentGroup>()

  documents.forEach((document) => {
    const vendorId = document.vendor.vendorId
    const existing = groupsByVendor.get(vendorId)

    if (existing) {
      existing.documents.push(document)
      return
    }

    groupsByVendor.set(vendorId, {
      counts: {
        expired: 0,
        mediaIssues: 0,
        pending: 0,
        rejected: 0,
        total: 0,
        verified: 0,
        warnings: 0,
      },
      documents: [document],
      latestUpdatedAt: document.updatedAt,
      vendor: document.vendor,
    })
  })

  return [...groupsByVendor.values()]
    .map((group) => {
      const documentsInReviewOrder = [...group.documents].sort(compareDocumentRows)
      const counts = documentsInReviewOrder.reduce<VendorDocumentGroupCounts>(
        (nextCounts, document) => {
          nextCounts.total += 1

          if (document.status === 'PENDING') nextCounts.pending += 1
          if (document.status === 'VERIFIED') nextCounts.verified += 1
          if (document.status === 'REJECTED') nextCounts.rejected += 1
          if (document.status === 'EXPIRED') nextCounts.expired += 1
          if (documentHasMediaIssue(document)) nextCounts.mediaIssues += 1
          if (document.warnings.length > 0) nextCounts.warnings += 1

          return nextCounts
        },
        {
          expired: 0,
          mediaIssues: 0,
          pending: 0,
          rejected: 0,
          total: 0,
          verified: 0,
          warnings: 0,
        },
      )
      const latestUpdatedAt =
        documentsInReviewOrder
          .map((document) => document.updatedAt)
          .sort((left, right) => getUpdatedTime(right) - getUpdatedTime(left))[0] ??
        group.latestUpdatedAt

      return {
        ...group,
        counts,
        documents: documentsInReviewOrder,
        latestUpdatedAt,
      }
    })
    .sort((left, right) => {
      const leftActionable = left.documents.some(documentNeedsAdminAction) ? 1 : 0
      const rightActionable = right.documents.some(documentNeedsAdminAction) ? 1 : 0

      if (leftActionable !== rightActionable) {
        return rightActionable - leftActionable
      }

      if (left.counts.mediaIssues !== right.counts.mediaIssues) {
        return right.counts.mediaIssues - left.counts.mediaIssues
      }

      if (left.counts.pending !== right.counts.pending) {
        return right.counts.pending - left.counts.pending
      }

      return getUpdatedTime(right.latestUpdatedAt) - getUpdatedTime(left.latestUpdatedAt)
    })
}

function getGroupReviewState(group: VendorDocumentGroup): ReviewState {
  if (group.counts.mediaIssues > 0) {
    return { label: 'Media issue', tone: 'danger' }
  }

  if (group.counts.pending > 0) {
    return { label: 'Needs review', tone: 'warning' }
  }

  if (group.counts.rejected > 0) {
    return { label: 'Correction needed', tone: 'danger' }
  }

  if (group.counts.expired > 0) {
    return { label: 'Expired', tone: 'danger' }
  }

  if (group.counts.total > 0 && group.counts.verified === group.counts.total) {
    return { label: 'Complete', tone: 'success' }
  }

  return { label: 'Review', tone: 'neutral' }
}

function toActionDocument(
  row: VendorDocumentListItem,
  download?: VendorDocumentDownload,
): VendorDocument {
  return {
    documentId: row.documentId,
    documentType: row.documentType,
    mediaAssetId: row.mediaAssetId,
    status: row.status,
    download,
    rejectionReason: row.rejectionReason,
    verifiedByAdminId: row.verifiedByAdminId,
    verifiedAt: row.verifiedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function buildMediaItem(
  row: VendorDocumentListItem,
  download: VendorDocumentDownload,
): MediaViewerItem | null {
  const downloadUrl = download.downloadUrl

  if (!isOpenableMediaUrl(downloadUrl)) return null

  const fileName = row.media?.fileName ?? row.documentType
  const mimeType = row.media?.mimeType ?? null

  return {
    description: `${humanizeCode(row.status)} document for ${row.vendor.shopName}.`,
    downloadUrl,
    expiresAt: download.expiresAt,
    fileName,
    id: row.documentId,
    kind: inferMediaViewerKind({
      fileName,
      mimeType,
      src: downloadUrl,
    }),
    mimeType,
    ownerLabel: row.vendor.shopName,
    providerStatus: download.providerStatus,
    sizeBytes: row.media?.sizeBytes ?? null,
    sourceLabel: 'Vendor document',
    src: downloadUrl,
    title: humanizeCode(row.documentType),
    warnings: [...row.warnings, ...download.warnings],
  }
}

function buildQuery(searchParams: URLSearchParams): VendorDocumentListQueryParams {
  return {
    page: positiveIntegerParam(searchParams.get('page'), 1),
    limit: positiveIntegerParam(searchParams.get('limit'), DEFAULT_PAGE_SIZE),
    search: searchParams.get('search') || undefined,
    city: searchParams.get('city') || undefined,
    categoryId: searchParams.get('categoryId') || undefined,
    documentStatus:
      (searchParams.get('documentStatus') as VendorDocumentStatus | null) ||
      undefined,
    documentType:
      (searchParams.get('documentType') as VendorDocumentType | null) ||
      undefined,
    mediaStatus:
      (searchParams.get('mediaStatus') as VendorDocumentMediaStatus | null) ||
      undefined,
    onboardingStatus:
      (searchParams.get('onboardingStatus') as VendorOnboardingStatus | null) ||
      undefined,
    vendorStatus:
      (searchParams.get('vendorStatus') as VendorStatus | null) || undefined,
  }
}

function vendorActionContext(group: VendorDocumentGroup) {
  return {
    ownerName: group.vendor.ownerName,
    publicVendorId: group.vendor.publicVendorId,
    shopName: group.vendor.shopName,
  }
}

function getActiveDocumentQueue(
  query: VendorDocumentListQueryParams,
  queueParam: string | null,
): DocumentReviewQueueKey {
  if (queueParam === 'mediaIssue') return 'mediaIssue'
  if (query.documentStatus === 'PENDING') return 'needsReview'
  if (query.documentStatus === 'REJECTED') return 'rejected'
  if (query.documentStatus === 'VERIFIED') return 'verified'

  return 'all'
}

function filterDocumentGroupsByQueue(
  groups: VendorDocumentGroup[],
  queue: DocumentReviewQueueKey,
) {
  if (queue === 'mediaIssue') {
    return groups.filter((group) => group.counts.mediaIssues > 0)
  }

  return groups
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: ActiveFilterChip[]
  onClearAll: () => void
}) {
  if (!chips.length) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-foreground"
          key={chip.key}
        >
          <span className="truncate">{chip.label}</span>
          <button
            aria-label={`Clear ${chip.label}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
            type="button"
            onClick={chip.onClear}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        className="min-h-7 rounded-full px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function DocumentSummaryChips({ group }: { group: VendorDocumentGroup }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Badge tone={group.counts.pending ? 'warning' : 'neutral'}>
        {group.counts.pending} pending
      </Badge>
      <Badge tone={group.counts.rejected ? 'danger' : 'neutral'}>
        {group.counts.rejected} rejected
      </Badge>
      <Badge tone={group.counts.verified ? 'success' : 'neutral'}>
        {group.counts.verified} verified
      </Badge>
      {group.counts.mediaIssues ? (
        <Badge tone="danger">{group.counts.mediaIssues} media</Badge>
      ) : null}
    </div>
  )
}

function DocumentPagination({
  onPageChange,
  onPageSizeChange,
  pagination,
  visibleVendorCount,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination: {
    hasNextPage: boolean
    hasPreviousPage: boolean
    limit: number
    page: number
    totalItems: number
    totalPages: number
  }
  visibleVendorCount: number
}) {
  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {visibleVendorCount} vendors / documents {start}-{end} of{' '}
          {pagination.totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            aria-label="Rows per page"
            className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
            value={pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 20, 50].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 sm:justify-end">
        <button
          aria-label="Previous document page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
        </span>
        <button
          aria-label="Next document page"
          className="btn-icon"
          disabled={!pagination.hasNextPage}
          type="button"
          onClick={() =>
            onPageChange(Math.min(pagination.totalPages, pagination.page + 1))
          }
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

function VendorDocumentGroupSkeleton() {
  return (
    <div className="space-y-1.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-[4.8rem] w-full rounded-[0.8rem]" key={index} />
      ))}
    </div>
  )
}

function VendorDocumentGroupRow({
  group,
  isSelected,
  onAddNote,
  onOpenVendor,
  onReview,
}: {
  group: VendorDocumentGroup
  isSelected: boolean
  onAddNote: (group: VendorDocumentGroup) => void
  onOpenVendor: (group: VendorDocumentGroup) => void
  onReview: (group: VendorDocumentGroup) => void
}) {
  const reviewState = getGroupReviewState(group)
  const primaryLabel =
    group.documents.some(documentNeedsAdminAction) || reviewState.tone !== 'success'
      ? 'Review'
      : 'Open'

  return (
    <article
      aria-label={`Review documents for ${group.vendor.shopName}`}
      aria-selected={isSelected}
      className={cn(
        'grid min-w-0 cursor-pointer gap-2 border-b border-border bg-surface px-3 py-2.5 transition last:border-b-0 hover:bg-surface-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[minmax(16rem,1fr)_15rem_11rem_10rem_11.5rem] xl:items-center',
        isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/20 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onReview(group)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onReview(group)
        }
      }}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">
            {group.vendor.shopName}
          </p>
          <Badge tone={vendorStatusTone(group.vendor.vendorStatus)}>
            {humanizeCode(group.vendor.vendorStatus)}
          </Badge>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-x-1.5 overflow-hidden text-xs text-muted">
          <span className="shrink-0">{group.vendor.publicVendorId}</span>
          <span className="shrink-0 text-border">/</span>
          <span className="min-w-0 truncate">
            {group.vendor.ownerName ?? group.vendor.mobileNumber}
          </span>
        </div>
      </div>

      <div className="min-w-0">
        <DocumentSummaryChips group={group} />
        <p className="mt-1 truncate text-xs text-muted">
          {group.counts.total} document{group.counts.total === 1 ? '' : 's'} on this page
        </p>
      </div>

      <div className="min-w-0">
        <Badge tone={reviewState.tone}>{reviewState.label}</Badge>
        <p className="mt-1 truncate text-xs text-muted">
          {humanizeCode(group.vendor.onboardingStatus)}
        </p>
      </div>

      <div className="min-w-0 text-sm">
        <p className="truncate text-foreground">
          {formatDate(group.latestUpdatedAt, true)}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {group.vendor.city || 'No city'}
        </p>
      </div>

      <div className="flex flex-nowrap items-center justify-start gap-1.5 xl:justify-end">
        <Button
          className="h-8 min-h-8 min-w-[4.5rem] whitespace-nowrap px-2.5"
          size="sm"
          type="button"
          variant={primaryLabel === 'Review' ? 'primary' : 'secondary'}
          onClick={(event) => {
            event.stopPropagation()
            onReview(group)
          }}
        >
          <Eye className="mr-1.5 size-3.5" />
          {primaryLabel}
        </Button>
        <button
          aria-label={`Add note for ${group.vendor.shopName}`}
          className="btn-icon size-8 min-h-8 shrink-0"
          title="Add note"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onAddNote(group)
          }}
        >
          <MessageSquarePlus className="size-3.5" />
        </button>
        <button
          aria-label={`Open vendor detail for ${group.vendor.shopName}`}
          className="btn-icon size-8 min-h-8 shrink-0"
          title="Open vendor"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpenVendor(group)
          }}
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
    </article>
  )
}

function VendorDocumentDetailWorkbench({
  canApproveVendors,
  group,
  isSubmitting,
  onClose,
  onOpenAction,
  onOpenVendor,
  onPreviewDocument,
  previewPending,
}: {
  canApproveVendors: boolean
  group: VendorDocumentGroup
  isSubmitting: boolean
  onClose: () => void
  onOpenAction: (
    group: VendorDocumentGroup,
    kind: DocumentActionKind,
    row?: VendorDocumentListItem,
  ) => void
  onOpenVendor: (group: VendorDocumentGroup) => void
  onPreviewDocument: (row: VendorDocumentListItem) => void
  previewPending: boolean
}) {
  const reviewState = getGroupReviewState(group)
  const [activeTab, setActiveTab] = useState<DocumentReviewTab>('documents')
  const tabs: { key: DocumentReviewTab; label: string }[] = [
    { key: 'documents', label: 'Documents' },
    { key: 'vendorInfo', label: 'Vendor info' },
    { key: 'timeline', label: 'Timeline' },
  ]

  return (
    <>
      <button
        aria-label="Close document review"
        className="fixed inset-0 z-40 bg-black/20 xl:hidden"
        type="button"
        onClick={onClose}
      />
      <aside className="fixed inset-x-3 bottom-3 top-20 z-50 flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:sticky xl:inset-auto xl:top-3 xl:z-auto xl:max-h-[calc(100vh-var(--spacing-topbar)-2.5rem)]">
        <div className="shrink-0 border-b border-border p-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                  {group.vendor.shopName}
                </h2>
                <Badge tone={reviewState.tone}>{reviewState.label}</Badge>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <span>{group.vendor.publicVendorId}</span>
                <span>{group.vendor.ownerName ?? group.vendor.mobileNumber}</span>
              </div>
            </div>
            <button
              aria-label="Close review panel"
              className="btn-icon shrink-0"
              title="Close"
              type="button"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge tone={onboardingTone(group.vendor.onboardingStatus)}>
              {humanizeCode(group.vendor.onboardingStatus)}
            </Badge>
            <Badge tone={vendorStatusTone(group.vendor.vendorStatus)}>
              {humanizeCode(group.vendor.vendorStatus)}
            </Badge>
            <Badge tone="neutral">{group.vendor.category?.name ?? 'Unassigned'}</Badge>
          </div>
        </div>

        <div className="shrink-0 border-b border-border bg-surface px-3">
          <div
            aria-label="Document review sections"
            className="flex gap-4 overflow-x-auto"
            role="tablist"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key

              return (
                <button
                  aria-selected={isActive}
                  className={cn(
                    'relative min-h-10 shrink-0 text-sm font-semibold transition',
                    isActive
                      ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                      : 'text-muted hover:text-foreground',
                  )}
                  key={tab.key}
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {activeTab === 'documents' ? (
            <>
              <div className="rounded-[0.75rem] border border-border bg-surface-muted/45 p-3">
                <DocumentSummaryChips group={group} />
                <p className="mt-2 text-xs leading-5 text-muted">
                  Review each submitted document before moving to vendor approval.
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {group.documents.map((document) => {
                  const canView =
                    document.mediaAssetId &&
                    document.availableActions.includes('VIEW_DOCUMENT')
                  const canVerify =
                    canApproveVendors &&
                    document.availableActions.includes('VERIFY_DOCUMENT')
                  const canReject =
                    canApproveVendors &&
                    document.availableActions.includes('REJECT_DOCUMENT')

                  return (
                    <article
                      className="rounded-[0.8rem] border border-border bg-surface p-3"
                      key={document.documentId}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                              {humanizeCode(document.documentType)}
                            </p>
                            <Badge tone={documentTone(document.status)}>
                              {humanizeCode(document.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted">
                            {document.media?.fileName ?? 'Media not linked'}
                          </p>
                        </div>
                        <Badge tone={mediaTone(document.media?.status)}>
                          {humanizeCode(document.media?.status)}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                        <p className="truncate">
                          {document.media?.mimeType ?? 'No mime'} /{' '}
                          {formatFileSize(document.media?.sizeBytes)}
                        </p>
                        <p className="truncate sm:text-right">
                          Updated {formatDate(document.updatedAt, true)}
                        </p>
                      </div>

                      {document.rejectionReason ? (
                        <div className="mt-2 rounded-[0.65rem] border border-danger/20 bg-danger/10 px-2.5 py-2 text-xs text-danger">
                          {document.rejectionReason}
                        </div>
                      ) : null}

                      {document.warnings.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {document.warnings.map((warning) => (
                            <Badge key={warning} tone="warning">
                              {humanizeCode(warning)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          disabled={previewPending || !canView}
                          size="sm"
                          title={canView ? 'View document' : 'Preview unavailable'}
                          type="button"
                          variant="secondary"
                          onClick={() => onPreviewDocument(document)}
                        >
                          <Eye className="mr-1.5 size-3.5" />
                          View
                        </Button>
                        {canVerify ? (
                          <Button
                            disabled={isSubmitting}
                            size="sm"
                            type="button"
                            onClick={() =>
                              onOpenAction(group, 'VERIFY_DOCUMENT', document)
                            }
                          >
                            <CheckCircle2 className="mr-1.5 size-3.5" />
                            Verify
                          </Button>
                        ) : null}
                        {canReject ? (
                          <Button
                            disabled={isSubmitting}
                            size="sm"
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              onOpenAction(group, 'REJECT_DOCUMENT', document)
                            }
                          >
                            <FileWarning className="mr-1.5 size-3.5" />
                            Resubmit
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          ) : null}

          {activeTab === 'vendorInfo' ? (
            <div className="space-y-2">
              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Contact
                </p>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Owner</span>
                    <span className="min-w-0 text-right font-medium text-foreground">
                      {group.vendor.ownerName ?? 'Not available'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Mobile</span>
                    <span className="min-w-0 text-right font-medium text-foreground">
                      {group.vendor.mobileNumber}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Email</span>
                    <span className="min-w-0 break-all text-right font-medium text-foreground">
                      {group.vendor.businessEmail ?? 'No email'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Business
                </p>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Category</span>
                    <span className="min-w-0 text-right font-medium text-foreground">
                      {group.vendor.category?.name ?? 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">City</span>
                    <span className="min-w-0 text-right font-medium text-foreground">
                      {group.vendor.city || 'No city'}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted">Zone</span>
                    <span className="min-w-0 text-right font-medium text-foreground">
                      {group.vendor.zone?.zoneName ?? 'No zone'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[0.75rem] border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={onboardingTone(group.vendor.onboardingStatus)}>
                    {humanizeCode(group.vendor.onboardingStatus)}
                  </Badge>
                  <Badge tone={vendorStatusTone(group.vendor.vendorStatus)}>
                    {humanizeCode(group.vendor.vendorStatus)}
                  </Badge>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'timeline' ? (
            <div className="space-y-2">
              {group.documents.map((document) => {
                const iconClassName =
                  document.status === 'VERIFIED'
                    ? 'text-success'
                    : document.status === 'REJECTED' || document.status === 'EXPIRED'
                      ? 'text-danger'
                      : 'text-warning'

                return (
                  <div
                    className="flex gap-3 rounded-[0.75rem] border border-border p-3"
                    key={document.documentId}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted',
                        iconClassName,
                      )}
                    >
                      {document.status === 'VERIFIED' ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <FileWarning className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                          {humanizeCode(document.documentType)}
                        </p>
                        <Badge tone={documentTone(document.status)}>
                          {humanizeCode(document.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Updated {formatDate(document.updatedAt, true)}
                      </p>
                      {document.verifiedAt ? (
                        <p className="mt-1 text-xs text-muted">
                          Verified {formatDate(document.verifiedAt, true)}
                        </p>
                      ) : null}
                      {document.rejectionReason ? (
                        <p className="mt-1 text-xs leading-5 text-danger">
                          {document.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onOpenAction(group, 'ADD_NOTE')}
            >
              <MessageSquarePlus className="mr-2 size-4" />
              Add note
            </Button>
            <Button size="sm" type="button" onClick={() => onOpenVendor(group)}>
              <ArrowUpRight className="mr-2 size-4" />
              Open vendor
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

export function VendorDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<DocumentActionTarget | null>(
    null,
  )
  const [showFilters, setFiltersOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { openMediaViewer } = useMediaViewer()
  const { pushToast } = useToast()
  const canApproveVendors = useAuthStore((state) => state.can('vendors:approve'))
  const query = useMemo(() => buildQuery(searchParams), [searchParams])
  const categoryLabel = searchParams.get('categoryLabel') ?? ''
  const queueParam = searchParams.get('documentQueue')

  const updateParams = useCallback(
    (
      updates: Record<string, string | number | null | undefined>,
      options: { resetPage?: boolean } = { resetPage: true },
    ) => {
      const next = new URLSearchParams(searchParams)

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          next.delete(key)
          return
        }

        next.set(key, String(value))
      })

      if (options.resetPage !== false) {
        next.set('page', '1')
      }

      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const clearFilters = () => {
    setSearchParams(new URLSearchParams({ page: '1', limit: String(query.limit) }), {
      replace: true,
    })
  }

  const documentQuery = useQuery({
    queryKey: ['vendor-documents', query],
    queryFn: () => vendorService.getVendorDocuments(query),
    placeholderData: (previousData) => previousData,
    staleTime: 20_000,
  })

  const documents = useMemo(
    () => documentQuery.data?.data ?? [],
    [documentQuery.data?.data],
  )
  const documentGroups = useMemo(() => buildDocumentGroups(documents), [documents])
  const activeQueue = useMemo(
    () => getActiveDocumentQueue(query, queueParam),
    [query, queueParam],
  )
  const visibleDocumentGroups = useMemo(
    () => filterDocumentGroupsByQueue(documentGroups, activeQueue),
    [activeQueue, documentGroups],
  )
  const selectedGroup =
    visibleDocumentGroups.find(
      (group) => group.vendor.vendorId === selectedVendorId,
    ) ?? null
  const pagination = documentQuery.data?.pagination
  const isRefreshing = documentQuery.isFetching && !documentQuery.isLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(documentQuery.dataUpdatedAt)

  const previewMutation = useMutation({
    mutationFn: async (row: VendorDocumentListItem) => {
      const response = await vendorService.getVendorDocumentDownloadTarget(
        row.vendor.vendorId,
        row.documentId,
      )

      return { download: response.data.download, row }
    },
    onMutate: () => setPreviewError(null),
    onSuccess: ({ download, row }) => {
      const mediaItem = buildMediaItem(row, download)

      if (!mediaItem) {
        setPreviewError('Preview is unavailable for this document.')
        return
      }

      openMediaViewer({ items: [mediaItem] })
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
      target,
      values,
    }: {
      target: DocumentActionTarget
      values: VendorActionFormValues
    }) => {
      if (target.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return vendorService.addVendorNote(target.group.vendor.vendorId, {
          note: values.note,
        })
      }

      if (!target.row) {
        throw new Error('Document action needs a selected document.')
      }

      if (target.kind === 'VERIFY_DOCUMENT') {
        return vendorService.verifyVendorDocument(
          target.group.vendor.vendorId,
          target.row.documentId,
          { reason: values.reason },
        )
      }

      if (!values.reason) throw new Error('Resubmission reason is required.')

      return vendorService.rejectVendorDocument(
        target.group.vendor.vendorId,
        target.row.documentId,
        { reason: values.reason },
      )
    },
    onSuccess: (_response, variables) => {
      const toastTitle =
        variables.target.kind === 'ADD_NOTE'
          ? 'Note added'
          : variables.target.kind === 'VERIFY_DOCUMENT'
            ? 'Document verified'
            : 'Resubmission requested'

      pushToast({
        tone: 'success',
        title: toastTitle,
        description: variables.target.group.vendor.shopName,
      })
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['vendor-documents'] })
      void queryClient.invalidateQueries({ queryKey: ['vendors'] })
      void queryClient.invalidateQueries({
        queryKey: ['vendor-detail', variables.target.group.vendor.vendorId],
      })
    },
  })

  const activeFilters = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = []
    const addChip = (key: string, label: string) => {
      chips.push({
        key,
        label,
        onClear: () => {
          const updates: Record<string, null> = { [key]: null }

          if (key === 'categoryId') {
            updates.categoryLabel = null
          }

          updateParams(updates)
        },
      })
    }

    if (query.search) addChip('search', `Search: ${query.search}`)
    if (query.city) addChip('city', `City: ${query.city}`)
    if (query.categoryId) {
      addChip('categoryId', `Category: ${categoryLabel || query.categoryId}`)
    }
    if (query.documentStatus) {
      addChip('documentStatus', `Status: ${humanizeCode(query.documentStatus)}`)
    }
    if (query.documentType) {
      addChip('documentType', `Type: ${humanizeCode(query.documentType)}`)
    }
    if (query.mediaStatus) {
      addChip('mediaStatus', `Media: ${humanizeCode(query.mediaStatus)}`)
    }
    if (query.onboardingStatus) {
      addChip(
        'onboardingStatus',
        `Onboarding: ${humanizeCode(query.onboardingStatus)}`,
      )
    }
    if (query.vendorStatus) {
      addChip('vendorStatus', `Vendor: ${humanizeCode(query.vendorStatus)}`)
    }

    return chips
  }, [categoryLabel, query, updateParams])

  const hasActiveDocumentFilters = activeFilters.length > 0 || activeQueue !== 'all'

  const applyQueue = (queue: DocumentReviewQueueKey) => {
    if (queue === 'all') {
      updateParams({
        documentQueue: null,
        documentStatus: null,
        mediaStatus: null,
      })
      return
    }

    if (queue === 'needsReview') {
      updateParams({
        documentQueue: null,
        documentStatus: 'PENDING',
        mediaStatus: null,
      })
      return
    }

    if (queue === 'rejected') {
      updateParams({
        documentQueue: null,
        documentStatus: 'REJECTED',
        mediaStatus: null,
      })
      return
    }

    if (queue === 'verified') {
      updateParams({
        documentQueue: null,
        documentStatus: 'VERIFIED',
        mediaStatus: null,
      })
      return
    }

    updateParams({
      documentQueue: 'mediaIssue',
      documentStatus: null,
      mediaStatus: null,
    })
  }

  const openDocumentAction = (
    group: VendorDocumentGroup,
    kind: DocumentActionKind,
    row?: VendorDocumentListItem,
  ) => {
    setActionTarget({ group, kind, row })
  }

  const openVendorDetail = (group: VendorDocumentGroup) => {
    navigate(`${routePaths.vendors}/${group.vendor.vendorId}`)
  }

  const actionError =
    actionMutation.error instanceof Error ? actionMutation.error.message : null

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Document Review"
      />

      <main className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(13rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Document Review
              </h2>
              <span
                className={cn(
                  'rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium',
                  isRefreshing ? 'text-primary' : 'text-muted',
                )}
              >
                {refreshStatusLabel}
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search vendor, mobile, file..."
              value={query.search ?? ''}
              onChange={(value) => updateParams({ search: value })}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                aria-expanded={showFilters}
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter className="mr-2 size-4" />
                Filters
                {hasActiveDocumentFilters ? (
                  <span className="ml-1 size-2 rounded-full bg-primary" />
                ) : null}
              </Button>
              <Button
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void documentQuery.refetch()}
              >
                <RefreshCcw
                  className={cn(
                    'mr-2 size-4',
                    isRefreshing && 'animate-spin motion-reduce:animate-none',
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            {documentReviewQueueItems.map((queue) => {
              const isActive = activeQueue === queue.key

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queue.key}
                  type="button"
                  onClick={() => applyQueue(queue.key)}
                >
                  <span>{queue.label}</span>
                </button>
              )
            })}
          </div>

          <ActiveFilterChips chips={activeFilters} onClearAll={clearFilters} />

          {showFilters ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,0.9fr)_minmax(13rem,1fr)_minmax(12rem,1fr)_minmax(13rem,1fr)_minmax(11rem,0.9fr)_minmax(12rem,0.9fr)_minmax(11rem,0.9fr)_auto] lg:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Document status
                  </span>
                  <select
                    className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                    value={query.documentStatus ?? ''}
                    onChange={(event) =>
                      updateParams({
                        documentQueue: null,
                        documentStatus: event.target.value,
                      })
                    }
                  >
                    <option value="">All</option>
                    {documentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeCode(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Document type
                  </span>
                  <select
                    className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                    value={query.documentType ?? ''}
                    onChange={(event) =>
                      updateParams({ documentType: event.target.value })
                    }
                  >
                    <option value="">All types</option>
                    {documentTypes.map((type) => (
                      <option key={type} value={type}>
                        {humanizeCode(type)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">City</span>
                  <Input
                    className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                    placeholder="Bengaluru"
                    value={query.city ?? ''}
                    onChange={(event) => updateParams({ city: event.target.value })}
                  />
                </label>

                <LookupSelect
                  fetchOptions={searchCategoryLookupOptions}
                  label="Category"
                  placeholder="Search category"
                  queryKey={['lookup', 'document-review-categories']}
                  selectedLabel={categoryLabel}
                  value={query.categoryId ?? ''}
                  onChange={(value, option) =>
                    updateParams({
                      categoryId: value,
                      categoryLabel: option?.label ?? null,
                    })
                  }
                />

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Media status
                  </span>
                  <select
                    className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                    value={query.mediaStatus ?? ''}
                    onChange={(event) =>
                      updateParams({
                        documentQueue: null,
                        mediaStatus: event.target.value,
                      })
                    }
                  >
                    <option value="">All media</option>
                    {mediaStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeCode(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Onboarding
                  </span>
                  <select
                    className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                    value={query.onboardingStatus ?? ''}
                    onChange={(event) =>
                      updateParams({ onboardingStatus: event.target.value })
                    }
                  >
                    <option value="">All</option>
                    {onboardingStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeCode(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">
                    Vendor status
                  </span>
                  <select
                    className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                    value={query.vendorStatus ?? ''}
                    onChange={(event) =>
                      updateParams({ vendorStatus: event.target.value })
                    }
                  >
                    <option value="">All</option>
                    {vendorStatuses.map((status) => (
                      <option key={status} value={status}>
                        {humanizeCode(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  className="w-full lg:w-auto"
                  disabled={!hasActiveDocumentFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {previewError ? (
          <div className="mx-3 mt-3 rounded-surface border border-danger/20 bg-danger/10 p-3 text-sm text-danger sm:mx-4">
            {previewError}
          </div>
        ) : null}

        <div
          className={cn(
            'grid min-h-0 flex-1',
            selectedGroup &&
              'xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-3 xl:overflow-hidden xl:p-3',
          )}
        >
          <section className="flex min-h-0 flex-col overflow-hidden bg-surface">
            <div className="hidden gap-2 border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid xl:grid-cols-[minmax(16rem,1fr)_15rem_11rem_10rem_11.5rem]">
              <span>Vendor</span>
              <span>Documents</span>
              <span>State</span>
              <span>Updated</span>
              <span className="text-right">Actions</span>
            </div>

            {documentQuery.isError ? (
              <div className="p-3">
                <ErrorState
                  description="Retry the document queue."
                  title="Document data unavailable"
                  onRetry={() => void documentQuery.refetch()}
                />
              </div>
            ) : documentQuery.isLoading ? (
              <VendorDocumentGroupSkeleton />
            ) : visibleDocumentGroups.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  actionLabel={hasActiveDocumentFilters ? 'Clear filters' : undefined}
                  description={
                    hasActiveDocumentFilters
                      ? 'No matches.'
                      : 'No vendor documents need review.'
                  }
                  title="No documents"
                  onAction={hasActiveDocumentFilters ? clearFilters : undefined}
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                {visibleDocumentGroups.map((group) => (
                  <VendorDocumentGroupRow
                    group={group}
                    isSelected={selectedVendorId === group.vendor.vendorId}
                    key={group.vendor.vendorId}
                    onAddNote={(nextGroup) =>
                      openDocumentAction(nextGroup, 'ADD_NOTE')
                    }
                    onOpenVendor={openVendorDetail}
                    onReview={(nextGroup) =>
                      setSelectedVendorId(nextGroup.vendor.vendorId)
                    }
                  />
                ))}
              </div>
            )}

            {pagination ? (
              <DocumentPagination
                pagination={pagination}
                visibleVendorCount={visibleDocumentGroups.length}
                onPageChange={(page) =>
                  updateParams({ page }, { resetPage: false })
                }
                onPageSizeChange={(limit) =>
                  updateParams({ limit, page: 1 }, { resetPage: false })
                }
              />
            ) : null}
          </section>

          {selectedGroup ? (
            <VendorDocumentDetailWorkbench
              canApproveVendors={canApproveVendors}
              group={selectedGroup}
              isSubmitting={actionMutation.isPending}
              previewPending={previewMutation.isPending}
              onClose={() => setSelectedVendorId(null)}
              onOpenAction={openDocumentAction}
              onOpenVendor={openVendorDetail}
              onPreviewDocument={(document) => previewMutation.mutate(document)}
            />
          ) : null}
        </div>
      </main>

      {actionTarget ? (
        <VendorActionModal
          action={{
            kind: actionTarget.kind,
            document: actionTarget.row
              ? toActionDocument(actionTarget.row)
              : undefined,
          }}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          vendor={vendorActionContext(actionTarget.group)}
          onClose={() => {
            if (!actionMutation.isPending) setActionTarget(null)
          }}
          onSubmit={(values) =>
            actionMutation.mutate({ target: actionTarget, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
