import { Download, MoreHorizontal, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { vendorService } from '../services/vendor.service'
import {
  formatDateSafe,
  getApprovalBlockMessage,
  getDocumentSummaryLabel,
  getDocumentSummaryTone,
  getOnboardingStatusTone,
  getPayoutAccountLabel,
  getPayoutAccountTone,
  getVendorActionSource,
  getVendorStatusTone,
  getVisibleVendorActions,
  humanizeCode,
  getRowPrimaryAction,
  isHighRiskVendorAction,
  vendorActionLabel,
  vendorLocationLabel,
  type VendorListActionKind,
  type VendorTone,
} from '../vendorPresenters'
import type {
  VendorListItem,
  VendorListQueryParams,
  VendorOnboardingStatus,
  VendorStatus,
} from '../types/vendor.types'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionSelection,
} from './VendorActionModal'

const VENDOR_LIST_STORAGE_KEY = 'servicegram.vendors.list.v1'
const DEFAULT_PAGE_SIZE = 50

type VendorQueueKey =
  | 'active'
  | 'onboarding'
  | 'underReview'
  | 'documentsPending'
  | 'rejected'
  | 'suspended'

interface VendorActionTarget {
  action: VendorActionSelection
  vendor: VendorListItem
}

/** Maps a queue chip onto the endpoint and filters that define it. */
const VENDOR_QUEUES: Record<
  VendorQueueKey,
  {
    label: string
    source: 'list' | 'onboarding'
    vendorStatus?: VendorStatus
    onboardingStatus?: VendorOnboardingStatus
    tone?: 'neutral' | 'warning' | 'danger'
  }
> = {
  active: { label: 'Active', source: 'list', vendorStatus: 'ACTIVE' },
  onboarding: { label: 'Onboarding', source: 'onboarding', tone: 'warning' },
  underReview: {
    label: 'Under review',
    source: 'onboarding',
    onboardingStatus: 'UNDER_REVIEW',
    tone: 'warning',
  },
  documentsPending: {
    label: 'Docs pending',
    source: 'onboarding',
    onboardingStatus: 'DOCUMENTS_PENDING',
    tone: 'warning',
  },
  rejected: {
    label: 'Rejected',
    source: 'onboarding',
    onboardingStatus: 'REJECTED',
    tone: 'danger',
  },
  suspended: {
    label: 'Suspended',
    source: 'list',
    vendorStatus: 'SUSPENDED',
    tone: 'danger',
  },
}

function badgeTone(tone: VendorTone) {
  if (tone === 'success') return 'success' as const
  if (tone === 'danger') return 'danger' as const
  if (tone === 'warning') return 'warning' as const
  return 'neutral' as const
}

interface RowActionsProps {
  vendor: VendorListItem
  canApproveVendors: boolean
  canUpdateVendors: boolean
  onAction: (vendor: VendorListItem, kind: VendorListActionKind) => void
}

/**
 * Approve is the recommended action for most of this queue, so it renders in
 * the row. It is disabled with an explanation when documents block it, rather
 * than hidden — a missing button reads as a bug.
 */
