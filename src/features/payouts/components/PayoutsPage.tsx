import {
  CheckCircle2,
  CircleDollarSign,
  Eye,
  PauseCircle,
  Plus,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../../components/ui/Button'
import { DynamicTable, TableSkeleton, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { formatMoney } from '../../../utils/formatMoney'
import { payoutService } from '../services/payout.service'
import { PayoutActionModal, type PayoutActionFormValues, type PayoutActionSelection } from './PayoutActionModal'
import type { AdminPayoutMethod, AdminPayoutsQueryParams, AdminPayoutStatus, AdminPayoutSummary } from '../types/payout.types'

const statuses: AdminPayoutStatus[] = ['PENDING', 'UNDER_REVIEW', 'HELD', 'APPROVED', 'PAID', 'FAILED', 'ADJUSTED', 'CANCELLED']
const methods: AdminPayoutMethod[] = ['MANUAL_BANK_TRANSFER', 'UPI', 'OTHER']
const columns: DynamicTableColumn<AdminPayoutSummary>[] = [
  { key: 'publicPayoutId', label: 'Payout', minWidth: 200, renderCell: (payout) => <div><p className="font-semibold text-foreground">{payout.publicPayoutId}</p><p className="text-xs text-muted">{payout.vendor.shopName}</p></div> },
  { key: 'status', label: 'Status', format: 'status', statusTone: (value) => value === 'PAID' ? 'success' : value === 'FAILED' || value === 'HELD' ? 'danger' : 'warning', minWidth: 140 },
  { key: 'payoutMethod', label: 'Method', minWidth: 190 },
  { key: 'totalAmountPaise', label: 'Amount', align: 'right', renderCell: (payout) => formatMoney(payout.totalAmountPaise / 100) },
  { key: 'city', label: 'City', renderCell: (payout) => payout.vendor.city },
  { key: 'createdAt', label: 'Created', format: 'date', minWidth: 180 },
]

function OptionalSelect<T extends string>({ label, options, value, onChange }: { label: string; options: T[]; value: '' | T; onChange: (value: '' | T) => void }) {
  return <label className="space-y-1"><span className="text-sm font-medium text-foreground">{label}</span><select className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none" value={value} onChange={(event) => onChange(event.target.value as '' | T)}><option value="">All</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

export function PayoutsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const [selectedAction, setSelectedAction] = useState<PayoutActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminPayoutStatus>('')
  const [payoutMethod, setPayoutMethod] = useState<'' | AdminPayoutMethod>('')
  const [city, setCity] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmountPaise, setMinAmountPaise] = useState('')
  const [maxAmountPaise, setMaxAmountPaise] = useState('')

  const query = useMemo<AdminPayoutsQueryParams>(() => ({ page, limit, search: search.trim() || undefined, status: status || undefined, payoutMethod: payoutMethod || undefined, city: city.trim() || undefined, zoneId: zoneId.trim() || undefined, vendorId: vendorId.trim() || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, minAmountPaise: minAmountPaise ? Number(minAmountPaise) : undefined, maxAmountPaise: maxAmountPaise ? Number(maxAmountPaise) : undefined }), [city, dateFrom, dateTo, limit, maxAmountPaise, minAmountPaise, page, payoutMethod, search, status, vendorId, zoneId])
  const queryResult = useQuery({ queryKey: ['payouts', query], queryFn: () => payoutService.getPayoutList(query) })
  const data = queryResult.data?.data ?? []
  const pagination = queryResult.data?.pagination
  const isLoading = queryResult.isLoading || queryResult.isFetching
  const canApprovePayouts = can('payouts:approve')
  const reset = () => setPage(1)

  const mutation = useMutation({
    mutationFn: ({ action, values }: { action: PayoutActionSelection; values: PayoutActionFormValues }) => {
      if (action.kind === 'CREATE') {
        if (!values.vendorId || !values.reason) {
          throw new Error('Vendor ID and reason are required.')
        }

        return payoutService.createPayout({
          vendorId: values.vendorId,
          earningIds: values.earningIds?.length ? values.earningIds : undefined,
          payoutMethod: values.payoutMethod,
          reason: values.reason,
        })
      }

      if (!action.payout || !values.reason) {
        throw new Error('Payout details and reason are required.')
      }

      if (action.kind === 'APPROVE') return payoutService.approvePayout(action.payout.payoutId, { reason: values.reason, processImmediately: values.processImmediately })
      if (action.kind === 'HOLD') return payoutService.holdPayout(action.payout.payoutId, { reason: values.reason })
      if (action.kind === 'RELEASE_HOLD') return payoutService.releasePayoutHold(action.payout.payoutId, { reason: values.reason })
      if (action.kind === 'MARK_PAID') {
        if (!values.utrReference) throw new Error('UTR reference is required.')
        return payoutService.markPayoutPaid(action.payout.payoutId, { reason: values.reason, utrReference: values.utrReference, paidAt: values.paidAt })
      }
      if (action.kind === 'MARK_FAILED') return payoutService.markPayoutFailed(action.payout.payoutId, { reason: values.reason })
      throw new Error('Unsupported payout action.')
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: async (response) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Payout action completed.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payouts'] }),
        queryClient.invalidateQueries({ queryKey: ['payout-detail'] }),
      ])
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Payout action failed.')
    },
  })

  return (
    <PageContainer>
      <PageContextHeader title="Payouts" description="Review, create, and manage vendor payouts." actionNode={canApprovePayouts ? <Button size="sm" onClick={() => setSelectedAction({ kind: 'CREATE' })}><Plus className="mr-2 size-4" />Create Payout</Button> : null} />
      {actionMessage ? <div className="rounded-[1rem] border border-success/25 bg-success/10 p-3 text-sm text-success">{actionMessage}</div> : null}
      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="space-y-1"><span className="text-sm font-medium text-foreground">Search</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); reset() }} /></div></label>
          <OptionalSelect label="Status" options={statuses} value={status} onChange={(value) => { setStatus(value); reset() }} />
          <OptionalSelect label="Method" options={methods} value={payoutMethod} onChange={(value) => { setPayoutMethod(value); reset() }} />
          {[
            ['City', city, setCity], ['Zone ID', zoneId, setZoneId], ['Vendor ID', vendorId, setVendorId], ['Min Amount Paise', minAmountPaise, setMinAmountPaise], ['Max Amount Paise', maxAmountPaise, setMaxAmountPaise],
          ].map(([label, value, setter]) => <label className="space-y-1" key={label as string}><span className="text-sm font-medium text-foreground">{label as string}</span><Input value={value as string} onChange={(event) => { (setter as (value: string) => void)(event.target.value); reset() }} /></label>)}
          <label className="space-y-1"><span className="text-sm font-medium text-foreground">Date From</span><Input type="datetime-local" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); reset() }} /></label>
          <label className="space-y-1"><span className="text-sm font-medium text-foreground">Date To</span><Input type="datetime-local" value={dateTo} onChange={(event) => { setDateTo(event.target.value); reset() }} /></label>
        </div>
        {queryResult.isError ? <ErrorState title="Payout data unavailable" description={queryResult.error instanceof Error ? queryResult.error.message : 'We could not load payout data.'} onRetry={() => void queryResult.refetch()} /> : isLoading ? <TableSkeleton columns={columns} rowCount={8} hasActions hasFooter={Boolean(pagination)} /> : data.length === 0 ? <EmptyState title="No payouts found" description="No payout records matched the current filters." /> : <DynamicTable actionColumnLabel="Actions" columns={columns} data={data} getRowId={(row) => row.payoutId} title="Payouts" onRowClick={(row) => navigate(`${routePaths.payouts}/${row.payoutId}`)} pagination={pagination ? { page: pagination.page, pageSize: pagination.limit, total: pagination.totalItems, onPageChange: setPage, onPageSizeChange: (next) => { setLimit(next); setPage(1) }, rowsPerPageOptions: [10, 20, 50, 100] } : undefined} rowActions={(payout) => [
          { key: 'view', label: 'View Detail', icon: <Eye className="size-4" />, onClick: () => navigate(`${routePaths.payouts}/${payout.payoutId}`) },
          { key: 'approve', label: 'Approve', icon: <CheckCircle2 className="size-4" />, isVisible: canApprovePayouts && payout.availableActions.includes('APPROVE'), onClick: () => setSelectedAction({ kind: 'APPROVE', payout }) },
          { key: 'hold', label: 'Hold', icon: <PauseCircle className="size-4" />, isVisible: canApprovePayouts && payout.availableActions.includes('HOLD'), onClick: () => setSelectedAction({ kind: 'HOLD', payout }) },
          { key: 'release-hold', label: 'Release Hold', icon: <RotateCcw className="size-4" />, isVisible: canApprovePayouts && payout.availableActions.includes('RELEASE_HOLD'), onClick: () => setSelectedAction({ kind: 'RELEASE_HOLD', payout }) },
          { key: 'mark-paid', label: 'Mark Paid', icon: <CircleDollarSign className="size-4" />, isVisible: canApprovePayouts && payout.availableActions.includes('MARK_PAID'), onClick: () => setSelectedAction({ kind: 'MARK_PAID', payout }) },
          { key: 'mark-failed', label: 'Mark Failed', icon: <XCircle className="size-4" />, isVisible: canApprovePayouts && payout.availableActions.includes('MARK_FAILED'), variant: 'danger', onClick: () => setSelectedAction({ kind: 'MARK_FAILED', payout }) },
        ]} />}
        {pagination ? <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4"><p className="text-sm text-muted">Page {pagination.page} of {pagination.totalPages}</p><div className="flex gap-2"><Button disabled={!pagination.hasPreviousPage || isLoading} size="sm" variant="secondary" onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button><Button disabled={!pagination.hasNextPage || isLoading} size="sm" variant="secondary" onClick={() => setPage((current) => current + 1)}>Next</Button></div></div> : null}
      </section>
      <PayoutActionModal action={selectedAction} error={actionError} isSubmitting={mutation.isPending} onClose={() => { if (!mutation.isPending) { setSelectedAction(null); setActionError(null) } }} onSubmit={(values) => { if (selectedAction) void mutation.mutateAsync({ action: selectedAction, values }) }} />
    </PageContainer>
  )
}
