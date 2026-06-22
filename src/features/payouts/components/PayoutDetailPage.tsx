import { CheckCircle2, CircleDollarSign, PauseCircle, RotateCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { DynamicTable, type DynamicTableColumn } from '../../../components/ui/Table'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { formatMoney } from '../../../utils/formatMoney'
import { payoutService } from '../services/payout.service'
import { PayoutActionModal, type PayoutActionFormValues, type PayoutActionKind, type PayoutActionSelection } from './PayoutActionModal'
import type { AdminPayoutDetail, AdminPayoutItem } from '../types/payout.types'

const itemColumns: DynamicTableColumn<AdminPayoutItem>[] = [
  { key: 'publicOrderId', label: 'Order', minWidth: 180, renderCell: (item) => item.order.publicOrderId },
  { key: 'amountPaise', label: 'Amount', align: 'right', renderCell: (item) => formatMoney(item.amountPaise / 100) },
  { key: 'status', label: 'Earning Status', format: 'status', statusTone: 'info', renderCell: (item) => item.earning.status },
  { key: 'createdAt', label: 'Created', format: 'date', minWidth: 180 },
]

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="space-y-1"><p className="text-xs font-semibold uppercase text-muted">{label}</p><p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p></div>
}

function HeaderStatus({ payout }: { payout: AdminPayoutDetail }) {
  return <div className="flex flex-wrap gap-2"><Badge tone={payout.status === 'PAID' ? 'success' : payout.status === 'FAILED' || payout.status === 'HELD' ? 'danger' : 'warning'}>{payout.status}</Badge><Badge tone="info">{payout.payoutMethod}</Badge></div>
}

function HeaderActions({ canApprovePayouts, payout, isSubmitting, onSelect }: { canApprovePayouts: boolean; payout: AdminPayoutDetail; isSubmitting: boolean; onSelect: (kind: PayoutActionKind) => void }) {
  const has = (action: string) => payout.availableActions.includes(action)
  if (!canApprovePayouts) {
    return null
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {has('APPROVE') ? <Button disabled={isSubmitting} size="sm" onClick={() => onSelect('APPROVE')}><CheckCircle2 className="mr-2 size-4" />Approve</Button> : null}
      {has('HOLD') ? <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelect('HOLD')}><PauseCircle className="mr-2 size-4" />Hold</Button> : null}
      {has('RELEASE_HOLD') ? <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelect('RELEASE_HOLD')}><RotateCcw className="mr-2 size-4" />Release Hold</Button> : null}
      {has('MARK_PAID') ? <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelect('MARK_PAID')}><CircleDollarSign className="mr-2 size-4" />Mark Paid</Button> : null}
      {has('MARK_FAILED') ? <Button disabled={isSubmitting} size="sm" variant="danger" onClick={() => onSelect('MARK_FAILED')}><XCircle className="mr-2 size-4" />Mark Failed</Button> : null}
    </div>
  )
}

export function PayoutDetailPage() {
  const { payoutId } = useParams()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const [selectedAction, setSelectedAction] = useState<PayoutActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const canApprovePayouts = can('payouts:approve')
  const payoutQuery = useQuery({ enabled: Boolean(payoutId), queryKey: ['payout-detail', payoutId], queryFn: () => payoutService.getPayoutById(payoutId as string) })
  const payout = payoutQuery.data?.data

  const mutation = useMutation({
    mutationFn: async ({ action, values }: { action: PayoutActionSelection; values: PayoutActionFormValues }) => {
      if (!action.payout || !values.reason) throw new Error('Payout details and reason are required.')
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
    onSuccess: (response) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Payout action completed.')
      void queryClient.invalidateQueries({ queryKey: ['payout-detail', payoutId] })
      void queryClient.invalidateQueries({ queryKey: ['payouts'] })
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Payout action failed.'),
  })

  if (!payoutId) return <PageContainer><ErrorState title="Payout not found" description="The payout route is missing a payout id." /></PageContainer>
  if (payoutQuery.isLoading) return <PageContainer><Skeleton className="h-24 w-full" /><Skeleton className="h-[24rem] w-full" /></PageContainer>
  if (payoutQuery.isError) return <PageContainer><ErrorState title="Payout unavailable" description={payoutQuery.error instanceof Error ? payoutQuery.error.message : 'We could not load this payout.'} onRetry={() => void payoutQuery.refetch()} /></PageContainer>
  if (!payout) return <PageContainer><EmptyState title="Payout not found" description="The payout detail API returned no data." /></PageContainer>

  return (
    <PageContainer>
      <DetailPageHeader actionNode={<HeaderActions canApprovePayouts={canApprovePayouts} payout={payout} isSubmitting={mutation.isPending} onSelect={(kind) => setSelectedAction({ kind, payout })} />} description={`${payout.vendor.shopName} · ${formatMoney(payout.totalAmountPaise / 100)}`} listHref={routePaths.payouts} listLabel="Payouts" recordName={payout.publicPayoutId} titleMetaNode={<HeaderStatus payout={payout} />} />
      {actionMessage ? <div className="rounded-[1rem] border border-success/25 bg-success/10 p-3 text-sm text-success">{actionMessage}</div> : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2"><h2 className="text-base font-semibold text-foreground">Payout Information</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Payout ID" value={payout.payoutId} /><Field label="Vendor" value={payout.vendor.shopName} /><Field label="Amount" value={formatMoney(payout.totalAmountPaise / 100)} /><Field label="UTR" value={payout.utrReference} /><Field label="Hold Reason" value={payout.holdReason} /><Field label="Failure Reason" value={payout.failureReason} /><Field label="Warnings" value={payout.warnings.length ? payout.warnings.join(', ') : null} /><Field label="Next Action" value={payout.nextRecommendedAction} /></div></div>
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4"><h2 className="text-base font-semibold text-foreground">Item Summary</h2><Field label="Items" value={payout.itemSummary.itemCount} /><Field label="Gross" value={formatMoney(payout.itemSummary.grossAmountPaise / 100)} /><Field label="Commission" value={formatMoney(payout.itemSummary.commissionAmountPaise / 100)} /><Field label="Net Payable" value={formatMoney(payout.itemSummary.netPayablePaise / 100)} /></div>
      </section>
      <DynamicTable columns={itemColumns} data={payout.items} getRowId={(row) => row.payoutItemId} title="Payout Items" />
      <PayoutActionModal action={selectedAction} error={actionError} isSubmitting={mutation.isPending} onClose={() => { if (!mutation.isPending) { setSelectedAction(null); setActionError(null) } }} onSubmit={(values) => { if (selectedAction) void mutation.mutateAsync({ action: selectedAction, values }) }} />
    </PageContainer>
  )
}
