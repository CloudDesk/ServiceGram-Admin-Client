import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  PauseCircle,
  RefreshCcw,
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
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import { payoutService } from '../services/payout.service'
import {
  PayoutActionModal,
  type PayoutActionFormValues,
  type PayoutActionKind,
  type PayoutActionSelection,
} from './PayoutActionModal'
import type {
  AdminPayoutDetail,
  AdminPayoutItem,
  AdminPayoutStatus,
} from '../types/payout.types'

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

function payoutTone(status: AdminPayoutStatus) {
  if (status === 'PAID') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'HELD') {
    return 'danger'
  }
  if (status === 'APPROVED') return 'info'
  if (status === 'PENDING' || status === 'UNDER_REVIEW') return 'warning'
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

const itemColumns: DynamicTableColumn<AdminPayoutItem>[] = [
  {
    key: 'publicOrderId',
    label: 'Order',
    minWidth: 200,
    renderCell: (item) => (
      <div>
        <p className="font-semibold text-foreground">{item.order.publicOrderId}</p>
        <p className="text-xs text-muted">{humanizeCode(item.order.orderStatus)}</p>
      </div>
    ),
  },
  {
    key: 'amountPaise',
    label: 'Amount',
    align: 'right',
    minWidth: 140,
    renderCell: (item) => formatPaise(item.amountPaise),
  },
  {
    key: 'status',
    label: 'Earning',
    minWidth: 180,
    renderCell: (item) => (
      <div>
        <Badge tone="info">{humanizeCode(item.earning.status)}</Badge>
        <p className="mt-1 text-xs text-muted">
          Eligible {formatDateSafe(item.earning.eligibilityDate)}
        </p>
      </div>
    ),
  },
  {
    key: 'deductions',
    label: 'Deductions',
    minWidth: 190,
    renderCell: (item) => (
      <div>
        <p className="text-sm text-foreground">
          Commission {formatPaise(item.earning.commissionAmountPaise)}
        </p>
        <p className="text-xs text-muted">
          Logistics {formatPaise(item.earning.logisticsDeductionPaise)}
        </p>
      </div>
    ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    minWidth: 170,
    renderCell: (item) => formatDateSafe(item.createdAt),
  },
]

function HeaderStatus({ payout }: { payout: AdminPayoutDetail }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={payoutTone(payout.status)}>{humanizeCode(payout.status)}</Badge>
      <Badge tone="info">{humanizeCode(payout.payoutMethod)}</Badge>
      {payout.warnings.length > 0 ? (
        <Badge tone="warning">{payout.warnings.length} warning</Badge>
      ) : null}
    </div>
  )
}

function HeaderActions({
  canApprovePayouts,
  isSubmitting,
  onSelect,
  onViewVendor,
  payout,
}: {
  canApprovePayouts: boolean
  isSubmitting: boolean
  onSelect: (kind: PayoutActionKind) => void
  onViewVendor: () => void
  payout: AdminPayoutDetail
}) {
  const has = (action: string) => payout.availableActions.includes(action)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="secondary" onClick={onViewVendor}>
        <ArrowUpRight className="mr-2 size-4" />
        View Vendor
      </Button>
      {canApprovePayouts && has('APPROVE') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('APPROVE')}
        >
          <CheckCircle2 className="mr-2 size-4" />
          Approve
        </Button>
      ) : null}
      {canApprovePayouts && has('HOLD') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('HOLD')}
        >
          <PauseCircle className="mr-2 size-4" />
          Hold
        </Button>
      ) : null}
      {canApprovePayouts && has('RELEASE_HOLD') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('RELEASE_HOLD')}
        >
          <RefreshCcw className="mr-2 size-4" />
          Release
        </Button>
      ) : null}
      {canApprovePayouts && has('MARK_PAID') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('MARK_PAID')}
        >
          <CircleDollarSign className="mr-2 size-4" />
          Mark Paid
        </Button>
      ) : null}
      {canApprovePayouts && has('MARK_FAILED') ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="danger"
          onClick={() => onSelect('MARK_FAILED')}
        >
          <XCircle className="mr-2 size-4" />
          Mark Failed
        </Button>
      ) : null}
    </div>
  )
}

