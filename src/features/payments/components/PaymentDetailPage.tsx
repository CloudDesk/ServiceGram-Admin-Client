import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Store,
  UserRound,
  XCircle,
} from 'lucide-react'
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
import { usePermission } from '../../../hooks/usePermission'
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

const paymentSectionIds = {
  information: 'payment-information',
  metadata: 'payment-metadata',
  refunds: 'payment-refunds',
} as const

type PaymentSectionId = (typeof paymentSectionIds)[keyof typeof paymentSectionIds]

const refundColumns: DynamicTableColumn<AdminRefundCore>[] = [
  {
    key: 'refund',
    label: 'Refund',
    minWidth: 260,
    renderCell: (refund) => (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{refund.refundId}</p>
          <Badge tone={refundTone(refund.status)}>
            {humanizeCode(refund.status)}
          </Badge>
        </div>
        <p className="mt-1 truncate text-xs text-muted">
          Created {formatDateSafe(refund.createdAt)}
        </p>
      </div>
    ),
  },
  {
    key: 'amountPaise',
    label: 'Amount',
    align: 'right',
    minWidth: 160,
    renderCell: (refund) => (
      <p className="font-semibold text-foreground">
        {formatPaise(refund.amountPaise, refund.currency)}
      </p>
    ),
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 280,
    renderCell: (refund) => (
      <p className="line-clamp-2 text-sm text-foreground">{refund.reason}</p>
    ),
  },
  {
    key: 'review',
    label: 'Review',
    minWidth: 220,
    renderCell: (refund) => (
      <div>
        <p className="font-medium text-foreground">
          {refund.reviewedAt
            ? `Reviewed ${formatDateSafe(refund.reviewedAt)}`
            : 'Awaiting review'}
        </p>
        <p className="mt-1 text-xs text-muted">
          {refund.processedAt
            ? `Processed ${formatDateSafe(refund.processedAt)}`
            : refund.razorpayRefundId ?? 'Provider pending'}
        </p>
      </div>
    ),
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

function formatPaise(value: number | null | undefined, currency = 'INR') {
  if (value == null) return 'Not available'
  return formatMoney(value / 100, currency)
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

function refundTone(status: string) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'REJECTED') return 'danger'
  if (status === 'APPROVED' || status === 'PROCESSING') return 'info'
  return 'warning'
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

function TableToolbar({
  actionNode,
  count,
  description,
  icon,
  title,
}: {
  actionNode?: React.ReactNode
  count: number
  description: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <Badge tone="neutral">{count}</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      </div>
      {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
    </div>
  )
}

function SectionShell({
  children,
  description,
  id,
  title,
}: {
  children: React.ReactNode
  description?: string
  id?: string
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
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

function RelatedRecordRow({
  actionLabel = 'Open',
  canOpen,
  icon,
  label,
  meta,
  onOpen,
  value,
}: {
  actionLabel?: string
  canOpen: boolean
  icon: React.ReactNode
  label: string
  meta: string
  onOpen?: () => void
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
      {canOpen && onOpen ? (
        <Button className="shrink-0" size="sm" variant="secondary" onClick={onOpen}>
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function buildPaymentAuditPath(payment: AdminPaymentDetail) {
  const params = new URLSearchParams({
    moduleCode: 'payments',
    entityType: 'payment',
    entityId: payment.paymentId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildPaymentRefundsPath(payment: AdminPaymentDetail) {
  const params = new URLSearchParams({
    paymentId: payment.paymentId,
    paymentLabel: payment.publicPaymentId,
  })

  return `${routePaths.refunds}?${params.toString()}`
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
  canReadOrders,
  canReconcile,
  isSubmitting,
  onSelect,
  onViewOrder,
  payment,
}: {
  canReadOrders: boolean
  canReconcile: boolean
  isSubmitting: boolean
  onSelect: (action: PaymentActionSelection) => void
  onViewOrder: () => void
  payment: AdminPaymentDetail
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canReadOrders ? (
        <Button size="sm" type="button" variant="secondary" onClick={onViewOrder}>
          <ArrowUpRight className="mr-2 size-4" />
          View Order
        </Button>
      ) : null}
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
  const [selectedAction, setSelectedAction] =
    useState<PaymentActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const canReadOrders = usePermission('orders:read')
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canReadRefunds = usePermission('payments:read')
  const canReadAudit = usePermission('audit:read')
  const canReconcile = usePermission('payments:reconcile')
  const canReviewRefunds = usePermission('payments:refund')

  const paymentQuery = useQuery({
    enabled: Boolean(paymentId),
    queryKey: ['payment-detail', paymentId],
    queryFn: () => paymentService.getPaymentById(paymentId as string),
  })
  const payment = paymentQuery.data?.data
  const metadata = metadataText(payment?.metadata)

  const openSection = (sectionId: PaymentSectionId) => {
    const section = document.getElementById(sectionId)

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (section) {
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }

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

      if (payment?.order.orderId) {
        void queryClient.invalidateQueries({
          queryKey: ['order-detail', payment.order.orderId],
        })
      }
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
            canReadOrders={canReadOrders}
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

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Primary records and child finance views linked to this payment."
          title="Related records"
        >
          <div className="divide-y divide-border">
            <RelatedRecordRow
              canOpen={canReadOrders}
              icon={<ReceiptText className="size-4" />}
              label="Order"
              meta={`${humanizeCode(payment.order.orderStatus)} · ${humanizeCode(payment.order.paymentStatus)}`}
              value={payment.order.publicOrderId}
              onOpen={() => navigate(`${routePaths.orders}/${payment.order.orderId}`)}
            />
            <RelatedRecordRow
              canOpen={canReadCustomers}
              icon={<UserRound className="size-4" />}
              label="Customer"
              meta={payment.customer.mobileNumber ?? payment.customer.email ?? payment.customer.status}
              value={payment.customer.fullName}
              onOpen={() => navigate(`${routePaths.customers}/${payment.customer.customerId}`)}
            />
            <RelatedRecordRow
              canOpen={canReadVendors}
              icon={<Store className="size-4" />}
              label="Vendor"
              meta={`${payment.vendor.publicVendorId} · ${payment.vendor.zone?.zoneName ?? payment.vendor.city}`}
              value={payment.vendor.shopName}
              onOpen={() => navigate(`${routePaths.vendors}/${payment.vendor.vendorId}`)}
            />
            <RelatedRecordRow
              actionLabel="Review"
              canOpen
              icon={<RotateCcw className="size-4" />}
              label="Refund records"
              meta={`${payment.refundSummary.requestedCount} requested · ${formatPaise(payment.refundSummary.remainingRefundableAmountPaise, payment.currency)} refundable`}
              value={`${payment.refunds.length} records on this payment`}
              onOpen={() => openSection(paymentSectionIds.refunds)}
            />
            <RelatedRecordRow
              actionLabel="Queue"
              canOpen={canReadRefunds}
              icon={<RotateCcw className="size-4" />}
              label="Refund queue"
              meta="Filtered by this payment id"
              value={payment.publicPaymentId}
              onOpen={() => navigate(buildPaymentRefundsPath(payment))}
            />
            <RelatedRecordRow
              actionLabel="Audit"
              canOpen={canReadAudit}
              icon={<ClipboardList className="size-4" />}
              label="Audit trail"
              meta="Filtered by module, entity type, and payment id"
              value={payment.paymentId}
              onOpen={() => navigate(buildPaymentAuditPath(payment))}
            />
          </div>
        </SectionShell>

        <SectionShell
          description="Backend workflow signals and permitted finance actions."
          title="Signals"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Warnings
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payment.warnings.length ? (
                  payment.warnings.map((warning) => (
                    <Badge key={warning} tone="warning">
                      {humanizeCode(warning)}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="success">No warnings</Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Available actions
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {payment.availableActions.length ? (
                  payment.availableActions.map((action) => (
                    <Badge key={action} tone="neutral">
                      {humanizeCode(action)}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="neutral">No actions</Badge>
                )}
              </div>
            </div>
            <DetailField
              label="Recommended next"
              value={humanizeCode(payment.nextRecommendedAction)}
            />
          </div>
        </SectionShell>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <SectionShell
          description="Provider and reconciliation metadata from backend data."
          id={paymentSectionIds.information}
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

      <SectionShell
        description="Refund records and review actions attached to this payment."
        id={paymentSectionIds.refunds}
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
            actionColumnMinWidth={260}
            bodyMaxHeight={360}
            columns={refundColumns}
            data={payment.refunds}
            getRowId={(row) => row.refundId}
            stickyHeader
            title="Refunds"
            toolbar={
              <TableToolbar
                count={payment.refunds.length}
                description="Refund requests, provider state, and permitted review actions."
                icon={<RotateCcw className="size-4" />}
                title="Refunds"
              />
            }
            rowActions={(refund) => [
              {
                icon: <ArrowUpRight className="size-4" />,
                isVisible: canReadRefunds,
                key: 'open',
                label: 'Open',
                onClick: () => navigate(`${routePaths.refunds}/${refund.refundId}`),
                variant: 'ghost',
              },
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
            onRowClick={
              canReadRefunds
                ? (refund) => navigate(`${routePaths.refunds}/${refund.refundId}`)
                : undefined
            }
          />
        )}
      </SectionShell>

      {metadata ? (
        <SectionShell
          description="Provider and workflow metadata returned by the API."
          id={paymentSectionIds.metadata}
          title="Metadata"
        >
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
