import {
  ArrowUpRight,
  Download,
  Eye,
  MessageSquarePlus,
  RefreshCcw,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { filterInputClass, Input } from '../../../components/ui/Input'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { OverflowText } from '../../../components/ui/OverflowText'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { RowActionMenu, type RowActionMenuItem } from '../../../components/ui/RowActionMenu'
import { routePaths } from '../../../config/routes'
import { useToast } from '../../../hooks/useToast'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { formatDate } from '../../../utils/formatDate'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
} from '../../vendors/components/VendorActionModal'
import { vendorService } from '../../vendors/services/vendor.service'
import {
  getOnboardingStatusTone,
  getVendorStatusTone,
  humanizeCode,
} from '../../vendors/vendorPresenters'
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

const VENDOR_DOCUMENTS_LIST_STORAGE_KEY = 'servicegram.vendor-documents.list.v1'
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

type DocumentActionKind = Extract<VendorActionKind, 'ADD_NOTE'>
type DocumentReviewQueueKey =
  | 'all'
  | 'needsReview'
  | 'rejected'
  | 'mediaIssue'
  | 'verified'

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

function positiveIntegerParam(value: string | null, fallback: number) {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
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
        <Badge tone="neutral">{group.counts.verified} verified</Badge>
      ) : null}
    </div>
  )
}

interface RowActionsProps {
  group: VendorDocumentGroup
  onAddNote: (group: VendorDocumentGroup) => void
  onOpenVendor: (group: VendorDocumentGroup) => void
  onReview: (group: VendorDocumentGroup) => void
}

/** Mirrors CustomersPage's RowActions: primary action stays inline, everything else behind the overflow menu. */
function RowActions({ group, onAddNote, onOpenVendor, onReview }: RowActionsProps) {
  const needsAction = group.documents.some(documentNeedsAdminAction)

  const menuItems: RowActionMenuItem[] = [
    {
      icon: <MessageSquarePlus className="size-3.5" />,
      key: 'add-note',
      label: 'Add note',
      onClick: () => onAddNote(group),
    },
    {
      icon: <ArrowUpRight className="size-3.5" />,
      key: 'open-vendor',
      label: 'Open vendor detail',
      onClick: () => onOpenVendor(group),
    },
  ]

  return (
    <div className="flex items-center gap-0.5">
      <button
        aria-label={`Review documents for ${group.vendor.shopName}`}
        className="inline-flex size-7 items-center justify-center rounded-[0.5rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={needsAction ? 'Review documents' : 'Open review'}
        type="button"
        onClick={() => onReview(group)}
      >
        <Eye className="size-4" />
      </button>

      <RowActionMenu
        ariaLabel={`More actions for ${group.vendor.shopName}`}
        items={menuItems}
      />
    </div>
  )
}

