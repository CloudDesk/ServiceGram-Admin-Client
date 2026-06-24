import { ArrowUpRight, RefreshCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
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
import { paymentService } from '../services/payment.service'
import type {
  AdminPaymentGateway,
  AdminPaymentMethod,
  AdminPaymentsQueryParams,
  AdminPaymentStatus,
  AdminPaymentSummary,
} from '../types/payment.types'

const paymentStatuses: AdminPaymentStatus[] = ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED']
const paymentMethods: AdminPaymentMethod[] = [
  'UPI',
  'CARD',
  'NET_BANKING',
  ...(featureFlags.customerWallet ? (['WALLET'] as AdminPaymentMethod[]) : []),
  'COD',
]
const gateways: AdminPaymentGateway[] = [
  'RAZORPAY',
  'INTERNAL_COD',
  ...(featureFlags.customerWallet ? (['WALLET'] as AdminPaymentGateway[]) : []),
]

const columns: DynamicTableColumn<AdminPaymentSummary>[] = [
  {
    key: 'publicPaymentId',
    label: 'Payment',
    minWidth: 190,
    renderCell: (payment) => (
      <div>
        <p className="font-semibold text-foreground">{payment.publicPaymentId}</p>
        <p className="text-xs text-muted">{payment.order.publicOrderId}</p>
      </div>
    ),
  },
  { key: 'status', label: 'Status', format: 'status', statusTone: (value) => value === 'SUCCESS' ? 'success' : value === 'FAILED' ? 'danger' : 'warning', minWidth: 130 },
  { key: 'method', label: 'Method', minWidth: 130 },
  { key: 'gateway', label: 'Gateway', minWidth: 150 },
  { key: 'customer', label: 'Customer', minWidth: 190, renderCell: (payment) => payment.customer.fullName },
  { key: 'vendor', label: 'Vendor', minWidth: 190, renderCell: (payment) => payment.vendor.shopName },
  { key: 'amountPaise', label: 'Amount', align: 'right', renderCell: (payment) => formatMoney(payment.amountPaise / 100) },
]

function OptionalSelect<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: '' | T; onChange: (value: '' | T) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={value} onChange={(event) => onChange(event.target.value as '' | T)}>
        <option value="">All</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  )
}

