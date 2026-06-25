import { ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
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
import type { AdminRefundDetail, AdminRefundStatus } from '../types/payment.types'

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

function refundTone(status: AdminRefundStatus) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'REJECTED') return 'danger'
  if (status === 'REQUESTED' || status === 'APPROVED' || status === 'PROCESSING') {
    return 'warning'
  }
  return 'neutral'
}

function metadataText(value: unknown) {
  if (value === null || value === undefined) return null

  if (typeof value === 'string') return value

  try {
    const text = JSON.stringify(value, null, 2)
    return text === '{}' ? null : text
  } catch {
    return String(value)
  }
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

function HeaderStatus({ refund }: { refund: AdminRefundDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={refundTone(refund.status)}>{humanizeCode(refund.status)}</Badge>
      <Badge tone="info">{humanizeCode(refund.payment.gateway)}</Badge>
      {refund.warnings.length > 0 ? (
        <Badge tone="warning">{refund.warnings.length} warning</Badge>
      ) : null}
    </div>
  )
}

function HeaderActions({
  canReviewRefunds,
  isSubmitting,
  onSelect,
  onViewOrder,
  onViewPayment,
  refund,
}: {
  canReviewRefunds: boolean
  isSubmitting: boolean
  onSelect: (action: PaymentActionSelection) => void
  onViewOrder: () => void
  onViewPayment: () => void
  refund: AdminRefundDetail
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="secondary" onClick={onViewPayment}>
        <ArrowUpRight className="mr-2 size-4" />
        View Payment
      </Button>
      <Button size="sm" type="button" variant="secondary" onClick={onViewOrder}>
        <ArrowUpRight className="mr-2 size-4" />
        View Order
      </Button>
      {canReviewRefunds && refund.availableActions.includes('APPROVE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect({ kind: 'APPROVE_REFUND', refund })}
        >
          <CheckCircle2 className="mr-2 size-4" />
          Approve
        </Button>
      ) : null}
      {canReviewRefunds && refund.availableActions.includes('REJECT') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="danger"
          onClick={() => onSelect({ kind: 'REJECT_REFUND', refund })}
        >
          <XCircle className="mr-2 size-4" />
          Reject
        </Button>
      ) : null}
    </div>
  )
}

