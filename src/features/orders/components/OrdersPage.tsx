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
import { formatMoney } from '../../../utils/formatMoney'
import { orderService } from '../services/order.service'
import type {
  AdminOrderPaymentMethod,
  AdminOrderPaymentStatus,
  AdminOrdersQueryParams,
  AdminOrderStatus,
  AdminOrderSummary,
} from '../types/order.types'

const DEFAULT_PAGE_SIZE = 20

const orderStatuses: AdminOrderStatus[] = [
  'ORDER_PLACED',
  'VENDOR_ACCEPTANCE_PENDING',
  'VENDOR_ACCEPTED',
  'VENDOR_DECLINED',
  'PICKUP_SCHEDULED',
  'PICKED_UP_FROM_CUSTOMER',
  'HANDED_OVER_TO_VENDOR',
  'ITEM_RECEIVED_BY_VENDOR',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'COLLECTED_FROM_VENDOR',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'DELIVERY_FAILED',
  'CUSTOMER_UNAVAILABLE',
  'ITEM_DAMAGED',
  'ITEM_LOST',
  'WRONG_ITEM',
]

const paymentStatuses: AdminOrderPaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'COD_PENDING',
]

const paymentMethods: AdminOrderPaymentMethod[] = ['PREPAID', 'COD', 'WALLET', 'MIXED']

const orderColumns: DynamicTableColumn<AdminOrderSummary>[] = [
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
    minWidth: 200,
    renderCell: (order) => (
      <div>
        <p className="font-medium text-foreground">{order.vendor.shopName}</p>
        <p className="text-xs text-muted">{order.vendor.city}</p>
      </div>
    ),
  },
  {
    key: 'orderStatus',
    label: 'Order Status',
    format: 'status',
    statusTone: (value) => value === 'DELIVERED' ? 'success' : value === 'CANCELLED' ? 'danger' : 'info',
    minWidth: 180,
  },
  {
    key: 'paymentStatus',
    label: 'Payment',
    format: 'status',
    statusTone: (value) => value === 'PAID' ? 'success' : value === 'FAILED' ? 'danger' : 'warning',
    minWidth: 150,
  },
  {
    key: 'finalPrice',
    label: 'Value',
    align: 'right',
    minWidth: 120,
    renderCell: (order) =>
      formatMoney((order.pricing.finalPricePaise ?? order.pricing.priceEstimatePaise) / 100),
  },
  {
    key: 'pickupDate',
    label: 'Pickup',
    minWidth: 160,
    renderCell: (order) => order.schedule.pickupDate,
  },
]

function OptionalSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: '' | T
  onChange: (value: '' | T) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value as '' | T)}
      >
        <option value="">All</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

export function OrdersPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [orderStatus, setOrderStatus] = useState<'' | AdminOrderStatus>('')
  const [paymentMethod, setPaymentMethod] = useState<'' | AdminOrderPaymentMethod>('')
  const [paymentStatus, setPaymentStatus] = useState<'' | AdminOrderPaymentStatus>('')
  const [vendorId, setVendorId] = useState('')
  const [zoneId, setZoneId] = useState('')

  const query = useMemo<AdminOrdersQueryParams>(() => ({
    page,
    limit,
    search,
    city,
    categoryId,
    customerId,
    dateFrom,
    dateTo,
    orderStatus: orderStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    paymentStatus: paymentStatus || undefined,
    vendorId,
    zoneId,
  }), [
    categoryId,
    city,
    customerId,
    dateFrom,
    dateTo,
    limit,
    orderStatus,
    page,
    paymentMethod,
    paymentStatus,
    search,
    vendorId,
    zoneId,
  ])

  const ordersQuery = useQuery({
    queryKey: ['orders', query],
    queryFn: () => orderService.getOrderList(query),
  })

  const orders = ordersQuery.data?.data ?? []
  const pagination = ordersQuery.data?.pagination
  const isLoading = ordersQuery.isLoading || ordersQuery.isFetching

  const resetToFirstPage = () => setPage(1)

  return (
    <PageContainer>
      <PageContextHeader
        description="Search, filter, and manage customer orders from backend data."
        title="Orders"
      />

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                className="pl-9"
                placeholder="Order ID, customer, vendor"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  resetToFirstPage()
                }}
              />
            </div>
          </label>
          <OptionalSelect label="Order Status" options={orderStatuses} value={orderStatus} onChange={(value) => { setOrderStatus(value); resetToFirstPage() }} />
          <OptionalSelect label="Payment Status" options={paymentStatuses} value={paymentStatus} onChange={(value) => { setPaymentStatus(value); resetToFirstPage() }} />
          <OptionalSelect label="Payment Method" options={paymentMethods} value={paymentMethod} onChange={(value) => { setPaymentMethod(value); resetToFirstPage() }} />
          {[
            ['City', city, setCity],
            ['Category ID', categoryId, setCategoryId],
            ['Zone ID', zoneId, setZoneId],
            ['Vendor ID', vendorId, setVendorId],
            ['Customer ID', customerId, setCustomerId],
          ].map(([label, value, setter]) => (
            <label className="space-y-1" key={label as string}>
              <span className="text-sm font-medium text-foreground">{label as string}</span>
              <Input
                value={value as string}
                onChange={(event) => {
                  ;(setter as (value: string) => void)(event.target.value)
                  resetToFirstPage()
                }}
              />
            </label>
          ))}
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date From</span>
            <Input type="datetime-local" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); resetToFirstPage() }} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Date To</span>
            <Input type="datetime-local" value={dateTo} onChange={(event) => { setDateTo(event.target.value); resetToFirstPage() }} />
          </label>
        </div>

        {ordersQuery.isError ? (
          <ErrorState
            description="We could not load order data. Please retry."
            title="Order data unavailable"
            onRetry={() => void ordersQuery.refetch()}
          />
        ) : isLoading ? (
          <TableSkeleton columns={orderColumns} hasFooter={Boolean(pagination)} rowCount={8} />
        ) : orders.length === 0 ? (
          <EmptyState description="No orders matched the current filters." title="No orders found" />
        ) : (
          <DynamicTable
            bodyMaxHeight={560}
            columns={orderColumns}
            data={orders}
            pagination={pagination ? {
              page: pagination.page,
              pageSize: pagination.limit,
              total: pagination.totalItems,
              onPageChange: setPage,
              onPageSizeChange: (nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
              },
              rowsPerPageOptions: [10, 20, 50, 100],
            } : undefined}
            title="Orders"
            getRowId={(row) => row.orderId}
            onRowClick={(row) => navigate(`${routePaths.orders}/${row.orderId}`)}
          />
        )}

        {pagination ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex items-center gap-2">
              <Button disabled={!pagination.hasPreviousPage || isLoading} size="sm" variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </Button>
              <Button disabled={!pagination.hasNextPage || isLoading} size="sm" variant="secondary" onClick={() => setPage((current) => current + 1)}>
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </PageContainer>
  )
}