export function PaymentsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminPaymentStatus>('')
  const [method, setMethod] = useState<'' | AdminPaymentMethod>('')
  const [gateway, setGateway] = useState<'' | AdminPaymentGateway>('')
  const [city, setCity] = useState('')
  // const [zoneId, setZoneId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmountPaise, setMinAmountPaise] = useState('')
  const [maxAmountPaise, setMaxAmountPaise] = useState('')

  const query = useMemo<AdminPaymentsQueryParams>(() => ({
    page,
    limit,
    search: search.trim() || undefined,
    status: status || undefined,
    method: method || undefined,
    gateway: gateway || undefined,
    city: city.trim() || undefined,
    // zoneId: zoneId.trim() || undefined,
    orderId: orderId.trim() || undefined,
    customerId: customerId.trim() || undefined,
    vendorId: vendorId.trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    minAmountPaise: minAmountPaise ? Number(minAmountPaise) : undefined,
    maxAmountPaise: maxAmountPaise ? Number(maxAmountPaise) : undefined,
  }), [city, customerId, dateFrom, dateTo, gateway, limit, maxAmountPaise, method, minAmountPaise, orderId, page, search, status, vendorId])

  const queryResult = useQuery({ queryKey: ['payments', query], queryFn: () => paymentService.getPaymentList(query) })
  const data = queryResult.data?.data ?? []
  const pagination = queryResult.data?.pagination
  const isLoading = queryResult.isLoading || queryResult.isFetching
  const reset = () => setPage(1)
  const clearPaymentFilters = () => {
    setSearch('')
    setStatus('')
    setMethod('')
    setGateway('')
    setCity('')
    // setZoneId('')
    setOrderId('')
    setCustomerId('')
    setVendorId('')
    setDateFrom('')
    setDateTo('')
    setMinAmountPaise('')
    setMaxAmountPaise('')
    reset()
  }
  const activeFilters: ActiveFilterChip[] = [
    search ? { key: 'search', label: `Search: ${search}`, onRemove: () => { setSearch(''); reset() } } : null,
    status ? { key: 'status', label: `Status: ${status}`, onRemove: () => { setStatus(''); reset() } } : null,
    method ? { key: 'method', label: `Method: ${method}`, onRemove: () => { setMethod(''); reset() } } : null,
    gateway ? { key: 'gateway', label: `Gateway: ${gateway}`, onRemove: () => { setGateway(''); reset() } } : null,
    city ? { key: 'city', label: `City: ${city}`, onRemove: () => { setCity(''); reset() } } : null,
    // zoneId ? { key: 'zoneId', label: `Zone: ${zoneId}`, onRemove: () => { setZoneId(''); reset() } } : null,
    orderId ? { key: 'orderId', label: `Order: ${orderId}`, onRemove: () => { setOrderId(''); reset() } } : null,
    customerId ? { key: 'customerId', label: `Customer: ${customerId}`, onRemove: () => { setCustomerId(''); reset() } } : null,
    vendorId ? { key: 'vendorId', label: `Vendor: ${vendorId}`, onRemove: () => { setVendorId(''); reset() } } : null,
    dateFrom ? { key: 'dateFrom', label: `From: ${dateFrom}`, onRemove: () => { setDateFrom(''); reset() } } : null,
    dateTo ? { key: 'dateTo', label: `To: ${dateTo}`, onRemove: () => { setDateTo(''); reset() } } : null,
    minAmountPaise ? { key: 'minAmountPaise', label: `Min: ${minAmountPaise}`, onRemove: () => { setMinAmountPaise(''); reset() } } : null,
    maxAmountPaise ? { key: 'maxAmountPaise', label: `Max: ${maxAmountPaise}`, onRemove: () => { setMaxAmountPaise(''); reset() } } : null,
  ].filter((filter): filter is ActiveFilterChip => Boolean(filter))

  return (
    <PageContainer>
      <PageContextHeader
        description="Review and reconcile backend payment records."
        placement="topbar"
        title="Payments"
      />
      <div className="list-workspace">
        <ListFilterBar
          actionNode={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={isLoading}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void queryResult.refetch()}
              >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
              </Button>
              <Link to={routePaths.refunds}>
                <Button size="sm" variant="secondary">
                  <ArrowUpRight className="mr-2 size-4" />
                  Refund Queue
                </Button>
              </Link>
            </div>
          }
          activeFilters={activeFilters}
          onClearAll={clearPaymentFilters}
          primaryFilters={
            <>
              <label className="space-y-1"><span className="text-sm font-medium text-foreground">Search</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); reset() }} /></div></label>
              <OptionalSelect label="Status" options={paymentStatuses} value={status} onChange={(value) => { setStatus(value); reset() }} />
              <OptionalSelect label="Method" options={paymentMethods} value={method} onChange={(value) => { setMethod(value); reset() }} />
              <OptionalSelect label="Gateway" options={gateways} value={gateway} onChange={(value) => { setGateway(value); reset() }} />
            </>
          }
          secondaryFilters={
            <>
              {[
                ['City', city, setCity],
                // ['Zone ID', zoneId, setZoneId],
                ['Order ID', orderId, setOrderId],
                ['Customer ID', customerId, setCustomerId], ['Vendor ID', vendorId, setVendorId],
                ['Min Amount', minAmountPaise, setMinAmountPaise], ['Maximum Amount', maxAmountPaise, setMaxAmountPaise],
              ].map(([label, value, setter]) => <label className="space-y-1" key={label as string}><span className="text-sm font-medium text-foreground">{label as string}</span><Input value={value as string} onChange={(event) => { (setter as (value: string) => void)(event.target.value); reset() }} /></label>)}
              <label className="space-y-1"><span className="text-sm font-medium text-foreground">Date From</span><Input type="datetime-local" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); reset() }} /></label>
              <label className="space-y-1"><span className="text-sm font-medium text-foreground">Date To</span><Input type="datetime-local" value={dateTo} onChange={(event) => { setDateTo(event.target.value); reset() }} /></label>
            </>
          }
        />
        <section className="list-results-panel">
          {queryResult.isError ? <ErrorState title="Payment data unavailable" description="We could not load payment data." onRetry={() => void queryResult.refetch()} /> : isLoading ? <TableSkeleton columns={columns} rowCount={8} hasFooter={Boolean(pagination)} /> : data.length === 0 ? <EmptyState title="No payments found" description="No payment records matched the current filters." /> : (
            <DynamicTable bodyMaxHeight="calc(100vh - 18rem)" columns={columns} data={data} getRowId={(row) => row.paymentId} title="Payments" onRowClick={(row) => navigate(`${routePaths.payments}/${row.paymentId}`)} pagination={pagination ? { page: pagination.page, pageSize: pagination.limit, total: pagination.totalItems, onPageChange: setPage, onPageSizeChange: (next) => { setLimit(next); setPage(1) }, rowsPerPageOptions: [10, 20, 50, 100] } : undefined} />
          )}
        </section>
      </div>
    </PageContainer>
  )
}
