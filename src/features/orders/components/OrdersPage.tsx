import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import {
  ListFilterBar,
  type ActiveFilterChip,
} from '../../../components/layout/ListFilterBar'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { featureFlags } from '../../../config/featureFlags'
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

const DEFAULT_PAGE_SIZE = 10

const orderStatuses: AdminOrderStatus[] = [
  'ORDER_PLACED',
  'VENDOR_ACCEPTANCE_PENDING',
  'PRICE_REVISION_PENDING_CUSTOMER',
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

const paymentMethods: AdminOrderPaymentMethod[] = [
  'PREPAID',
  'COD',
  ...(featureFlags.customerWallet
    ? (['WALLET', 'MIXED'] as AdminOrderPaymentMethod[])
    : []),
]

function orderStatusTone(value: unknown) {
  if (value === 'DELIVERED') {
    return 'success'
  }

  if (value === 'CANCELLED') {
    return 'danger'
  }

  if (value === 'PRICE_REVISION_PENDING_CUSTOMER' || value === 'VENDOR_ACCEPTANCE_PENDING') {
    return 'warning'
  }

  return 'info'
}

function orderDisplayValue(order: AdminOrderSummary) {
  const pendingRevision = order.pricing.pendingPriceRevision

  if (pendingRevision) {
    return (
      <div className="text-right">
        <p className="font-semibold text-foreground">{formatMoney(pendingRevision.revisedPricePaise / 100)}</p>
        <p className="text-xs text-muted">Was {formatMoney(pendingRevision.previousPricePaise / 100)}</p>
      </div>
    )
  }

  const amountPaise =
    order.pricing.finalPricePaise ??
    order.pricing.payableAmountPaise ??
    order.pricing.priceEstimatePaise

  return formatMoney(amountPaise / 100)
}

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
    statusTone: orderStatusTone,
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
    renderCell: orderDisplayValue,
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
  const clearOrderFilters = () => {
    setSearch('')
    setCity('')
    setCategoryId('')
    setCustomerId('')
    setDateFrom('')
    setDateTo('')
    setOrderStatus('')
    setPaymentMethod('')
    setPaymentStatus('')
    setVendorId('')
    setZoneId('')
    resetToFirstPage()
  }
  const activeFilters: ActiveFilterChip[] = [
    search ? { key: 'search', label: `Search: ${search}`, onRemove: () => { setSearch(''); resetToFirstPage() } } : null,
    orderStatus ? { key: 'orderStatus', label: `Order: ${orderStatus}`, onRemove: () => { setOrderStatus(''); resetToFirstPage() } } : null,
    paymentStatus ? { key: 'paymentStatus', label: `Payment: ${paymentStatus}`, onRemove: () => { setPaymentStatus(''); resetToFirstPage() } } : null,
    paymentMethod ? { key: 'paymentMethod', label: `Method: ${paymentMethod}`, onRemove: () => { setPaymentMethod(''); resetToFirstPage() } } : null,
    city ? { key: 'city', label: `City: ${city}`, onRemove: () => { setCity(''); resetToFirstPage() } } : null,
    dateFrom ? { key: 'dateFrom', label: `From: ${dateFrom}`, onRemove: () => { setDateFrom(''); resetToFirstPage() } } : null,
    dateTo ? { key: 'dateTo', label: `To: ${dateTo}`, onRemove: () => { setDateTo(''); resetToFirstPage() } } : null,
    categoryId ? { key: 'categoryId', label: `Category: ${categoryId}`, onRemove: () => { setCategoryId(''); resetToFirstPage() } } : null,
    zoneId ? { key: 'zoneId', label: `Zone: ${zoneId}`, onRemove: () => { setZoneId(''); resetToFirstPage() } } : null,
    vendorId ? { key: 'vendorId', label: `Vendor: ${vendorId}`, onRemove: () => { setVendorId(''); resetToFirstPage() } } : null,
    customerId ? { key: 'customerId', label: `Customer: ${customerId}`, onRemove: () => { setCustomerId(''); resetToFirstPage() } } : null,
  ].filter((filter): filter is ActiveFilterChip => Boolean(filter))

  return (
    <PageContainer>
      <PageContextHeader
        description="Search, filter, and manage customer orders from backend data."
        placement="topbar"
        title="Orders"
      />

      <div className="list-workspace">
        <ListFilterBar
          activeFilters={activeFilters}
          onClearAll={clearOrderFilters}
          primaryFilters={
            <>
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
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">City</span>
                <Input value={city} onChange={(event) => { setCity(event.target.value); resetToFirstPage() }} />
              </label>
            </>
          }
          secondaryFilters={
            <>
              <OptionalSelect label="Payment Method" options={paymentMethods} value={paymentMethod} onChange={(value) => { setPaymentMethod(value); resetToFirstPage() }} />
              {[
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
            </>
          }
        />

        <section className="list-results-panel">
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
              bodyMaxHeight="calc(100vh - 18rem)"
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

        </section>
      </div>
    </PageContainer>
  )
}