export function VendorDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [actionTarget, setActionTarget] = useState<DocumentActionTarget | null>(
    null,
  )
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
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

  const applyQueue = (queue: DocumentReviewQueueKey) => {
    if (queue === 'all') {
      updateParams({ documentQueue: null, documentStatus: null, mediaStatus: null })
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

    updateParams({ documentQueue: 'mediaIssue', documentStatus: null, mediaStatus: null })
  }

  const openDocumentAction = (group: VendorDocumentGroup, kind: DocumentActionKind) => {
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

  const queueTabs: DataListQueueTab[] = documentReviewQueueItems.map((item) => ({
    key: item.key,
    label: item.label,
    tone: item.key === 'rejected' || item.key === 'mediaIssue' ? 'danger' : undefined,
  }))

  const appliedFilterCount = [
    query.documentType,
    query.city,
    query.categoryId,
    query.onboardingStatus,
    query.vendorStatus,
  ].filter(Boolean).length

  const columns: DataListColumn<VendorDocumentGroup>[] = useMemo(
    () => [
      {
        id: 'vendor',
        label: 'Vendor',
        defaultWidth: 260,
        minWidth: 200,
        maxWidth: 320,
        priority: 1,
        grow: true,
        locked: true,
        render: (group) => {
          const ownerLabel = group.vendor.ownerName ?? group.vendor.mobileNumber

          return (
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <OverflowText
                  as="p"
                  className="text-sm font-semibold text-foreground"
                  title={group.vendor.shopName}
                >
                  {group.vendor.shopName}
                </OverflowText>
                <Badge tone={getVendorStatusTone(group.vendor.vendorStatus)}>
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
          )
        },
      },
      {
        id: 'documents',
        label: 'Documents',
        defaultWidth: 220,
        minWidth: 180,
        priority: 1,
        render: (group) => <DocumentSummaryChips group={group} />,
      },
      {
        id: 'state',
        label: 'State',
        defaultWidth: 130,
        minWidth: 110,
        priority: 1,
        render: (group) => {
          const state = getGroupReviewState(group)
          return <Badge tone={state.tone}>{state.label}</Badge>
        },
      },
      {
        id: 'category',
        label: 'Category',
        defaultWidth: 130,
        minWidth: 110,
        priority: 3,
        render: (group) => (
          <span className={group.vendor.category ? 'text-foreground' : 'text-muted'}>
            {group.vendor.category?.name ?? 'Unassigned'}
          </span>
        ),
      },
      {
        id: 'onboarding',
        label: 'Onboarding',
        defaultWidth: 140,
        minWidth: 120,
        priority: 3,
        render: (group) => (
          <Badge tone={getOnboardingStatusTone(group.vendor.onboardingStatus)}>
            {humanizeCode(group.vendor.onboardingStatus)}
          </Badge>
        ),
      },
      {
        id: 'updated',
        label: 'Updated',
        defaultWidth: 150,
        minWidth: 120,
        priority: 2,
        render: (group) => (
          <div className="min-w-0 text-sm">
            <OverflowText
              as="p"
              className="text-foreground"
              title={formatDate(group.latestUpdatedAt, true)}
            >
              {formatDate(group.latestUpdatedAt, true)}
            </OverflowText>
            <OverflowText
              as="p"
              className="mt-0.5 text-xs text-muted"
              title={group.vendor.city || 'No city'}
            >
              {group.vendor.city || 'No city'}
            </OverflowText>
          </div>
        ),
      },
    ],
    [],
  )

  const selectedGroups = useMemo(
    () =>
      visibleDocumentGroups.filter((group) =>
        selectedVendorIds.includes(group.vendor.vendorId),
      ),
    [selectedVendorIds, visibleDocumentGroups],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('vendor-documents'), selectedGroups, [
      { header: 'Vendor ID', value: (group) => group.vendor.vendorId },
      { header: 'Public vendor ID', value: (group) => group.vendor.publicVendorId },
      { header: 'Shop name', value: (group) => group.vendor.shopName },
      { header: 'Owner', value: (group) => group.vendor.ownerName },
      { header: 'City', value: (group) => group.vendor.city },
      { header: 'Category', value: (group) => group.vendor.category?.name ?? '' },
      { header: 'Review state', value: (group) => getGroupReviewState(group).label },
      { header: 'Pending', value: (group) => group.counts.pending },
      { header: 'Rejected', value: (group) => group.counts.rejected },
      { header: 'Media issues', value: (group) => group.counts.mediaIssues },
      { header: 'Verified', value: (group) => group.counts.verified },
      { header: 'Total documents', value: (group) => group.counts.total },
      { header: 'Last updated', value: (group) => group.latestUpdatedAt },
    ])
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh document review"
            className="h-9"
            disabled={documentQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void documentQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                documentQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Document Review"
      />

      <DataList
        activeQueue={activeQueue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint="Try a different search term or clear the active filters."
        emptyMessage="No documents match these filters"
        errorMessage="Could not load the document review queue."
        filters={
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Document status
              </span>
              <select
                className={filterInputClass}
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

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Document type
              </span>
              <select
                className={filterInputClass}
                value={query.documentType ?? ''}
                onChange={(event) => updateParams({ documentType: event.target.value })}
              >
                <option value="">All types</option>
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {humanizeCode(type)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">City</span>
              <Input
                className={filterInputClass}
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

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Media status
              </span>
              <select
                className={filterInputClass}
                value={query.mediaStatus ?? ''}
                onChange={(event) =>
                  updateParams({ documentQueue: null, mediaStatus: event.target.value })
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

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Onboarding
              </span>
              <select
                className={filterInputClass}
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

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Vendor status
              </span>
              <select
                className={filterInputClass}
                value={query.vendorStatus ?? ''}
                onChange={(event) => updateParams({ vendorStatus: event.target.value })}
              >
                <option value="">All</option>
                {vendorStatuses.map((status) => (
                  <option key={status} value={status}>
                    {humanizeCode(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
        getRowId={(group) => group.vendor.vendorId}
        isError={documentQuery.isError}
        isLoading={documentQuery.isLoading}
        pagination={{
          page: query.page ?? 1,
          pageSize: query.limit ?? DEFAULT_PAGE_SIZE,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: (page) => updateParams({ page }, { resetPage: false }),
          onPageSizeChange: (limit) =>
            updateParams({ limit, page: 1 }, { resetPage: false }),
        }}
        queueTabs={queueTabs}
        rowActions={(group) => (
          <RowActions
            group={group}
            onAddNote={(target) => openDocumentAction(target, 'ADD_NOTE')}
            onOpenVendor={openVendorDetail}
            onReview={openDocumentReviewDetail}
          />
        )}
        rowActionsWidth={76}
        rows={visibleDocumentGroups}
        search={query.search ?? ''}
        searchPlaceholder="Search vendor, mobile, file..."
        selection={{
          selectedIds: selectedVendorIds,
          onSelectionChange: setSelectedVendorIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          ),
        }}
        defaultDensity="comfortable"
        storageKey={VENDOR_DOCUMENTS_LIST_STORAGE_KEY}
        onQueueChange={(key) => applyQueue(key as DocumentReviewQueueKey)}
        onResetFilters={clearFilters}
        onRetry={() => void documentQuery.refetch()}
        onRowClick={openDocumentReviewDetail}
        onSearchChange={(value) => updateParams({ search: value })}
      />

      {actionTarget ? (
        <VendorActionModal
          action={{ kind: actionTarget.kind }}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          vendor={vendorActionContext(actionTarget.group)}
          onClose={() => {
            if (!actionMutation.isPending) setActionTarget(null)
          }}
          onSubmit={(values) => actionMutation.mutate({ target: actionTarget, values })}
        />
      ) : null}
    </PageContainer>
  )
}
