import { CheckCircle2, RefreshCcw, XCircle } from 'lucide-react'
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
import { formatMoney } from '../../../utils/formatMoney'
import { paymentService } from '../services/payment.service'
import { PaymentActionModal, type PaymentActionFormValues, type PaymentActionSelection } from './PaymentActionModal'
import type { AdminPaymentDetail, AdminRefundCore, AdminRefundSummary } from '../types/payment.types'

const refundColumns: DynamicTableColumn<AdminRefundCore>[] = [
  { key: 'refundId', label: 'Refund', minWidth: 220 },
  { key: 'status', label: 'Status', format: 'status', statusTone: (value) => value === 'SUCCESS' ? 'success' : value === 'REJECTED' || value === 'FAILED' ? 'danger' : 'warning' },
  { key: 'amountPaise', label: 'Amount', align: 'right', renderCell: (refund) => formatMoney(refund.amountPaise / 100) },
  { key: 'reason', label: 'Reason', minWidth: 240 },
]

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="space-y-1"><p className="text-xs font-semibold uppercase text-muted">{label}</p><p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p></div>
}

function HeaderStatus({ payment }: { payment: AdminPaymentDetail }) {
  return <div className="flex flex-wrap gap-2"><Badge tone={payment.status === 'SUCCESS' ? 'success' : payment.status === 'FAILED' ? 'danger' : 'warning'}>{payment.status}</Badge><Badge tone="info">{payment.gateway}</Badge></div>
}

function HeaderActions({ payment, isSubmitting, onSelect }: { payment: AdminPaymentDetail; isSubmitting: boolean; onSelect: (action: PaymentActionSelection) => void }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {payment.availableActions.includes('RECONCILE') ? <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelect({ kind: 'RECONCILE_PAYMENT', payment })}><RefreshCcw className="mr-2 size-4" />Reconcile</Button> : null}
    </div>
  )
}

export function PaymentDetailPage() {
  const { paymentId } = useParams()
  const queryClient = useQueryClient()
  const [selectedAction, setSelectedAction] = useState<PaymentActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const paymentQuery = useQuery({ enabled: Boolean(paymentId), queryKey: ['payment-detail', paymentId], queryFn: () => paymentService.getPaymentById(paymentId as string) })
  const payment = paymentQuery.data?.data

  const mutation = useMutation({
    mutationFn: async ({ action, values }: { action: PaymentActionSelection; values: PaymentActionFormValues }) => {
      if (action.kind === 'RECONCILE_PAYMENT') return paymentService.reconcilePayment(action.payment.paymentId, { reason: values.reason })
      if (action.kind === 'APPROVE_REFUND') {
        if (!values.reason) throw new Error('Approval reason is required.')
        return paymentService.approveRefund(action.refund.refundId, { reason: values.reason, processImmediately: values.processImmediately })
      }
      if (!values.reason) throw new Error('Rejection reason is required.')
      return paymentService.rejectRefund(action.refund.refundId, { reason: values.reason })
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void queryClient.invalidateQueries({ queryKey: ['payment-detail', paymentId] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : 'Payment action failed.'),
  })

  if (!paymentId) return <PageContainer><ErrorState title="Payment not found" description="The payment route is missing a payment id." /></PageContainer>
  if (paymentQuery.isLoading) return <PageContainer><Skeleton className="h-24 w-full" /><Skeleton className="h-[24rem] w-full" /></PageContainer>
  if (paymentQuery.isError) return <PageContainer><ErrorState title="Payment unavailable" description="We could not load this payment." onRetry={() => void paymentQuery.refetch()} /></PageContainer>
  if (!payment) return <PageContainer><EmptyState title="Payment not found" description="The payment detail API returned no data." /></PageContainer>

  return (
    <PageContainer>
      <DetailPageHeader actionNode={<HeaderActions payment={payment} isSubmitting={mutation.isPending} onSelect={setSelectedAction} />} description={`${payment.order.publicOrderId} · ${payment.customer.fullName}`} listHref={routePaths.payments} listLabel="Payments" recordName={payment.publicPaymentId} titleMetaNode={<HeaderStatus payment={payment} />} />
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Payment Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment ID" value={payment.paymentId} /><Field label="Amount" value={formatMoney(payment.amountPaise / 100)} /><Field label="Method" value={payment.method} /><Field label="Gateway" value={payment.gateway} /><Field label="Customer" value={payment.customer.fullName} /><Field label="Vendor" value={payment.vendor.shopName} /><Field label="Razorpay Payment ID" value={payment.razorpayPaymentId} /><Field label="Failure" value={payment.failureMessage} /><Field label="Warnings" value={payment.warnings.length ? payment.warnings.join(', ') : null} /><Field label="Next Action" value={payment.nextRecommendedAction} />
          </div>
        </div>
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Refund Summary</h2>
          <Field label="Refunds" value={payment.refundSummary.refundCount} /><Field label="Requested" value={payment.refundSummary.requestedCount} /><Field label="Committed" value={formatMoney(payment.refundSummary.committedAmountPaise / 100)} /><Field label="Remaining" value={formatMoney(payment.refundSummary.remainingRefundableAmountPaise / 100)} />
        </div>
      </section>
      <DynamicTable actionColumnLabel="Refund Actions" columns={refundColumns} data={payment.refunds} getRowId={(row) => row.refundId} title="Refunds" rowActions={(refund) => {
        const refundAction = refund as AdminRefundSummary
        return [
          { key: 'approve', label: 'Approve', icon: <CheckCircle2 className="size-4" />, isVisible: refund.status === 'REQUESTED', onClick: () => setSelectedAction({ kind: 'APPROVE_REFUND', refund: refundAction }) },
          { key: 'reject', label: 'Reject', icon: <XCircle className="size-4" />, isVisible: refund.status === 'REQUESTED', variant: 'danger', onClick: () => setSelectedAction({ kind: 'REJECT_REFUND', refund: refundAction }) },
        ]
      }} />
      <PaymentActionModal action={selectedAction} error={actionError} isSubmitting={mutation.isPending} onClose={() => { if (!mutation.isPending) { setSelectedAction(null); setActionError(null) } }} onSubmit={(values) => { if (selectedAction) void mutation.mutateAsync({ action: selectedAction, values }) }} />
    </PageContainer>
  )
}
