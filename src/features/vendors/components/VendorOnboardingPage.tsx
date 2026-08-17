import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  MessageSquarePlus,
  RefreshCcw,
  Search,
  Settings2,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { ListFilterBar } from '../../../components/layout/ListFilterBar'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { formatDate } from '../../../utils/formatDate'
import { vendorService } from '../services/vendor.service'
import {
  VendorActionModal,
  type VendorActionFormValues,
  type VendorActionKind,
  type VendorActionSelection,
} from './VendorActionModal'
import type {
  VendorListItem,
  VendorListQueryParams,
  VendorOnboardingStatus,
} from '../types/vendor.types'

const DEFAULT_PAGE_SIZE = 10

const onboardingStatuses: VendorOnboardingStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'DOCUMENTS_PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]

type VendorOnboardingActionKind = Extract<
  VendorActionKind,
  'ADD_NOTE' | 'APPROVE' | 'REJECT' | 'REQUEST_DOCUMENTS'
>

interface VendorOnboardingActionTarget {
  action: VendorActionSelection
  vendor: VendorListItem
}

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function onboardingTone(status: VendorOnboardingStatus) {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'UNDER_REVIEW' || status === 'DOCUMENTS_PENDING') return 'warning'
  return 'info'
}

function readOnboardingStatusFilter(
  searchParams: URLSearchParams,
): '' | VendorOnboardingStatus {
  const status = searchParams.get('onboardingStatus')

  return onboardingStatuses.includes(status as VendorOnboardingStatus)
    ? (status as VendorOnboardingStatus)
    : ''
}

function buildLegacyBankApprovalRedirect(searchParams: URLSearchParams) {
  if (!searchParams.has('bankAccountStatus')) return null

  return `${routePaths.vendors}?approvalQueue=BANK_ACCOUNT_APPROVALS`
}

function documentSummaryTone(vendor: VendorListItem) {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) return 'warning'
  if (summary.rejected > 0 || summary.expired > 0) return 'danger'
  if (summary.verified < summary.total) return 'warning'
  return 'success'
}

function documentSummaryLabel(vendor: VendorListItem) {
  const summary = vendor.documentSummary
  if (!summary) return 'No documents'

  return `${summary.verified}/${summary.total} verified`
}

function bankSummaryTone(vendor: VendorListItem) {
  const summary = vendor.bankAccountSummary

  if (!summary || summary.total === 0) return 'warning'
  if (summary.payoutReady) return 'success'
  if (summary.rejected > 0 || summary.primaryStatus === 'REJECTED') return 'danger'
  return 'warning'
}

function bankSummaryLabel(vendor: VendorListItem) {
  const summary = vendor.bankAccountSummary
  if (!summary) return 'No payout account'
  if (summary.payoutReady) return 'Payout ready'
  if (summary.primaryStatus) return humanizeCode(summary.primaryStatus)
  return `${summary.verified}/${summary.total} verified`
}

function approvalBlockMessage(vendor: VendorListItem) {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) {
    return 'Approval is blocked until the vendor uploads required documents.'
  }

  const unverifiedCount = Math.max(summary.total - summary.verified, 0)
  if (unverifiedCount === 0) return null

  return `Approval is blocked until ${unverifiedCount} document${
    unverifiedCount === 1 ? '' : 's'
  } are verified.`
}

function hasVendorAction(vendor: VendorListItem, action: VendorOnboardingActionKind) {
  if (action === 'ADD_NOTE') return true

  return vendor.availableActions.includes(action)
}

