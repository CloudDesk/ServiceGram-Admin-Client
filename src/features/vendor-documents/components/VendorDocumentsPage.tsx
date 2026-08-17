import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
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
import { OverflowText } from '../../../components/ui/OverflowText'
import { Skeleton } from '../../../components/ui/Skeleton'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { useToast } from '../../../hooks/useToast'
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
  'ADD_NOTE'
>
type DocumentReviewQueueKey =
  | 'all'
  | 'needsReview'
  | 'rejected'
  | 'mediaIssue'
  | 'verified'

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

function vendorStatusTone(status: VendorStatus): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED' || status === 'INACTIVE') return 'danger'
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
  const hasReviewIssue =
    group.counts.pending > 0 ||
    group.counts.rejected > 0 ||
    group.counts.mediaIssues > 0

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden">
      {group.counts.pending ? (
        <Badge tone="warning">{group.counts.pending} pending</Badge>
      ) : null}
      {group.counts.rejected ? (
        <Badge tone="danger">{group.counts.rejected} rejected</Badge>
      ) : null}
      {group.counts.mediaIssues ? (
        <Badge tone="danger">{group.counts.mediaIssues} media</Badge>
      ) : null}
      {!hasReviewIssue && group.counts.verified ? (
        <Badge tone="success">
          {group.counts.verified}/{group.counts.total} verified
        </Badge>
      ) : null}
      {hasReviewIssue && group.counts.verified ? (
        <OverflowText
          className="text-xs text-muted"
          title={`${group.counts.verified} verified documents`}
        >
          {group.counts.verified} verified
        </OverflowText>
      ) : null}
      {!hasReviewIssue && !group.counts.verified ? (
        <Badge tone="neutral">
          {group.counts.verified} verified
        </Badge>
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
  const ownerLabel = group.vendor.ownerName ?? group.vendor.mobileNumber
  const updatedAtLabel = formatDate(group.latestUpdatedAt, true)
  const cityLabel = group.vendor.city || 'No city'

  return (
    <article
      aria-label={`Review documents for ${group.vendor.shopName}`}
      aria-selected={isSelected}
      className={cn(
        'workbench-grid-row grid min-w-0 cursor-pointer gap-2 border-b border-border bg-surface px-3 py-2 transition last:border-b-0 hover:bg-surface-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset xl:grid-cols-[minmax(16rem,1fr)_15rem_11rem_10rem_11.5rem] xl:items-center',
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
          <OverflowText
            as="p"
            className="text-sm font-semibold text-foreground"
            title={group.vendor.shopName}
          >
            {group.vendor.shopName}
          </OverflowText>
          <Badge tone={vendorStatusTone(group.vendor.vendorStatus)}>
            {humanizeCode(group.vendor.vendorStatus)}
          </Badge>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 overflow-hidden text-xs text-muted">
          <span className="shrink-0" title={group.vendor.publicVendorId}>
            {group.vendor.publicVendorId}
          </span>
          <span className="shrink-0 text-border">/</span>
          <OverflowText title={ownerLabel}>{ownerLabel}</OverflowText>
        </div>
      </div>

      <div className="min-w-0">
        <DocumentSummaryChips group={group} />
      </div>

      <div className="min-w-0">
        <Badge tone={reviewState.tone}>{reviewState.label}</Badge>
      </div>

      <div className="min-w-0 text-sm">
        <OverflowText as="p" className="text-foreground" title={updatedAtLabel}>
          {updatedAtLabel}
        </OverflowText>
        <OverflowText as="p" className="mt-0.5 text-xs text-muted" title={cityLabel}>
          {cityLabel}
        </OverflowText>
      </div>

      <div className="workbench-sticky-action-cell flex flex-nowrap items-center justify-start gap-1.5 pl-2 xl:justify-end">
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

export function VendorDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [actionTarget, setActionTarget] = useState<DocumentActionTarget | null>(
    null,
  )
  const [showFilters, setFiltersOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
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
  const pagination = documentQuery.data?.pagination
  const isRefreshing = documentQuery.isFetching && !documentQuery.isLoading
  const isDocumentsLoading = documentQuery.isLoading
  const refetchDocuments = documentQuery.refetch
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(documentQuery.dataUpdatedAt)
  const refreshActionNode = useMemo(
    () => (
      <Button
        aria-label={
          isRefreshing ? 'Refreshing document review' : 'Refresh document review'
        }
        className="h-9 min-w-9 px-2.5 sm:min-w-[6rem] sm:px-3"
        disabled={isDocumentsLoading}
        size="sm"
        title={refreshStatusLabel}
        type="button"
        variant="secondary"
        onClick={() => void refetchDocuments()}
      >
        <RefreshCcw
          className={cn(
            'size-4 sm:mr-2',
            isRefreshing && 'animate-spin motion-reduce:animate-none',
          )}
        />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    ),
    [
      isDocumentsLoading,
      isRefreshing,
      refetchDocuments,
      refreshStatusLabel,
    ],
  )

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: DocumentActionTarget
      values: VendorActionFormValues
    }) => {
      if (!values.note) throw new Error('Internal note is required.')

      return vendorService.addVendorNote(target.group.vendor.vendorId, {
        note: values.note,
      })
    },
    onSuccess: (_response, variables) => {
      pushToast({
        tone: 'success',
        title: 'Note added',
        description: variables.target.group.vendor.shopName,
      })
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['vendor-documents'] })
      void queryClient.invalidateQueries({ queryKey: ['vendors'] })
      void queryClient.invalidateQueries({
        queryKey: ['vendor-overview', variables.target.group.vendor.vendorId],
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
    if (activeQueue === 'mediaIssue') {
      chips.push({
        key: 'documentQueue',
        label: 'Queue: Media issue',
        onClear: () => updateParams({ documentQueue: null }),
      })
    }

    return chips
  }, [activeQueue, categoryLabel, query, updateParams])

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
  ) => {
    setActionTarget({ group, kind })
  }

  const openVendorDetail = (group: VendorDocumentGroup) => {
    navigate(`${routePaths.vendors}/${group.vendor.vendorId}`)
  }

  const openDocumentReviewDetail = (group: VendorDocumentGroup) => {
    navigate(`${routePaths.vendorDocuments}/${group.vendor.vendorId}`)
  }

  const actionError =
    actionMutation.error instanceof Error ? actionMutation.error.message : null

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={refreshActionNode}
        layout="workspace"
        placement="topbar"
        title="Document Review"
      />

      <main className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1">
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(22rem,1fr)_auto] xl:items-center">
            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search vendor, mobile, file..."
              value={query.search ?? ''}
              onChange={(value) => updateParams({ search: value })}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <label className="min-w-[11rem]">
                <span className="sr-only">Document review queue</span>
                <select
                  aria-label="Document review queue"
                  className={DOCUMENT_FILTER_CONTROL_CLASS_NAME}
                  value={activeQueue}
                  onChange={(event) =>
                    applyQueue(event.target.value as DocumentReviewQueueKey)
                  }
                >
                  {documentReviewQueueItems.map((queue) => (
                    <option key={queue.key} value={queue.key}>
                      {queue.label}
                    </option>
                  ))}
                </select>
              </label>

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
            </div>
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

        <div className="grid min-h-0 flex-1">
          <section className="flex min-h-0 flex-col overflow-hidden bg-surface">
            <div className="hidden gap-2 border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid xl:grid-cols-[minmax(16rem,1fr)_15rem_11rem_10rem_11.5rem]">
              <span>Vendor</span>
              <span>Documents</span>
              <span>State</span>
              <span>Updated</span>
              <div className="workbench-sticky-action-head flex min-w-0 pr-3">
                <span className="truncate">Actions</span>
              </div>
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
                    isSelected={false}
                    key={group.vendor.vendorId}
                    onAddNote={(nextGroup) =>
                      openDocumentAction(nextGroup, 'ADD_NOTE')
                    }
                    onOpenVendor={openVendorDetail}
                    onReview={openDocumentReviewDetail}
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

        </div>
      </main>

      {actionTarget ? (
        <VendorActionModal
          action={{
            kind: actionTarget.kind,
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
