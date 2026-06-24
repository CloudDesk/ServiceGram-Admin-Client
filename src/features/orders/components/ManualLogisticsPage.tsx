import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { ListFilterBar } from '../../../components/layout/ListFilterBar'
import { routePaths } from '../../../config/routes'
import { orderService } from '../services/order.service'
import type {
  AdminOrderStatus,
  AdminOrdersQueryParams,
  AdminOrderSummary,
} from '../types/order.types'

const DEFAULT_PAGE_SIZE = 10

const manualStatuses: AdminOrderStatus[] = [
  'PICKUP_SCHEDULED',
  'PICKED_UP_FROM_CUSTOMER',
  'HANDED_OVER_TO_VENDOR',
  'ITEM_RECEIVED_BY_VENDOR',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'COLLECTED_FROM_VENDOR',
  'OUT_FOR_DELIVERY',
  'DELIVERY_FAILED',
  'CUSTOMER_UNAVAILABLE',
  'ITEM_DAMAGED',
  'ITEM_LOST',
  'WRONG_ITEM',
]

const columns: DynamicTableColumn<AdminOrderSummary>[] = [
  {
    key: 'publicOrderId',
    label: 'Order',
    minWidth: 190,
    renderCell: (order) => (
      <div>
        <p className="font-semibold text-foreground">{order.publicOrderId}</p>
        <p className="text-xs text-muted">{order.createdAt}</p>
      </div>
    ),
  },
  {
    key: 'customer',
    label: 'Customer',
    minWidth: 190,
    renderCell: (order) => (
      <div>
        <p className="font-medium text-foreground">{order.customer.fullName}</p>
        <p className="text-xs text-muted">{order.customer.mobileNumber ?? 'No mobile'}</p>
      </div>
    ),
  },
  {
    key: 'vendor',
    label: 'Vendor',
    minWidth: 220,
    renderCell: (order) => (
      <div>
        <p className="font-medium text-foreground">{order.vendor.shopName}</p>
        <p className="text-xs text-muted">{order.vendor.city}</p>
      </div>
    ),
  },
  {
    key: 'orderStatus',
    label: 'Current Status',
    format: 'status',
    statusTone: (value) =>
      value === 'DELIVERED'
        ? 'success'
        : value === 'DELIVERY_FAILED' ||
            value === 'ITEM_DAMAGED' ||
            value === 'ITEM_LOST' ||
            value === 'WRONG_ITEM'
          ? 'danger'
          : 'warning',
    minWidth: 190,
  },
  {
    key: 'nextRecommendedAction',
    label: 'Next Action',
    minWidth: 210,
    placeholder: 'No manual action',
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    format: 'date',
    minWidth: 180,
  },
]

export function ManualLogisticsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [orderStatus, setOrderStatus] = useState<'' | AdminOrderStatus>('')

  const query = useMemo<AdminOrdersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      city: city.trim() || undefined,
      vendorId: vendorId.trim() || undefined,
      orderStatus: orderStatus || undefined,
    }),
    [city, limit, orderStatus, page, search, vendorId],
  )

  const ordersQuery = useQuery({
    queryKey: ['manual-logistics', query],
    queryFn: () => orderService.getOrderList(query),
  })

  const orders = ordersQuery.data?.data ?? []
  const pagination = ordersQuery.data?.pagination
  const isLoading = ordersQuery.isLoading || ordersQuery.isFetching
  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        description="Track orders that need admin-controlled pickup or delivery movement."
        placement="topbar"
        title="Manual Logistics"
      />

      <div className="list-workspace">
        <ListFilterBar
          primaryFilters={
            <>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input className="pl-9" placeholder="Order, customer, vendor" value={search} onChange={(event) => { setSearch(event.target.value); resetToFirstPage() }} />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Status</span>
                <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={orderStatus} onChange={(event) => { setOrderStatus(event.target.value as '' | AdminOrderStatus); resetToFirstPage() }}>
                  <option value="">All operational statuses</option>
                  {manualStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">City</span>
                <Input placeholder="Bengaluru" value={city} onChange={(event) => { setCity(event.target.value); resetToFirstPage() }} />
              </label>
            </>
          }
          secondaryFilters={
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Vendor ID</span>
              <Input placeholder="UUID" value={vendorId} onChange={(event) => { setVendorId(event.target.value); resetToFirstPage() }} />
            </label>
          }
        />

        <section className="list-results-panel">
        {ordersQuery.isError ? (
          <ErrorState
            description="We could not load manual logistics orders."
            title="Manual logistics unavailable"
            onRetry={() => void ordersQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton columns={columns} hasFooter={Boolean(pagination)} rowCount={8} />
        ) : orders.length === 0 ? (
          <EmptyState
            description="No orders matched the current logistics filters."
            title="No logistics orders"
          />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={columns}
            data={orders}
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
            title="Manual Logistics Orders"
            getRowId={(order) => order.orderId}
            onRowClick={(order) =>
              navigate(`${routePaths.orders}/${order.orderId}/logistics`)
            }
          />
        )}

        </section>
      </div>
    </PageContainer>
  )
}