export function RefundDetailPage() {
  const { refundId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canReviewRefunds = useAuthStore((state) => state.can('payments:refund'))
  const [selectedAction, setSelectedAction] =
    useState<PaymentActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const refundQuery = useQuery({
    enabled: Boolean(refundId),
    queryKey: ['refund-detail', refundId],
    queryFn: () => paymentService.getRefundById(refundId as string),
  })
  const refund = refundQuery.data?.data
  const metadata = metadataText(refund?.metadata)

  const mutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PaymentActionSelection
      values: PaymentActionFormValues
    }) => {
      if (action.kind === 'APPROVE_REFUND') {
        if (!values.reason) throw new Error('Approval reason is required.')
        return paymentService.approveRefund(action.refund.refundId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        })
      }

      if (action.kind === 'REJECT_REFUND') {
        if (!values.reason) throw new Error('Rejection reason is required.')
        return paymentService.rejectRefund(action.refund.refundId, {
          reason: values.reason,
        })
      }

      throw new Error('Unsupported refund action.')
    },
    onMutate: () => {
      setActionError(null)
      setActionMessage(null)
    },
    onSuccess: (response) => {
      setSelectedAction(null)
      setActionMessage(response.message ?? 'Refund updated.')
      void queryClient.invalidateQueries({ queryKey: ['refund-detail', refundId] })
      void queryClient.invalidateQueries({ queryKey: ['refunds'] })
      void queryClient.invalidateQueries({ queryKey: ['payments'] })

      if (refund?.paymentId) {
        void queryClient.invalidateQueries({
          queryKey: ['payment-detail', refund.paymentId],
        })
      }
    },
    onError: (error) =>
      setActionError(
        error instanceof Error ? error.message : 'Refund action failed.',
      ),
  })

  if (!refundId) {
    return (
      <PageContainer>
        <ErrorState
          description="The refund route is missing a refund id."
          title="Refund not found"
        />
      </PageContainer>
    )
  }

  if (refundQuery.isLoading) {
    return (
      <PageContainer className="space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[24rem] w-full" />
      </PageContainer>
    )
  }

  if (refundQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this refund."
          title="Refund unavailable"
          onRetry={() => void refundQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!refund) {
    return (
      <PageContainer>
        <EmptyState
          description="The refund detail API returned no data."
          title="Refund not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <HeaderActions
            canReviewRefunds={canReviewRefunds}
            isSubmitting={mutation.isPending}
            refund={refund}
            onSelect={setSelectedAction}
            onViewOrder={() => navigate(`${routePaths.orders}/${refund.order.orderId}`)}
            onViewPayment={() =>
              navigate(`${routePaths.payments}/${refund.payment.paymentId}`)
            }
          />
        }
        description={`${refund.publicPaymentId} · ${refund.order.publicOrderId}`}
        listHref={routePaths.refunds}
        listLabel="Refunds"
        recordName={refund.refundId}
        titleMetaNode={<HeaderStatus refund={refund} />}
      />

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Refund amount"
          meta={refund.currency}
          tone={refund.status === 'SUCCESS' ? 'success' : 'warning'}
          value={formatPaise(refund.amountPaise)}
        />
        <SummaryCard
          label="Payment amount"
          meta={humanizeCode(refund.payment.status)}
          tone={refund.payment.status === 'SUCCESS' ? 'success' : 'neutral'}
          value={formatPaise(refund.payment.amountPaise)}
        />
        <SummaryCard
          label="Refundable left"
          meta={`${refund.refundSummary.refundCount} refund records`}
          tone={
            refund.refundSummary.remainingRefundableAmountPaise > 0
              ? 'info'
              : 'neutral'
          }
          value={formatPaise(refund.refundSummary.remainingRefundableAmountPaise)}
        />
        <SummaryCard
          label="Warnings"
          meta={refund.nextRecommendedAction ?? 'No recommended action'}
          tone={refund.warnings.length > 0 ? 'danger' : 'neutral'}
          value={String(refund.warnings.length)}
        />
      </section>

      {refund.warnings.length > 0 ? (
        <section className="rounded-[0.875rem] border border-warning/25 bg-surface p-4 shadow-surface">
          <h2 className="text-base font-semibold text-warning">Warning signals</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {refund.warnings.map((warning) => (
              <Badge key={warning} tone="warning">
                {humanizeCode(warning)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <SectionShell
          description="Refund lifecycle, provider reference, and review metadata."
          title="Refund Information"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Refund ID" value={refund.refundId} />
            <DetailField label="Status" value={humanizeCode(refund.status)} />
            <DetailField label="Amount" value={formatPaise(refund.amountPaise)} />
            <DetailField label="Reason" value={refund.reason} />
            <DetailField label="Razorpay Refund ID" value={refund.razorpayRefundId} />
            <DetailField label="Created" value={formatDateSafe(refund.createdAt)} />
            <DetailField label="Updated" value={formatDateSafe(refund.updatedAt)} />
            <DetailField label="Processed" value={formatDateSafe(refund.processedAt)} />
          </div>
        </SectionShell>

        <SectionShell
          description="Who reviewed the refund and what happened next."
          title="Review"
        >
          <div className="grid gap-3">
            <DetailField label="Next Action" value={humanizeCode(refund.nextRecommendedAction)} />
            <DetailField label="Initiated By" value={refund.initiatedByAdminId} />
            <DetailField label="Approved By" value={refund.approvedByAdminId} />
            <DetailField label="Reviewed By" value={refund.reviewedByAdminId} />
            <DetailField label="Reviewed At" value={formatDateSafe(refund.reviewedAt)} />
            <DetailField label="Rejection Reason" value={refund.rejectionReason} />
          </div>
        </SectionShell>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <SectionShell title="Payment">
          <div className="grid gap-3">
            <DetailField label="Payment" value={refund.payment.publicPaymentId} />
            <DetailField label="Status" value={humanizeCode(refund.payment.status)} />
            <DetailField label="Method" value={humanizeCode(refund.payment.method)} />
            <DetailField label="Gateway" value={humanizeCode(refund.payment.gateway)} />
            <DetailField label="Amount" value={formatPaise(refund.payment.amountPaise)} />
          </div>
        </SectionShell>
        <SectionShell title="Order">
          <div className="grid gap-3">
            <DetailField label="Order" value={refund.order.publicOrderId} />
            <DetailField label="Order Status" value={humanizeCode(refund.order.orderStatus)} />
            <DetailField label="Payment Status" value={humanizeCode(refund.order.paymentStatus)} />
            <DetailField label="Final Price" value={formatPaise(refund.order.finalPricePaise)} />
          </div>
        </SectionShell>
        <SectionShell title="Customer">
          <div className="grid gap-3">
            <DetailField label="Name" value={refund.customer.fullName} />
            <DetailField label="Mobile" value={refund.customer.mobileNumber} />
            <DetailField label="Email" value={refund.customer.email} />
            <DetailField label="City" value={refund.customer.city} />
          </div>
        </SectionShell>
      </section>

      <SectionShell title="Vendor">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Shop" value={refund.vendor.shopName} />
          <DetailField label="Public Vendor ID" value={refund.vendor.publicVendorId} />
          <DetailField label="Status" value={humanizeCode(refund.vendor.vendorStatus)} />
          <DetailField
            label="Zone"
            value={
              refund.vendor.zone
                ? `${refund.vendor.zone.city} · ${refund.vendor.zone.zoneName}`
                : null
            }
          />
        </div>
      </SectionShell>

      {metadata ? (
        <SectionShell title="Metadata">
          <pre className="max-h-80 overflow-auto rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-xs text-foreground">
            {metadata}
          </pre>
        </SectionShell>
      ) : null}

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
