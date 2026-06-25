import { ArrowUpRight, CheckCircle2, RefreshCcw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
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
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { paymentService } from '../services/payment.service'
import {
  PaymentActionModal,
  type PaymentActionFormValues,
  type PaymentActionSelection,
} from './PaymentActionModal'
import type {
  AdminPaymentDetail,
  AdminPaymentStatus,
  AdminRefundCore,
} from '../types/payment.types'

const refundColumns: DynamicTableColumn<AdminRefundCore>[] = [
  { key: 'refundId', label: 'Refund', minWidth: 220 },
  {
    key: 'status',
    label: 'Status',
    format: 'status',
    statusTone: (value) =>
      value === 'SUCCESS'
        ? 'success'
        : value === 'REJECTED' || value === 'FAILED'
          ? 'danger'
          : 'warning',
  },
  {
    key: 'amountPaise',
    label: 'Amount',
    align: 'right',
    renderCell: (refund) => formatPaise(refund.amountPaise),
  },
  { key: 'reason', label: 'Reason', minWidth: 240 },
  {
    key: 'processedAt',
    label: 'Processed',
    minWidth: 170,
    renderCell: (refund) => formatDateSafe(refund.processedAt),
  },
]

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatPaise(value: number | null | undefined) {
  return formatMoney((value ?? 0) / 100)
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function paymentTone(status: AdminPaymentStatus) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'CREATED' || status === 'PENDING') return 'warning'
  return 'neutral'
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p
        className={cn(
          'text-xs font-semibold uppercase tracking-normal',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
          tone === 'info' && 'text-primary',
          tone === 'neutral' && 'text-muted',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-3 text-2xl font-semibold tracking-normal',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger',
          tone === 'info' && 'text-primary',
          tone === 'neutral' && 'text-foreground',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description?: string
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function HeaderStatus({ payment }: { payment: AdminPaymentDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={paymentTone(payment.status)}>{humanizeCode(payment.status)}</Badge>
      <Badge tone="info">{humanizeCode(payment.gateway)}</Badge>
      {payment.warnings.length > 0 ? (
        <Badge tone="warning">{payment.warnings.length} warning</Badge>
      ) : null}
    </div>
  )
}

function HeaderActions({
  canReconcile,
  isSubmitting,
  onSelect,
  onViewOrder,
  payment,
}: {
  canReconcile: boolean
  isSubmitting: boolean
  onSelect: (action: PaymentActionSelection) => void
  onViewOrder: () => void
  payment: AdminPaymentDetail
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="secondary" onClick={onViewOrder}>
        <ArrowUpRight className="mr-2 size-4" />
        View Order
      </Button>
      {canReconcile && payment.availableActions.includes('RECONCILE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect({ kind: 'RECONCILE_PAYMENT', payment })}
        >
          <RefreshCcw className="mr-2 size-4" />
          Reconcile
        </Button>
      ) : null}
    </div>
  )
}

export function PaymentDetailPage() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const [selectedAction, setSelectedAction] =
    useState<PaymentActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const canReconcile = can('payments:reconcile')
  const canReviewRefunds = can('payments:refund')

  const paymentQuery = useQuery({
    enabled: Boolean(paymentId),
    queryKey: ['payment-detail', paymentId],
    queryFn: () => paymentService.getPaymentById(paymentId as string),
  })
  const payment = paymentQuery.data?.data

  const mutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PaymentActionSelection
      values: PaymentActionFormValues
    }) => {
      if (action.kind === 'RECONCILE_PAYMENT') {
        return paymentService.reconcilePayment(action.payment.paymentId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'APPROVE_REFUND') {
        if (!values.reason) throw new Error('Approval reason is required.')
        return paymentService.approveRefund(action.refund.refundId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        })
      }

      if (!values.reason) throw new Error('Rejection reason is required.')
      return paymentService.rejectRefund(action.refund.refundId, {
        reason: values.reason,
      })
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Payment action completed.')
      void queryClient.invalidateQueries({ queryKey: ['payment-detail', paymentId] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })
      void queryClient.invalidateQueries({ queryKey: ['refunds'] })
    },
    onError: (error) =>
      setActionError(
        error instanceof Error ? error.message : 'Payment action failed.',
      ),
  })

  if (!paymentId) {
    return (
      <PageContainer>
        <ErrorState
          description="The payment route is missing a payment id."
          title="Payment not found"
        />
      </PageContainer>
    )
  }

  if (paymentQuery.isLoading) {
    return (
      <PageContainer className="space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[24rem] w-full" />
      </PageContainer>
    )
  }

  if (paymentQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this payment."
          title="Payment unavailable"
          onRetry={() => void paymentQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!payment) {
    return (
      <PageContainer>
        <EmptyState
          description="The payment detail API returned no data."
          title="Payment not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <HeaderActions
            canReconcile={canReconcile}
            isSubmitting={mutation.isPending}
            payment={payment}
            onSelect={setSelectedAction}
            onViewOrder={() => navigate(`${routePaths.orders}/${payment.order.orderId}`)}
          />
        }
        description={`${payment.order.publicOrderId} · ${payment.customer.fullName}`}
        listHref={routePaths.payments}
        listLabel="Payments"
        recordName={payment.publicPaymentId}
        titleMetaNode={<HeaderStatus payment={payment} />}
      />

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Amount"
          meta={payment.currency}
          tone={payment.status === 'SUCCESS' ? 'success' : 'neutral'}
          value={formatPaise(payment.amountPaise)}
        />
        <SummaryCard
          label="Refundable"
          meta={`${payment.refundSummary.refundCount} refund records`}
          tone={
            payment.refundSummary.remainingRefundableAmountPaise > 0
              ? 'info'
              : 'neutral'
          }
          value={formatPaise(payment.refundSummary.remainingRefundableAmountPaise)}
        />
        <SummaryCard
          label="Requested refunds"
          meta="Open refund review count"
          tone={payment.refundSummary.requestedCount > 0 ? 'warning' : 'neutral'}
          value={String(payment.refundSummary.requestedCount)}
        />
        <SummaryCard
          label="Warnings"
          meta={payment.nextRecommendedAction ?? 'No recommended action'}
          tone={payment.warnings.length > 0 ? 'danger' : 'neutral'}
          value={String(payment.warnings.length)}
        />
      </section>

      {payment.warnings.length > 0 ? (
        <section className="rounded-[0.875rem] border border-warning/25 bg-surface p-4 shadow-surface">
          <h2 className="text-base font-semibold text-warning">Warning signals</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {payment.warnings.map((warning) => (
              <Badge key={warning} tone="warning">
                {humanizeCode(warning)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <SectionShell
          description="Provider and reconciliation metadata from backend data."
          title="Payment Information"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Payment ID" value={payment.paymentId} />
            <DetailField label="Public Payment ID" value={payment.publicPaymentId} />
            <DetailField label="Status" value={humanizeCode(payment.status)} />
            <DetailField label="Amount" value={formatPaise(payment.amountPaise)} />
            <DetailField label="Method" value={humanizeCode(payment.method)} />
            <DetailField label="Gateway" value={humanizeCode(payment.gateway)} />
            <DetailField
              label="Razorpay Order ID"
              value={payment.razorpayOrderId}
            />
            <DetailField
              label="Razorpay Payment ID"
              value={payment.razorpayPaymentId}
            />
            <DetailField label="Verified At" value={formatDateSafe(payment.verifiedAt)} />
            <DetailField label="Failure Code" value={payment.failureCode} />
            <DetailField label="Failure Message" value={payment.failureMessage} />
            <DetailField
              label="Updated"
              value={formatDateSafe(payment.updatedAt)}
            />
          </div>
        </SectionShell>

        <SectionShell
          description="Current refund state attached to this payment."
          title="Refund Summary"
        >
          <div className="grid gap-3">
            <DetailField label="Refund records" value={payment.refundSummary.refundCount} />
            <DetailField label="Requested" value={payment.refundSummary.requestedCount} />
            <DetailField label="Approved" value={payment.refundSummary.approvedCount} />
            <DetailField label="Processing" value={payment.refundSummary.processingCount} />
            <DetailField
              label="Committed"
              value={formatPaise(payment.refundSummary.committedAmountPaise)}
            />
            <DetailField
              label="Successful"
              value={formatPaise(payment.refundSummary.successfulAmountPaise)}
            />
          </div>
        </SectionShell>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <SectionShell title="Order">
          <div className="grid gap-3">
            <DetailField label="Order" value={payment.order.publicOrderId} />
            <DetailField label="Order Status" value={humanizeCode(payment.order.orderStatus)} />
            <DetailField label="Payment Status" value={humanizeCode(payment.order.paymentStatus)} />
            <DetailField label="Final Price" value={formatPaise(payment.order.finalPricePaise)} />
          </div>
        </SectionShell>
        <SectionShell title="Customer">
          <div className="grid gap-3">
            <DetailField label="Name" value={payment.customer.fullName} />
            <DetailField label="Mobile" value={payment.customer.mobileNumber} />
            <DetailField label="Email" value={payment.customer.email} />
            <DetailField label="City" value={payment.customer.city} />
          </div>
        </SectionShell>
        <SectionShell title="Vendor">
          <div className="grid gap-3">
            <DetailField label="Shop" value={payment.vendor.shopName} />
            <DetailField label="Public Vendor ID" value={payment.vendor.publicVendorId} />
            <DetailField label="Status" value={humanizeCode(payment.vendor.vendorStatus)} />
            <DetailField
              label="Zone"
              value={
                payment.vendor.zone
                  ? `${payment.vendor.zone.city} · ${payment.vendor.zone.zoneName}`
                  : null
              }
            />
          </div>
        </SectionShell>
      </section>

      <SectionShell
        description="Refund records and review actions attached to this payment."
        title="Refunds"
      >
        {payment.refunds.length === 0 ? (
          <EmptyState
            description="No refunds are attached to this payment yet."
            title="No refunds"
          />
        ) : (
          <DynamicTable
            actionColumnLabel="Refund Actions"
            columns={refundColumns}
            data={payment.refunds}
            getRowId={(row) => row.refundId}
            title="Refunds"
            rowActions={(refund) => [
              {
                icon: <CheckCircle2 className="size-4" />,
                isVisible: canReviewRefunds && refund.status === 'REQUESTED',
                key: 'approve',
                label: 'Approve',
                onClick: () =>
                  setSelectedAction({ kind: 'APPROVE_REFUND', refund }),
              },
              {
                icon: <XCircle className="size-4" />,
                isVisible: canReviewRefunds && refund.status === 'REQUESTED',
                key: 'reject',
                label: 'Reject',
                onClick: () =>
                  setSelectedAction({ kind: 'REJECT_REFUND', refund }),
                variant: 'danger',
              },
            ]}
          />
        )}
      </SectionShell>

      <PaymentActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={mutation.isPending}
        onClose={() => {
          if (!mutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (selectedAction) {
            void mutation.mutateAsync({ action: selectedAction, values })
          }
        }}
      />
    </PageContainer>
  )
}
