import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  DynamicTable,
  TableSkeleton,
  type DynamicTableColumn,
} from '../../../components/ui/Table'
import { routePaths } from '../../../config/routes'
import { formatMoney } from '../../../utils/formatMoney'
import { customerService } from '../services/customer.service'
import type {
  AdminCustomerListItem,
  AdminCustomersQueryParams,
  AdminCustomerStatus,
} from '../types/customer.types'

const DEFAULT_PAGE_SIZE = 20

const customerColumns: DynamicTableColumn<AdminCustomerListItem>[] = [
  {
    key: 'fullName',
    label: 'Customer',
    minWidth: 260,
    renderCell: (row) => (
      <div>
        <p className="font-medium">{row.fullName}</p>
        <p className="text-xs text-muted">{row.mobileNumber ?? 'No mobile'}</p>
      </div>
    ),
  },
  {
    key: 'email',
    label: 'Email',
    minWidth: 220,
    getValue: (row) => row.email ?? 'No email',
  },
  {
    key: 'city',
    label: 'City',
    minWidth: 180,
    renderCell: (row) => (
      <div>
        <p>{row.city}</p>
        <p className="text-xs text-muted">{row.zone?.zoneName ?? 'No zone'}</p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) => {
      if (value === 'ACTIVE') {
        return 'success'
      }

      if (value === 'BLOCKED') {
        return 'danger'
      }

      return 'warning'
    },
    minWidth: 150,
  },
  {
    key: 'totalOrders',
    label: 'Orders',
    minWidth: 120,
    getValue: (row) => row.orderSummary.totalOrders,
  },
  {
    key: 'walletCredit',
    label: 'Wallet Credit',
    minWidth: 170,
    getValue: (row) => row.walletSummary.creditBalancePaise,
    renderCell: (row) => (
      <span>{formatMoney(row.walletSummary.creditBalancePaise / 100)}</span>
    ),
  },
  {
    key: 'warnings',
    label: 'Warnings',
    minWidth: 220,
    getValue: (row) => row.warnings.join(', '),
    renderCell: (row) => (
      <span>{row.warnings.length ? row.warnings.join(', ') : 'None'}</span>
    ),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminCustomerStatus>('')
  const [city, setCity] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [hasOrders, setHasOrders] = useState('')
  const [hasWalletCredit, setHasWalletCredit] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)

  const query = useMemo<AdminCustomersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      city: city.trim() || undefined,
      zoneId: zoneId.trim() || undefined,
      hasOrders:
        hasOrders === '' ? undefined : hasOrders === 'true',
      hasWalletCredit:
        hasWalletCredit === '' ? undefined : hasWalletCredit === 'true',
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [
      city,
      dateFrom,
      dateTo,
      hasOrders,
      hasWalletCredit,
      limit,
      page,
      search,
      status,
      zoneId,
    ],
  )

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customerService.getCustomerList(query),
  })

  const customers = customersQuery.data?.data ?? []
  const pagination = customersQuery.data?.pagination
  const summary = customersQuery.data?.summary
  const isLoading = customersQuery.isLoading || customersQuery.isFetching
  const hasNextPage = pagination?.hasNextPage ?? false
  const hasPreviousPage = pagination?.hasPreviousPage ?? false
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader title="Customers" />

      <div className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 grid gap-3 lg:grid-cols-4">
          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="min-h-11 pl-9"
                placeholder="Search customers"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetToFirstPage()
                }}
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Status</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | AdminCustomerStatus)
                resetToFirstPage()
              }}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="INCOMPLETE">INCOMPLETE</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">City</span>
            <Input
              className="min-h-11"
              placeholder="Bengaluru"
              value={city}
              onChange={(event) => {
                setCity(event.target.value)
                resetToFirstPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Zone ID</span>
            <Input
              className="min-h-11"
              placeholder="UUID"
              value={zoneId}
              onChange={(event) => {
                setZoneId(event.target.value)
                resetToFirstPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Has Orders</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={hasOrders}
              onChange={(event) => {
                setHasOrders(event.target.value)
                resetToFirstPage()
              }}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              Has Wallet Credit
            </span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={hasWalletCredit}
              onChange={(event) => {
                setHasWalletCredit(event.target.value)
                resetToFirstPage()
              }}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Created From</span>
            <Input
              className="min-h-11"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                resetToFirstPage()
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Created To</span>
            <Input
              className="min-h-11"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                resetToFirstPage()
              }}
            />
          </label>
        </div>

        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">
            Customer Operations
          </h2>
          <p className="text-sm text-muted">
            {summary
              ? `${summary.visible} visible · ${summary.active} active · ${summary.blocked} blocked · ${summary.withActiveOrders} with active orders`
              : 'Search, filter, and manage customer accounts from backend data.'}
          </p>
        </div>

        {customersQuery.isError ? (
          <ErrorState
            description="We could not load customer data. Please retry."
            title="Customer data unavailable"
            onRetry={() => void customersQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton
            columns={customerColumns}
            hasFooter={Boolean(pagination)}
            rowCount={8}
          />
        ) : customers.length === 0 ? (
          <EmptyState
            description="No customers matched the selected filters."
            title="No customers"
          />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={customerColumns}
            data={customers}
            pagination={
              pagination
                ? {
                    page: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    onPageChange: (nextPage) => setPage(nextPage),
                    onPageSizeChange: (nextLimit) => {
                      setLimit(nextLimit)
                      setPage(1)
                    },
                    rowsPerPageOptions: [10, 20, 50, 100],
                  }
                : {
                    page: 1,
                    pageSize: customers.length || 1,
                    total: customers.length,
                  }
            }
            title="Customers"
            getRowId={(row) => row.customerId}
            onRowClick={(row) => navigate(`${routePaths.customers}/${row.customerId}`)}
          />
        )}

        {pagination ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={!hasPreviousPage || isLoading}
                size="sm"
                variant="secondary"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                disabled={!hasNextPage || isLoading}
                size="sm"
                variant="secondary"
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  )
}
