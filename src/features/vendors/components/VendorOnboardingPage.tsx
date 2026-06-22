import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { vendorService } from '../services/vendor.service'
import type {
  VendorListItem,
  VendorListQueryParams,
  VendorOnboardingStatus,
} from '../types/vendor.types'

const DEFAULT_PAGE_SIZE = 20

const onboardingStatuses: VendorOnboardingStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'DOCUMENTS_PENDING',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
]

const columns: DynamicTableColumn<VendorListItem>[] = [
  {
    key: 'shopName',
    label: 'Vendor',
    minWidth: 280,
    renderCell: (vendor) => (
      <div>
        <p className="font-semibold text-foreground">{vendor.shopName}</p>
        <p className="text-xs text-muted">{vendor.publicVendorId}</p>
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
    key: 'address',
    label: 'City',
    minWidth: 160,
    getValue: (vendor) => vendor.address.city,
  },
  {
    key: 'documents',
    label: 'Documents',
    minWidth: 160,
    renderCell: (vendor) =>
      vendor.documentSummary
        ? `${vendor.documentSummary.verified}/${vendor.documentSummary.total} verified`
        : 'No documents',
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
  },
  {
    key: 'nextRecommendedAction',
    label: 'Next Action',
    minWidth: 190,
    placeholder: 'No action',
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function VendorOnboardingPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [onboardingStatus, setOnboardingStatus] =
    useState<'' | VendorOnboardingStatus>('')

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
    queryKey: ['vendor-onboarding', query],
    queryFn: () => vendorService.getVendorOnboardingQueue(query),
  })

  const vendors = onboardingQuery.data?.data ?? []
  const pagination = onboardingQuery.data?.pagination
  const isLoading = onboardingQuery.isLoading || onboardingQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader title="Vendor Onboarding" />

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                placeholder="Vendor, owner, mobile"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetToFirstPage()
                }}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">City</span>
            <Input
              placeholder="Bengaluru"
              value={city}
              onChange={(event) => {
                setCity(event.target.value)
                resetToFirstPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={onboardingStatus}
              onChange={(event) => {
                setOnboardingStatus(event.target.value as '' | VendorOnboardingStatus)
                resetToFirstPage()
              }}
            >
              <option value="">All</option>
              {onboardingStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
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
          />
        )}

        {pagination ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={!pagination.hasPreviousPage || isLoading}
                size="sm"
                variant="secondary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                disabled={!pagination.hasNextPage || isLoading}
                size="sm"
                variant="secondary"
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </PageContainer>
  )
}
