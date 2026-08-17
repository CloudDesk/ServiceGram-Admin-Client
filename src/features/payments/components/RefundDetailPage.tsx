import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  RefreshCcw,
  ReceiptText,
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
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { OverflowText } from '../../../components/ui/OverflowText'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import {
  RecordField,
  RecordMetricStrip,
} from '../../../components/ui/RecordPage'
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
import type { AdminRefundDetail, AdminRefundStatus } from '../types/payment.types'

const refundSectionIds = {
  financialContext: 'refund-financial-context',
  information: 'refund-information',
  metadata: 'refund-metadata',
} as const

type RefundSectionId = (typeof refundSectionIds)[keyof typeof refundSectionIds]

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
  return <RecordField label={label} value={value} />
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
          <OverflowText
            as="p"
            className="mt-1 text-sm font-semibold text-foreground"
            title={value}
          >
            {value}
          </OverflowText>
          <OverflowText as="p" className="mt-1 text-xs text-muted" title={meta}>
            {meta}
          </OverflowText>
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

function buildRefundAuditPath(refund: AdminRefundDetail) {
  const params = new URLSearchParams({
    moduleCode: 'payments',
    entityType: 'refund',
    entityId: refund.refundId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildPaymentRefundsPath(refund: AdminRefundDetail) {
  const params = new URLSearchParams({
    paymentId: refund.payment.paymentId,
    paymentLabel: refund.payment.publicPaymentId,
  })

  return `${routePaths.refunds}?${params.toString()}`
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
  canReadOrders,
  canReadPayments,
  canReviewRefunds,
  isRefreshing,
  isSubmitting,
  onRefresh,
  onSelect,
  onViewOrder,
  onViewPayment,
  refund,
}: {
  canReadOrders: boolean
  canReadPayments: boolean
  canReviewRefunds: boolean
  isRefreshing: boolean
  isSubmitting: boolean
  onRefresh: () => void
  onSelect: (action: PaymentActionSelection) => void
  onViewOrder: () => void
  onViewPayment: () => void
  refund: AdminRefundDetail
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        aria-label={isRefreshing ? 'Refreshing refund' : 'Refresh refund'}
        size="sm"
        title={isRefreshing ? 'Refreshing refund' : 'Refresh refund'}
        type="button"
        variant="secondary"
        onClick={onRefresh}
      >
        <RefreshCcw
          className={cn(
            'mr-2 size-4',
            isRefreshing && 'animate-spin motion-reduce:animate-none',
          )}
        />
        Refresh
      </Button>
      {canReadPayments ? (
        <Button size="sm" type="button" variant="secondary" onClick={onViewPayment}>
          <ArrowUpRight className="mr-2 size-4" />
          View Payment
        </Button>
      ) : null}
      {canReadOrders ? (
        <Button size="sm" type="button" variant="secondary" onClick={onViewOrder}>
          <ArrowUpRight className="mr-2 size-4" />
          View Order
        </Button>
      ) : null}
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
  const canReadOrders = usePermission('orders:read')
  const canReadPayments = usePermission('payments:read')
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canReadAudit = usePermission('audit:read')
  const canReviewRefunds = usePermission('payments:refund')
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

  const openSection = (sectionId: RefundSectionId) => {
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

      if (refund?.orderId) {
        void queryClient.invalidateQueries({
          queryKey: ['order-detail', refund.orderId],
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
        <DetailPageHeaderSkeleton />
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
            canReadOrders={canReadOrders}
            canReadPayments={canReadPayments}
            canReviewRefunds={canReviewRefunds}
            isRefreshing={refundQuery.isFetching}
            isSubmitting={mutation.isPending}
            refund={refund}
            onRefresh={() => void refundQuery.refetch()}
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

      <RecordMetricStrip
        ariaLabel="Refund summary"
        metrics={[
          {
            label: 'Refund',
            value: formatPaise(refund.amountPaise),
            tone: refund.status === 'SUCCESS' ? 'success' : 'warning',
          },
          {
            label: 'Payment',
            value: formatPaise(refund.payment.amountPaise),
            tone: refund.payment.status === 'SUCCESS' ? 'success' : undefined,
          },
          {
            label: 'Refundable left',
            value: formatPaise(
              refund.refundSummary.remainingRefundableAmountPaise,
            ),
          },
          {
            label: 'Refunds',
            value: String(refund.refundSummary.refundCount),
          },
          {
            label: 'Signals',
            value: String(refund.warnings.length),
            tone: refund.warnings.length > 0 ? 'danger' : 'success',
          },
        ]}
      />

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Primary records and finance context linked to this refund."
          title="Related records"
        >
          <div className="divide-y divide-border">
            <RelatedRecordRow
              canOpen={canReadPayments}
              icon={<CreditCard className="size-4" />}
              label="Payment"
              meta={`${humanizeCode(refund.payment.status)} · ${humanizeCode(refund.payment.gateway)}`}
              value={refund.payment.publicPaymentId}
              onOpen={() => navigate(`${routePaths.payments}/${refund.payment.paymentId}`)}
            />
            <RelatedRecordRow
              canOpen={canReadOrders}
              icon={<ReceiptText className="size-4" />}
              label="Order"
              meta={`${humanizeCode(refund.order.orderStatus)} · ${humanizeCode(refund.order.paymentStatus)}`}
              value={refund.order.publicOrderId}
              onOpen={() => navigate(`${routePaths.orders}/${refund.order.orderId}`)}
            />
            <RelatedRecordRow
              canOpen={canReadCustomers}
              icon={<UserRound className="size-4" />}
              label="Customer"
              meta={refund.customer.mobileNumber ?? refund.customer.email ?? refund.customer.status}
              value={refund.customer.fullName}
              onOpen={() => navigate(`${routePaths.customers}/${refund.customer.customerId}`)}
            />
            <RelatedRecordRow
              canOpen={canReadVendors}
              icon={<Store className="size-4" />}
              label="Vendor"
              meta={`${refund.vendor.publicVendorId} · ${refund.vendor.zone?.zoneName ?? refund.vendor.city}`}
              value={refund.vendor.shopName}
              onOpen={() => navigate(`${routePaths.vendors}/${refund.vendor.vendorId}`)}
            />
            <RelatedRecordRow
              actionLabel="Context"
              canOpen
              icon={<CreditCard className="size-4" />}
              label="Financial context"
              meta="Payment amount, committed refunds, and remaining refundable value"
              value={formatPaise(refund.refundSummary.remainingRefundableAmountPaise, refund.currency)}
              onOpen={() => openSection(refundSectionIds.financialContext)}
            />
            <RelatedRecordRow
              actionLabel="Queue"
              canOpen={canReadPayments}
              icon={<RotateCcw className="size-4" />}
              label="Sibling refunds"
              meta="Filtered by this payment id"
              value={`${refund.refundSummary.refundCount} refunds on payment`}
              onOpen={() => navigate(buildPaymentRefundsPath(refund))}
            />
            <RelatedRecordRow
              actionLabel="Audit"
              canOpen={canReadAudit}
              icon={<ClipboardList className="size-4" />}
              label="Audit trail"
              meta="Filtered by module, entity type, and refund id"
              value={refund.refundId}
              onOpen={() => navigate(buildRefundAuditPath(refund))}
            />
          </div>
        </SectionShell>

        <SectionShell
          description="Backend warning signals and permitted refund actions."
          title="Signals"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Warnings
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {refund.warnings.length ? (
                  refund.warnings.map((warning) => (
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
                {refund.availableActions.length ? (
                  refund.availableActions.map((action) => (
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
              value={humanizeCode(refund.nextRecommendedAction)}
            />
          </div>
        </SectionShell>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <SectionShell
          description="Refund lifecycle, provider reference, and review metadata."
          id={refundSectionIds.information}
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

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Payment and order values used to evaluate this refund."
          id={refundSectionIds.financialContext}
          title="Financial context"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailField label="Payment Amount" value={formatPaise(refund.payment.amountPaise, refund.payment.currency)} />
            <DetailField label="Payment Status" value={humanizeCode(refund.payment.status)} />
            <DetailField label="Payment Method" value={humanizeCode(refund.payment.method)} />
            <DetailField label="Order Final Price" value={formatPaise(refund.order.finalPricePaise, refund.order.currency)} />
            <DetailField label="Committed Refunds" value={formatPaise(refund.refundSummary.committedAmountPaise, refund.currency)} />
            <DetailField label="Successful Refunds" value={formatPaise(refund.refundSummary.successfulAmountPaise, refund.currency)} />
          </div>
        </SectionShell>

        <SectionShell
          description="Remaining amount after committed refund activity."
          title="Refund summary"
        >
          <div className="grid gap-3">
            <DetailField label="Refund Records" value={refund.refundSummary.refundCount} />
            <DetailField label="Requested" value={refund.refundSummary.requestedCount} />
            <DetailField label="Approved" value={refund.refundSummary.approvedCount} />
            <DetailField label="Processing" value={refund.refundSummary.processingCount} />
            <DetailField
              label="Remaining Refundable"
              value={formatPaise(refund.refundSummary.remainingRefundableAmountPaise, refund.currency)}
            />
          </div>
        </SectionShell>
      </section>

      <SectionShell
        description="Vendor and category context for this refund."
        title="Service context"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DetailField label="Vendor" value={refund.vendor.shopName} />
          <DetailField label="Public Vendor ID" value={refund.vendor.publicVendorId} />
          <DetailField label="Vendor Status" value={humanizeCode(refund.vendor.vendorStatus)} />
          <DetailField label="Category" value={refund.category?.name} />
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
        <SectionShell id={refundSectionIds.metadata} title="Metadata">
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
