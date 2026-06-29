import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  HandCoins,
  ListChecks,
  PauseCircle,
  RefreshCcw,
  ReceiptText,
  ShieldCheck,
  Store,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
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

type PayoutTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const payoutSectionIds = {
  information: 'payout-information',
  items: 'payout-items',
  metadata: 'payout-metadata',
  settlement: 'payout-settlement',
  vendor: 'payout-vendor',
} as const

type PayoutSectionId = (typeof payoutSectionIds)[keyof typeof payoutSectionIds]

const payoutActionKinds: PayoutActionKind[] = [
  'APPROVE',
  'HOLD',
  'RELEASE_HOLD',
  'MARK_PAID',
  'MARK_FAILED',
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

  try {
    return formatDate(value, true)
  } catch {
    return value
  }
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

function isPayoutActionKind(action: string): action is PayoutActionKind {
  return payoutActionKinds.includes(action as PayoutActionKind)
}

function canRunPayoutAction({
  action,
  canApprovePayouts,
}: {
  action: string
  canApprovePayouts: boolean
}) {
  return isPayoutActionKind(action) && canApprovePayouts
}

function toneTextClass(tone: PayoutTone, neutralForeground = false) {
  return cn(
    tone === 'success' && 'text-success',
    tone === 'warning' && 'text-warning',
    tone === 'danger' && 'text-danger',
    tone === 'info' && 'text-primary',
    tone === 'neutral' && (neutralForeground ? 'text-foreground' : 'text-muted'),
  )
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
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: PayoutTone
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-xs font-semibold uppercase tracking-normal', toneTextClass(tone))}>
          {label}
        </p>
        <span className={toneTextClass(tone)}>{icon}</span>
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneTextClass(tone, true))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  id,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  id?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
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
    key: 'orderState',
    label: 'Order State',
    minWidth: 210,
    renderCell: (item) => (
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{humanizeCode(item.order.orderStatus)}</Badge>
        <Badge tone="info">{humanizeCode(item.order.paymentStatus)}</Badge>
      </div>
    ),
  },
  {
    key: 'amountPaise',
    label: 'Net Item',
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
    key: 'finalPricePaise',
    label: 'Order Value',
    align: 'right',
    minWidth: 140,
    renderCell: (item) => formatPaise(item.order.finalPricePaise),
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
  canReadVendors,
  isSubmitting,
  onSelect,
  onViewVendor,
  payout,
}: {
  canApprovePayouts: boolean
  canReadVendors: boolean
  isSubmitting: boolean
  onSelect: (kind: PayoutActionKind) => void
  onViewVendor: () => void
  payout: AdminPayoutDetail
}) {
  const has = (action: string) =>
    payout.availableActions.includes(action) &&
    canRunPayoutAction({ action, canApprovePayouts })

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canReadVendors ? (
        <Button size="sm" type="button" variant="secondary" onClick={onViewVendor}>
          <ArrowUpRight className="mr-2 size-4" />
          View Vendor
        </Button>
      ) : null}
      {has('APPROVE') ? (
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
      {has('HOLD') ? (
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
      {has('RELEASE_HOLD') ? (
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
      {has('MARK_PAID') ? (
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
      {has('MARK_FAILED') ? (
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
  icon: ReactNode
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
        <Button className="shrink-0" size="sm" type="button" variant="secondary" onClick={onOpen}>
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function RelatedRecordsPanel({
  canReadAudit,
  canReadVendors,
  onNavigate,
  onOpenSection,
  payout,
}: {
  canReadAudit: boolean
  canReadVendors: boolean
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: PayoutSectionId) => void
  payout: AdminPayoutDetail
}) {
  return (
    <SectionShell
      description="Primary records and child finance views attached to this payout."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          canOpen={canReadVendors}
          icon={<Store className="size-4" />}
          label="Vendor"
          meta={`${payout.vendor.publicVendorId} · ${payout.vendor.zone?.zoneName ?? payout.vendor.city}`}
          value={payout.vendor.shopName}
          onOpen={() => onNavigate(`${routePaths.vendors}/${payout.vendor.vendorId}`)}
        />
        <RelatedRecordRow
          actionLabel="Items"
          canOpen
          icon={<ReceiptText className="size-4" />}
          label="Payout items"
          meta={`${payout.itemSummary.itemCount} earning rows · ${formatPaise(
            payout.itemSummary.netPayablePaise,
          )} net`}
          value="Order earnings"
          onOpen={() => onOpenSection(payoutSectionIds.items)}
        />
        <RelatedRecordRow
          actionLabel="Vendor payouts"
          canOpen={canReadVendors}
          icon={<HandCoins className="size-4" />}
          label="Vendor payout queue"
          meta="Filtered by this vendor id"
          value={payout.vendor.publicVendorId}
          onOpen={() => onNavigate(buildVendorPayoutsPath(payout))}
        />
        <RelatedRecordRow
          actionLabel="Queue"
          canOpen
          icon={<HandCoins className="size-4" />}
          label="Payout queue"
          meta={`${humanizeCode(payout.status)} · ${humanizeCode(payout.payoutMethod)}`}
          value={payout.publicPayoutId}
          onOpen={() => onNavigate(routePaths.payouts)}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by module, entity type, and payout id"
          value={payout.payoutId}
          onOpen={() => onNavigate(buildPayoutAuditPath(payout))}
        />
      </div>
    </SectionShell>
  )
}

function buildPayoutAuditPath(payout: AdminPayoutDetail) {
  const params = new URLSearchParams({
    moduleCode: 'payouts',
    entityType: 'payout',
    entityId: payout.payoutId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function buildVendorPayoutsPath(payout: AdminPayoutDetail) {
  const params = new URLSearchParams({
    vendorId: payout.vendor.vendorId,
    vendorLabel: payout.vendor.shopName,
  })

  return `${routePaths.payouts}?${params.toString()}`
}

function SignalBadgeGroup({
  emptyLabel,
  items,
  tone,
}: {
  emptyLabel: string
  items: string[]
  tone: PayoutTone
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <Badge key={item} tone={tone}>
            {humanizeCode(item)}
          </Badge>
        ))
      ) : (
        <Badge tone="success">{emptyLabel}</Badge>
      )}
    </div>
  )
}

function OperationalSignalsPanel({
  canApprovePayouts,
  payout,
}: {
  canApprovePayouts: boolean
  payout: AdminPayoutDetail
}) {
  const permittedActions = payout.availableActions.filter((action) =>
    canRunPayoutAction({ action, canApprovePayouts }),
  )

  return (
    <SectionShell
      description="Backend finance signals and actions permitted for this admin."
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <SignalBadgeGroup
            emptyLabel="No warnings"
            items={payout.warnings}
            tone="warning"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <SignalBadgeGroup
            emptyLabel="No permitted actions"
            items={permittedActions}
            tone="neutral"
          />
        </div>
        <DetailField
          label="Recommended next"
          value={humanizeCode(payout.nextRecommendedAction)}
        />
      </div>
    </SectionShell>
  )
}

function LifecycleCheckpointsPanel({ payout }: { payout: AdminPayoutDetail }) {
  return (
    <SectionShell
      description="Concrete payout lifecycle timestamps returned by the API."
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle checkpoints"
    >
      <div className="grid gap-3">
        <DetailField label="Created" value={formatDateSafe(payout.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(payout.updatedAt)} />
        <DetailField label="Approved At" value={formatDateSafe(payout.approvedAt)} />
        <DetailField label="Paid At" value={formatDateSafe(payout.paidAt)} />
      </div>
    </SectionShell>
  )
}

export function PayoutDetailPage() {
  const { payoutId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canApprovePayouts = usePermission('payouts:approve')
  const canReadAudit = usePermission('audit:read')
  const canReadOrders = usePermission('orders:read')
  const canReadVendors = usePermission('vendors:read')
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

  const openSection = (sectionId: PayoutSectionId) => {
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
            canReadVendors={canReadVendors}
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
          icon={<CircleDollarSign className="size-4" />}
          label="Payout amount"
          meta={payout.currency}
          tone={payout.status === 'PAID' ? 'success' : 'info'}
          value={formatPaise(payout.totalAmountPaise)}
        />
        <SummaryCard
          icon={<HandCoins className="size-4" />}
          label="Net payable"
          meta={`${payout.itemSummary.itemCount} payout items`}
          tone="info"
          value={formatPaise(payout.itemSummary.netPayablePaise)}
        />
        <SummaryCard
          icon={<CreditCard className="size-4" />}
          label="Gross value"
          meta={`Commission ${formatPaise(payout.itemSummary.commissionAmountPaise)}`}
          tone="neutral"
          value={formatPaise(payout.itemSummary.grossAmountPaise)}
        />
        <SummaryCard
          icon={<TriangleAlert className="size-4" />}
          label="Warnings"
          meta={humanizeCode(payout.nextRecommendedAction)}
          tone={payout.warnings.length > 0 ? 'danger' : 'neutral'}
          value={String(payout.warnings.length)}
        />
      </section>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Finance lifecycle, settlement method, and payout identifiers."
          id={payoutSectionIds.information}
          icon={<HandCoins className="size-4" />}
          title="Payout Information"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Payout ID" value={payout.payoutId} />
            <DetailField label="Public Payout ID" value={payout.publicPayoutId} />
            <DetailField label="Status" value={humanizeCode(payout.status)} />
            <DetailField label="Method" value={humanizeCode(payout.payoutMethod)} />
            <DetailField label="Amount" value={formatPaise(payout.totalAmountPaise)} />
            <DetailField label="UTR Reference" value={payout.utrReference} />
            <DetailField label="Currency" value={payout.currency} />
          </div>
        </SectionShell>

        <div className="space-y-3">
          <RelatedRecordsPanel
            canReadAudit={canReadAudit}
            canReadVendors={canReadVendors}
            payout={payout}
            onNavigate={navigate}
            onOpenSection={openSection}
          />
          <OperationalSignalsPanel
            canApprovePayouts={canApprovePayouts}
            payout={payout}
          />
        </div>
      </section>

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionShell
          description="Current review, hold, payment, and failure state."
          id={payoutSectionIds.settlement}
          icon={<ShieldCheck className="size-4" />}
          title="Settlement"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Approved By" value={payout.approvedByAdminId} />
            <DetailField label="UTR Reference" value={payout.utrReference} />
            <DetailField label="Hold Reason" value={payout.holdReason} />
            <DetailField label="Failure Reason" value={payout.failureReason} />
            <DetailField
              label="Next Recommended"
              value={humanizeCode(payout.nextRecommendedAction)}
            />
          </div>
        </SectionShell>

        <LifecycleCheckpointsPanel payout={payout} />
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <SectionShell
          description="Vendor context used for payout access and finance review."
          id={payoutSectionIds.vendor}
          icon={<Store className="size-4" />}
          title="Vendor"
        >
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

        <SectionShell
          description="Gross, deductions, adjustments, and net payable totals."
          icon={<ListChecks className="size-4" />}
          title="Item summary"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Items" value={payout.itemSummary.itemCount} />
            <DetailField label="Gross" value={formatPaise(payout.itemSummary.grossAmountPaise)} />
            <DetailField label="Commission" value={formatPaise(payout.itemSummary.commissionAmountPaise)} />
            <DetailField label="Logistics" value={formatPaise(payout.itemSummary.logisticsDeductionPaise)} />
            <DetailField label="Adjustment" value={formatPaise(payout.itemSummary.adjustmentAmountPaise)} />
            <DetailField label="Net Payable" value={formatPaise(payout.itemSummary.netPayablePaise)} />
          </div>
        </SectionShell>
      </section>

      <SectionShell
        description="Order earnings included in this payout batch."
        id={payoutSectionIds.items}
        icon={<ReceiptText className="size-4" />}
        title="Payout Items"
      >
        {payout.items.length === 0 ? (
          <EmptyState
            description="No earning items are attached to this payout."
            title="No payout items"
          />
        ) : (
          <DynamicTable
            actionColumnLabel="Order Actions"
            actionColumnMinWidth={140}
            columns={itemColumns}
            data={payout.items}
            getRowId={(row) => row.payoutItemId}
            rowActions={(item) => [
              {
                icon: <ArrowUpRight className="size-4" />,
                isVisible: canReadOrders,
                key: 'open-order',
                label: 'Open Order',
                onClick: () => navigate(`${routePaths.orders}/${item.order.orderId}`),
                variant: 'ghost',
              },
            ]}
            title="Payout Items"
            onRowClick={
              canReadOrders
                ? (item) => navigate(`${routePaths.orders}/${item.order.orderId}`)
                : undefined
            }
          />
        )}
      </SectionShell>

      {metadata ? (
        <SectionShell
          description="Provider/task metadata returned by the payout API."
          id={payoutSectionIds.metadata}
          title="Metadata"
        >
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