function buildVendorAuditPath(vendor: VendorListItem) {
  const params = new URLSearchParams({
    moduleCode: 'vendors',
    entityType: 'vendor',
    entityId: vendor.vendorId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

const columns: DynamicTableColumn<VendorListItem>[] = [
  {
    key: 'shopName',
    label: 'Vendor',
    minWidth: 280,
    renderCell: (vendor) => (
      <div>
        <p className="font-semibold text-foreground">{vendor.shopName}</p>
        <p className="text-xs text-muted">{vendor.publicVendorId}</p>
        {vendor.warnings.length ? (
          <p className="mt-1 text-xs text-warning">
            {vendor.warnings.slice(0, 2).map(humanizeCode).join(', ')}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: 'ownerName',
    label: 'Owner',
    minWidth: 180,
    placeholder: 'Not available',
  },
  {
    key: 'category',
    label: 'Category / Zone',
    minWidth: 220,
    renderCell: (vendor) => (
      <div>
        <p className="font-medium text-foreground">
          {vendor.category?.name ?? 'Unassigned category'}
        </p>
        <p className="text-xs text-muted">
          {vendor.address.zone
            ? `${vendor.address.zone.zoneName} · ${vendor.address.zone.city}`
            : vendor.address.city || 'No zone'}
        </p>
      </div>
    ),
  },
  {
    key: 'documents',
    label: 'Documents',
    minWidth: 160,
    renderCell: (vendor) => (
      <div className="space-y-1">
        <Badge tone={documentSummaryTone(vendor)}>
          {documentSummaryLabel(vendor)}
        </Badge>
        <p className="text-xs text-muted">
          {vendor.documentSummary
            ? `${vendor.documentSummary.pending} pending · ${vendor.documentSummary.rejected} rejected`
            : 'Open detail to review uploads'}
        </p>
      </div>
    ),
  },
  {
    key: 'bankAccount',
    label: 'Payout account',
    minWidth: 170,
    renderCell: (vendor) => (
      <div className="space-y-1">
        <Badge tone={bankSummaryTone(vendor)}>{bankSummaryLabel(vendor)}</Badge>
        <p className="text-xs text-muted">
          {vendor.bankAccountSummary?.primaryBankName ??
            'Open detail to review payout account'}
        </p>
      </div>
    ),
  },
  {
    key: 'onboardingStatus',
    label: 'Onboarding',
    format: 'status',
    statusTone: (value) =>
      value === 'APPROVED'
        ? 'success'
        : value === 'REJECTED'
          ? 'danger'
          : value === 'UNDER_REVIEW' || value === 'DOCUMENTS_PENDING'
            ? 'warning'
            : 'info',
    minWidth: 170,
    renderCell: (vendor) => (
      <div className="space-y-1">
        <Badge tone={onboardingTone(vendor.onboardingStatus)}>
          {humanizeCode(vendor.onboardingStatus)}
        </Badge>
        <p className="text-xs text-muted">{vendor.vendorStatus}</p>
      </div>
    ),
  },
  {
    key: 'nextRecommendedAction',
    label: 'Next Action',
    minWidth: 190,
    placeholder: 'No action',
    renderCell: (vendor) => (
      <div>
        <p className="font-medium text-foreground">
          {vendor.nextRecommendedAction
            ? humanizeCode(vendor.nextRecommendedAction)
            : 'No action'}
        </p>
        {vendor.rejectionReason ? (
          <p className="mt-1 line-clamp-2 text-xs text-danger">
            {vendor.rejectionReason}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    minWidth: 180,
    renderCell: (vendor) => (
      <p className="font-medium text-foreground">
        {formatDate(vendor.updatedAt, true)}
      </p>
    ),
  },
]

export function VendorOnboardingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const legacyBankApprovalRedirect = buildLegacyBankApprovalRedirect(searchParams)
  const queryClient = useQueryClient()
  const canApproveVendors = usePermission('vendors:approve')
  const canReadAudit = usePermission('audit:read')
  const canReadSettings = usePermission('settings:read')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [city, setCity] = useState(() => searchParams.get('city') ?? '')
  const [onboardingStatus, setOnboardingStatus] =
    useState<'' | VendorOnboardingStatus>(() =>
      readOnboardingStatusFilter(searchParams),
    )
  const [actionTarget, setActionTarget] =
    useState<VendorOnboardingActionTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const query = useMemo<VendorListQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      onboardingStatus: onboardingStatus || undefined,
    }),
    [city, limit, onboardingStatus, page, search],
  )

  const onboardingQuery = useQuery({
    enabled: !legacyBankApprovalRedirect,
    queryKey: ['vendor-onboarding', query],
    queryFn: () => vendorService.getVendorOnboardingQueue(query),
  })

  const vendors = onboardingQuery.data?.data ?? []
  const pagination = onboardingQuery.data?.pagination
  const isLoading = onboardingQuery.isLoading || onboardingQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  const clearSeededOnboardingParams = () => {
    const seededKeys = ['city', 'onboardingStatus', 'search'] as const

    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const openAction = (
    vendor: VendorListItem,
    kind: VendorOnboardingActionKind,
  ) => {
    setActionError(null)
    setActionTarget({ action: { kind }, vendor })
  }

  const actionMutation = useMutation({
    mutationFn: async ({
      target,
      values,
    }: {
      target: VendorOnboardingActionTarget
      values: VendorActionFormValues
    }) => {
      const { action, vendor } = target

      if (action.kind === 'APPROVE') {
        const blockMessage = approvalBlockMessage(vendor)

        if (blockMessage) {
          throw new Error(blockMessage)
        }

        return vendorService.approveVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT') {
        if (!values.reason) throw new Error('Rejection reason is required.')

        return vendorService.rejectVendor(vendor.vendorId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'REQUEST_DOCUMENTS') {
        if (!values.reason) throw new Error('Document request reason is required.')

        return vendorService.requestVendorDocuments(vendor.vendorId, {
          reason: values.reason,
          requestedDocumentTypes: values.requestedDocumentTypes,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) throw new Error('Internal note is required.')

        return vendorService.addVendorNote(vendor.vendorId, {
          note: values.note,
        })
      }

      throw new Error('Unsupported onboarding queue action.')
    },
    onMutate: () => setActionError(null),
    onSuccess: (_data, variables) => {
      setActionTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['vendor-onboarding'] })
      void queryClient.invalidateQueries({ queryKey: ['vendors'] })
      void queryClient.invalidateQueries({
        queryKey: ['vendor-detail', variables.target.vendor.vendorId],
      })
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Vendor action failed.',
      )
    },
  })

  const submitAction = (values: VendorActionFormValues) => {
    if (!actionTarget) return

    void actionMutation.mutateAsync({
      target: actionTarget,
      values,
    })
  }

  const rowActions = (vendor: VendorListItem) => {
    const blockMessage = approvalBlockMessage(vendor)

    return [
      {
        key: 'open',
        label: 'Open',
        icon: <ArrowUpRight className="size-4" />,
        variant: 'secondary' as const,
        onClick: (row: VendorListItem) =>
          navigate(`${routePaths.vendorOnboarding}/${row.vendorId}`),
      },
      {
        key: 'approve',
        label: 'Approve',
        icon: <CheckCircle2 className="size-4" />,
        variant: 'primary' as const,
        isVisible: hasVendorAction(vendor, 'APPROVE'),
        isDisabled: !canApproveVendors || Boolean(blockMessage) || actionMutation.isPending,
        onClick: (row: VendorListItem) => openAction(row, 'APPROVE'),
      },
      {
        key: 'reject',
        label: 'Reject',
        icon: <XCircle className="size-4" />,
        variant: 'danger' as const,
        placement: 'menu' as const,
        isVisible: hasVendorAction(vendor, 'REJECT'),
        isDisabled: !canApproveVendors || actionMutation.isPending,
        onClick: (row: VendorListItem) => openAction(row, 'REJECT'),
      },
      {
        key: 'request-documents',
        label: 'Request docs',
        icon: <FileWarning className="size-4" />,
        variant: 'secondary' as const,
        placement: 'menu' as const,
        isVisible: hasVendorAction(vendor, 'REQUEST_DOCUMENTS'),
        isDisabled: !canApproveVendors || actionMutation.isPending,
        onClick: (row: VendorListItem) => openAction(row, 'REQUEST_DOCUMENTS'),
      },
      {
        key: 'add-note',
        label: 'Add note',
        icon: <MessageSquarePlus className="size-4" />,
        variant: 'secondary' as const,
        placement: 'menu' as const,
        isDisabled: !canApproveVendors || actionMutation.isPending,
        onClick: (row: VendorListItem) => openAction(row, 'ADD_NOTE'),
      },
      {
        key: 'category',
        label: 'Category',
        icon: <Settings2 className="size-4" />,
        variant: 'ghost' as const,
        placement: 'menu' as const,
        isVisible: Boolean(canReadSettings && vendor.category?.categoryId),
        onClick: (row: VendorListItem) => {
          if (!row.category?.categoryId) return
          navigate(`${routePaths.settings}/categories/${row.category.categoryId}`)
        },
      },
      {
        key: 'zone',
        label: 'Zone',
        icon: <Settings2 className="size-4" />,
        variant: 'ghost' as const,
        placement: 'menu' as const,
        isVisible: Boolean(canReadSettings && vendor.address.zone?.zoneId),
        onClick: (row: VendorListItem) => {
          if (!row.address.zone?.zoneId) return
          navigate(`${routePaths.settings}/zones/${row.address.zone.zoneId}`)
        },
      },
      {
        key: 'audit',
        label: 'Audit',
        icon: <ClipboardList className="size-4" />,
        variant: 'ghost' as const,
        placement: 'menu' as const,
        isVisible: canReadAudit,
        onClick: (row: VendorListItem) => navigate(buildVendorAuditPath(row)),
      },
    ]
  }

  if (legacyBankApprovalRedirect) {
    return <Navigate replace to={legacyBankApprovalRedirect} />
  }

  return (
    <PageContainer>
      <PageContextHeader
        description="Review vendor onboarding submissions and document readiness."
        placement="topbar"
        title="Vendor Onboarding"
      />

      <div className="list-workspace">
        <ListFilterBar
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-9" placeholder="Vendor, owner, mobile" value={search} onChange={(event) => { clearSeededOnboardingParams(); setSearch(event.target.value); resetToFirstPage() }} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">City</span>
                <Input placeholder="Bengaluru" value={city} onChange={(event) => { clearSeededOnboardingParams(); setCity(event.target.value); resetToFirstPage() }} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={onboardingStatus} onChange={(event) => { clearSeededOnboardingParams(); setOnboardingStatus(event.target.value as '' | VendorOnboardingStatus); resetToFirstPage() }}>
                  <option value="">All</option>
                  {onboardingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
        />

        <section className="list-results-panel scroll-mt-4" id="vendor-onboarding-records">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Onboarding queue
              </h2>
              <p className="text-xs text-muted">
                {pagination
                  ? `${pagination.totalItems} vendors match current backend filters`
                  : 'Review vendor readiness from backend queue data.'}
              </p>
            </div>
            <Button
              disabled={isLoading}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void onboardingQuery.refetch()}
            >
              <RefreshCcw
                className={`mr-2 size-4 ${isLoading ? 'animate-spin motion-reduce:animate-none' : ''}`}
              />
              Refresh
            </Button>
          </div>
          {onboardingQuery.isError ? (
            <ErrorState
              description="We could not load the vendor onboarding queue."
              title="Onboarding queue unavailable"
              onRetry={() => void onboardingQuery.refetch()}
            />
          ) : isLoading ? (
            <TableSkeleton columns={columns} hasFooter={Boolean(pagination)} rowCount={8} />
          ) : vendors.length === 0 ? (
            <EmptyState
              description="There are no vendors waiting in the current onboarding view."
              title="Onboarding queue is empty"
            />
          ) : (
            <DynamicTable
              bodyMaxHeight={560}
              columns={columns}
              data={vendors}
              actionColumnMinWidth={340}
              actionColumnWidth={360}
              inlineActionLimit={2}
              pagination={
                pagination
                  ? {
                      page: pagination.page,
                      pageSize: pagination.limit,
                      total: pagination.totalItems,
                      onPageChange: setPage,
                      onPageSizeChange: (nextLimit) => {
                        setLimit(nextLimit)
                        setPage(1)
                      },
                      rowsPerPageOptions: [10, 20, 50, 100],
                    }
                  : undefined
              }
              title="Onboarding Queue"
              getRowId={(vendor) => vendor.vendorId}
              onRowClick={(vendor) =>
                navigate(`${routePaths.vendorOnboarding}/${vendor.vendorId}`)
              }
              rowActions={rowActions}
            />
          )}
        </section>
      </div>
      {actionTarget ? (
        <VendorActionModal
          action={actionTarget.action}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          vendor={actionTarget.vendor}
          onClose={() => setActionTarget(null)}
          onSubmit={submitAction}
        />
      ) : null}
    </PageContainer>
  )
}