export function PayoutDetailPage() {
  const { payoutId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canApprovePayouts = useAuthStore((state) => state.can('payouts:approve'))
  const [selectedAction, setSelectedAction] =
    useState<PayoutActionSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const payoutQuery = useQuery({
    enabled: Boolean(payoutId),
    queryKey: ['payout-detail', payoutId],
    queryFn: () => payoutService.getPayoutById(payoutId as string),
  })
  const payout = payoutQuery.data?.data
  const metadata = metadataText(payout?.metadata)

  const mutation = useMutation({
    mutationFn: async ({
      action,
      values,
    }: {
      action: PayoutActionSelection
      values: PayoutActionFormValues
    }) => {
      if (!action.payout || !values.reason) {
        throw new Error('Payout details and reason are required.')
      }

      if (action.kind === 'APPROVE') {
        return payoutService.approvePayout(action.payout.payoutId, {
          processImmediately: values.processImmediately,
          reason: values.reason,
        })
      }

      if (action.kind === 'HOLD') {
        return payoutService.holdPayout(action.payout.payoutId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'RELEASE_HOLD') {
        return payoutService.releasePayoutHold(action.payout.payoutId, {
          reason: values.reason,
        })
      }

      if (action.kind === 'MARK_PAID') {
        if (!values.utrReference) throw new Error('UTR reference is required.')
        return payoutService.markPayoutPaid(action.payout.payoutId, {
          paidAt: values.paidAt,
          reason: values.reason,
          utrReference: values.utrReference,
        })
      }

      if (action.kind === 'MARK_FAILED') {
        return payoutService.markPayoutFailed(action.payout.payoutId, {
          reason: values.reason,
        })
      }

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
    onError: (error) =>
      setActionError(
        error instanceof Error ? error.message : 'Payout action failed.',
      ),
  })

  if (!payoutId) {
    return (
      <PageContainer>
        <ErrorState
          description="The payout route is missing a payout id."
          title="Payout not found"
        />
      </PageContainer>
    )
  }

  if (payoutQuery.isLoading) {
    return (
      <PageContainer className="space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[24rem] w-full" />
      </PageContainer>
    )
  }

  if (payoutQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description={
            payoutQuery.error instanceof Error
              ? payoutQuery.error.message
              : 'We could not load this payout.'
          }
          title="Payout unavailable"
          onRetry={() => void payoutQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!payout) {
    return (
      <PageContainer>
        <EmptyState
          description="The payout detail API returned no data."
          title="Payout not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="space-y-3 !px-3 !py-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <HeaderActions
            canApprovePayouts={canApprovePayouts}
            isSubmitting={mutation.isPending}
            payout={payout}
            onSelect={(kind) => setSelectedAction({ kind, payout })}
            onViewVendor={() => navigate(`${routePaths.vendors}/${payout.vendor.vendorId}`)}
          />
        }
        description={`${payout.vendor.shopName} · ${formatPaise(payout.totalAmountPaise)}`}
        listHref={routePaths.payouts}
        listLabel="Payouts"
        recordName={payout.publicPayoutId}
        titleMetaNode={<HeaderStatus payout={payout} />}
      />

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Payout amount"
          meta={payout.currency}
          tone={payout.status === 'PAID' ? 'success' : 'info'}
          value={formatPaise(payout.totalAmountPaise)}
        />
        <SummaryCard
          label="Net payable"
          meta={`${payout.itemSummary.itemCount} payout items`}
          tone="info"
          value={formatPaise(payout.itemSummary.netPayablePaise)}
        />
        <SummaryCard
          label="Gross value"
          meta={`Commission ${formatPaise(payout.itemSummary.commissionAmountPaise)}`}
          tone="neutral"
          value={formatPaise(payout.itemSummary.grossAmountPaise)}
        />
        <SummaryCard
          label="Warnings"
          meta={payout.nextRecommendedAction ?? 'No recommended action'}
          tone={payout.warnings.length > 0 ? 'danger' : 'neutral'}
          value={String(payout.warnings.length)}
        />
      </section>

      {payout.warnings.length > 0 ? (
        <section className="rounded-[0.875rem] border border-warning/25 bg-surface p-4 shadow-surface">
          <h2 className="text-base font-semibold text-warning">Warning signals</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {payout.warnings.map((warning) => (
              <Badge key={warning} tone="warning">
                {humanizeCode(warning)}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <SectionShell
          description="Finance lifecycle and settlement metadata for this payout."
          title="Payout Information"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Payout ID" value={payout.payoutId} />
            <DetailField label="Public Payout ID" value={payout.publicPayoutId} />
            <DetailField label="Status" value={humanizeCode(payout.status)} />
            <DetailField label="Method" value={humanizeCode(payout.payoutMethod)} />
            <DetailField label="Amount" value={formatPaise(payout.totalAmountPaise)} />
            <DetailField label="UTR Reference" value={payout.utrReference} />
            <DetailField label="Created" value={formatDateSafe(payout.createdAt)} />
            <DetailField label="Updated" value={formatDateSafe(payout.updatedAt)} />
          </div>
        </SectionShell>

        <SectionShell
          description="Current review, hold, and payment state."
          title="Settlement"
        >
          <div className="grid gap-3">
            <DetailField label="Next Action" value={humanizeCode(payout.nextRecommendedAction)} />
            <DetailField label="Approved By" value={payout.approvedByAdminId} />
            <DetailField label="Approved At" value={formatDateSafe(payout.approvedAt)} />
            <DetailField label="Paid At" value={formatDateSafe(payout.paidAt)} />
            <DetailField label="Hold Reason" value={payout.holdReason} />
            <DetailField label="Failure Reason" value={payout.failureReason} />
          </div>
        </SectionShell>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <SectionShell title="Vendor">
          <div className="grid gap-3">
            <DetailField label="Shop" value={payout.vendor.shopName} />
            <DetailField label="Public Vendor ID" value={payout.vendor.publicVendorId} />
            <DetailField label="Status" value={humanizeCode(payout.vendor.vendorStatus)} />
            <DetailField label="City" value={payout.vendor.city} />
            <DetailField
              label="Zone"
              value={
                payout.vendor.zone
                  ? `${payout.vendor.zone.city} · ${payout.vendor.zone.zoneName}`
                  : null
              }
            />
          </div>
        </SectionShell>

        <SectionShell title="Item Summary">
          <div className="grid gap-3">
            <DetailField label="Items" value={payout.itemSummary.itemCount} />
            <DetailField label="Gross" value={formatPaise(payout.itemSummary.grossAmountPaise)} />
            <DetailField label="Commission" value={formatPaise(payout.itemSummary.commissionAmountPaise)} />
            <DetailField label="Logistics" value={formatPaise(payout.itemSummary.logisticsDeductionPaise)} />
            <DetailField label="Adjustment" value={formatPaise(payout.itemSummary.adjustmentAmountPaise)} />
          </div>
        </SectionShell>

        <SectionShell title="Actions">
          <div className="grid gap-3">
            <DetailField
              label="Available Actions"
              value={
                payout.availableActions.length > 0
                  ? payout.availableActions.map(humanizeCode).join(', ')
                  : null
              }
            />
            <DetailField label="Next Recommended" value={humanizeCode(payout.nextRecommendedAction)} />
          </div>
        </SectionShell>
      </section>

      <SectionShell
        description="Order earnings included in this payout batch."
        title="Payout Items"
      >
        {payout.items.length === 0 ? (
          <EmptyState
            description="No earning items are attached to this payout."
            title="No payout items"
          />
        ) : (
          <DynamicTable
            columns={itemColumns}
            data={payout.items}
            getRowId={(row) => row.payoutItemId}
            title="Payout Items"
          />
        )}
      </SectionShell>

      {metadata ? (
        <SectionShell title="Metadata">
          <pre className="max-h-80 overflow-auto rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-xs text-foreground">
            {metadata}
          </pre>
        </SectionShell>
      ) : null}

      <PayoutActionModal
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