function RowActions({
  canApproveVendors,
  canUpdateVendors,
  onAction,
  vendor,
}: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const availableActions = getVisibleVendorActions(getVendorActionSource(vendor))
  const canRun = (kind: VendorListActionKind) => {
    if (kind === 'APPROVE' || kind === 'REJECT') return canApproveVendors
    return canUpdateVendors
  }

  const candidate = getRowPrimaryAction(vendor)
  const primaryAction = candidate && canRun(candidate) ? candidate : null
  const approvalBlock =
    primaryAction === 'APPROVE' ? getApprovalBlockMessage(vendor) : null

  const menuActions = availableActions.filter(
    (kind) => kind !== primaryAction && canRun(kind),
  )

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {primaryAction ? (
        <Button
          className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
          disabled={Boolean(approvalBlock)}
          size="xs"
          title={approvalBlock ?? vendorActionLabel(primaryAction)}
          type="button"
          variant={isHighRiskVendorAction(primaryAction) ? 'danger' : 'primary'}
          onClick={() => onAction(vendor, primaryAction)}
        >
          {vendorActionLabel(primaryAction)}
        </Button>
      ) : null}

      {menuActions.length ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`More actions for ${vendor.shopName}`}
            className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-[0.4rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-3.5" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              {menuActions.map((kind) => (
                <button
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                    isHighRiskVendorAction(kind) && 'text-danger',
                  )}
                  key={kind}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onAction(vendor, kind)
                  }}
                >
                  {vendorActionLabel(kind)}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function VendorsPage({
  listHref = routePaths.vendors,
}: {
  listHref?: string
} = {}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const canApproveVendors = usePermission('vendors:approve')
  const canUpdateVendors = usePermission('vendors:update')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<VendorQueueKey>('active')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<VendorActionTarget | null>(null)

  const activeQueue = VENDOR_QUEUES[queue]

  const query = useMemo<VendorListQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      vendorStatus: activeQueue.vendorStatus,
      onboardingStatus: activeQueue.onboardingStatus,
    }),
    [activeQueue, city, limit, page, search],
  )

  const vendorsQuery = useQuery({
    queryKey: ['vendors', queue, query],
    queryFn: () =>
      activeQueue.source === 'onboarding'
        ? vendorService.getVendorOnboardingQueue(query)
        : vendorService.getVendorList(query),
  })

  const vendors = useMemo(() => vendorsQuery.data?.data ?? [], [vendorsQuery.data])
  const pagination = vendorsQuery.data?.pagination

  const countBase = useMemo<VendorListQueryParams>(
    () => ({
      page: 1,
      limit: 1,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
    }),
    [city, search],
  )

  /**
   * Queue counts span the whole result set, and each queue is a different
   * endpoint/filter pair, so they are fetched together and cached as one.
   */
  const queueCountsQuery = useQuery({
    queryKey: ['vendors', 'queue-counts', countBase],
    queryFn: async () => {
      const keys = Object.keys(VENDOR_QUEUES) as VendorQueueKey[]
      const responses = await Promise.all(
        keys.map((key) => {
          const definition = VENDOR_QUEUES[key]
          const params: VendorListQueryParams = {
            ...countBase,
            vendorStatus: definition.vendorStatus,
            onboardingStatus: definition.onboardingStatus,
          }

          return definition.source === 'onboarding'
            ? vendorService.getVendorOnboardingQueue(params)
            : vendorService.getVendorList(params)
        }),
      )

      return Object.fromEntries(
        keys.map((key, index) => [key, responses[index]?.pagination.totalItems ?? 0]),
      ) as Record<VendorQueueKey, number>
    },
    placeholderData: (previousData) => previousData,
  })

  const counts = queueCountsQuery.data

  const queueTabs: DataListQueueTab[] = (
    Object.keys(VENDOR_QUEUES) as VendorQueueKey[]
  ).map((key) => ({
    key,
    label: VENDOR_QUEUES[key].label,
    count: counts?.[key],
    tone: VENDOR_QUEUES[key].tone,
  }))

  const clearSeededParams = () => {
    const seededKeys = ['search', 'city', 'categoryId', 'onboardingStatus', 'vendorStatus']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const openAction = (vendor: VendorListItem, kind: VendorListActionKind) => {
    setActionError(null)
    setActionTarget({ action: { kind }, vendor })
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: VendorActionTarget
      values: VendorActionFormValues
    }) => {
      const { action, vendor } = target

      if (action.kind === 'APPROVE') {
        const approvalBlockMessage = getApprovalBlockMessage(vendor)
        if (approvalBlockMessage) throw new Error(approvalBlockMessage)

        return vendorService.approveVendor(vendor.vendorId, { reason: values.reason })
      }

      if (action.kind === 'REJECT') {
        if (!values.reason) throw new Error('Rejection reason is required.')
        return vendorService.rejectVendor(vendor.vendorId, { reason: values.reason })
      }

      if (action.kind === 'REQUEST_DOCUMENTS') {
        if (!values.reason) throw new Error('Document request reason is required.')

        return vendorService.requestVendorDocuments(vendor.vendorId, {
          reason: values.reason,
          requestedDocumentTypes: values.requestedDocumentTypes,
        })
      }

      if (action.kind === 'SUSPEND') {
        if (!values.reason) throw new Error('Suspension reason is required.')
        return vendorService.suspendVendor(vendor.vendorId, { reason: values.reason })
      }

      if (action.kind === 'REACTIVATE') {
        if (!values.reason) throw new Error('Reactivation reason is required.')
        return vendorService.reactivateVendor(vendor.vendorId, { reason: values.reason })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')
        return vendorService.addVendorNote(vendor.vendorId, { note: values.note })
      }

      throw new Error('Unsupported vendor action from list view.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['vendors'] })
      void queryClient.invalidateQueries({
        queryKey: ['vendor-detail', variables.target.vendor.vendorId],
      })
      void queryClient.invalidateQueries({ queryKey: ['vendor-onboarding'] })
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Vendor action failed.')
    },
  })

  const columns: DataListColumn<VendorListItem>[] = useMemo(
    () => [
      {
        id: 'vendor',
        label: 'Vendor',
        defaultWidth: 220,
        minWidth: 180,
        priority: 1,
        grow: true,
        locked: true,
        render: (vendor) => (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium text-foreground">
              {vendor.shopName}
            </span>
            <span className="shrink-0 text-xs text-muted">
              {vendor.publicVendorId}
            </span>
          </div>
        ),
      },
      {
        id: 'vendorStatus',
        label: 'Status',
        defaultWidth: 100,
        minWidth: 92,
        priority: 1,
        render: (vendor) => (
          <Badge tone={badgeTone(getVendorStatusTone(vendor.vendorStatus))}>
            {humanizeCode(vendor.vendorStatus)}
          </Badge>
        ),
      },
      {
        id: 'onboarding',
        label: 'Onboarding',
        defaultWidth: 140,
        minWidth: 120,
        priority: 1,
        render: (vendor) => (
          <span
            className="min-w-0 truncate"
            title={humanizeCode(vendor.onboardingStatus)}
          >
            <Badge tone={badgeTone(getOnboardingStatusTone(vendor.onboardingStatus))}>
              {humanizeCode(vendor.onboardingStatus)}
            </Badge>
          </span>
        ),
      },
      {
        id: 'documents',
        label: 'Docs',
        defaultWidth: 76,
        minWidth: 68,
        priority: 2,
        align: 'right',
        render: (vendor) => (
          <span
            className={cn(
              'tabular-nums',
              getDocumentSummaryTone(vendor) === 'danger' && 'text-danger',
              getDocumentSummaryTone(vendor) === 'warning' && 'text-warning',
              getDocumentSummaryTone(vendor) === 'success' && 'text-success',
            )}
            title="Verified of total documents"
          >
            {getDocumentSummaryLabel(vendor)}
          </span>
        ),
      },
      {
        id: 'payout',
        label: 'Payout',
        defaultWidth: 130,
        minWidth: 110,
        priority: 2,
        render: (vendor) => (
          <span
            className={cn(
              'truncate',
              getPayoutAccountTone(vendor) === 'danger' && 'text-danger',
              getPayoutAccountTone(vendor) === 'warning' && 'text-warning',
            )}
          >
            {getPayoutAccountLabel(vendor)}
          </span>
        ),
      },
      {
        id: 'signals',
        label: 'Signals',
        defaultWidth: 70,
        minWidth: 62,
        priority: 1,
        render: (vendor) =>
          vendor.warnings.length ? (
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-[0.35rem] bg-warning/12 px-1.5 text-xs font-semibold tabular-nums text-warning"
              title={vendor.warnings.join(', ')}
            >
              {vendor.warnings.length}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        id: 'location',
        label: 'Location',
        defaultWidth: 150,
        minWidth: 120,
        priority: 3,
        render: (vendor) => (
          <span className="truncate text-muted">{vendorLocationLabel(vendor)}</span>
        ),
      },
      {
        id: 'category',
        label: 'Category',
        defaultWidth: 140,
        minWidth: 115,
        priority: 3,
        defaultHidden: true,
        render: (vendor) => (
          <span className="truncate text-muted">
            {vendor.category?.name ?? '—'}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (vendor) => (
          <span className="text-muted">{formatDateSafe(vendor.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedVendors = useMemo(
    () => vendors.filter((vendor) => selectedIds.includes(vendor.vendorId)),
    [selectedIds, vendors],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('vendors'), selectedVendors, [
      { header: 'Vendor ID', value: (vendor) => vendor.publicVendorId },
      { header: 'Shop name', value: (vendor) => vendor.shopName },
      { header: 'Owner', value: (vendor) => vendor.ownerName },
      { header: 'Mobile', value: (vendor) => vendor.mobileNumber },
      { header: 'Vendor status', value: (vendor) => vendor.vendorStatus },
      { header: 'Onboarding status', value: (vendor) => vendor.onboardingStatus },
      { header: 'City', value: (vendor) => vendor.address.city ?? '' },
      { header: 'Zone', value: (vendor) => vendor.address.zone?.zoneName ?? '' },
      { header: 'Category', value: (vendor) => vendor.category?.name ?? '' },
      {
        header: 'Documents verified',
        value: (vendor) => vendor.documentSummary?.verified ?? 0,
      },
      { header: 'Documents total', value: (vendor) => vendor.documentSummary?.total ?? 0 },
      { header: 'Payout', value: (vendor) => getPayoutAccountLabel(vendor) },
      { header: 'Signals', value: (vendor) => vendor.warnings.join('; ') },
    ])
  }

  const filterControlClass =
    'h-9 w-full rounded-[0.55rem] border border-border bg-surface px-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30'

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <Button
            aria-label="Refresh vendors"
            className="h-9"
            disabled={vendorsQuery.isLoading}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void vendorsQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4 sm:mr-2',
                vendorsQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
        layout="workspace"
        placement="topbar"
        title="Vendors"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={city.trim() ? 1 : 0}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No vendors match these filters"
        errorMessage="Could not load vendors."
        filters={
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">City</span>
            <input
              className={filterControlClass}
              placeholder="Any city"
              value={city}
              onChange={(event) => {
                setCity(event.target.value)
                setPage(1)
              }}
            />
          </label>
        }
        getRowId={(vendor) => vendor.vendorId}
        isError={vendorsQuery.isError}
        isLoading={vendorsQuery.isLoading}
        pagination={{
          page,
          pageSize: limit,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        queueTabs={queueTabs}
        rowActions={(vendor) => (
          <RowActions
            canApproveVendors={canApproveVendors}
            canUpdateVendors={canUpdateVendors}
            vendor={vendor}
            onAction={openAction}
          />
        )}
        rowActionsWidth={140}
        rows={vendors}
        search={search}
        searchPlaceholder="Search shop, owner, mobile…"
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          ),
        }}
        storageKey={VENDOR_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as VendorQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setCity('')
          setPage(1)
        }}
        onRetry={() => void vendorsQuery.refetch()}
        onRowClick={(vendor) => navigate(`${listHref}/${vendor.vendorId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />

      {actionTarget ? (
        <VendorActionModal
          action={actionTarget.action}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          key={`${actionTarget.vendor.vendorId}-${actionTarget.action.kind}`}
          vendor={actionTarget.vendor}
          onClose={() => {
            if (!actionMutation.isPending) {
              setActionTarget(null)
              setActionError(null)
            }
          }}
          onSubmit={(values) =>
            void actionMutation.mutateAsync({ target: actionTarget, values })
          }
        />
      ) : null}
    </PageContainer>
  )
}
