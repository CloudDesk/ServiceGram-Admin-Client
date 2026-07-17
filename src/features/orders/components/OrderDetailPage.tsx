import {
  ArrowUpRight,
  ArrowRight,
  Ban,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FileUp,
  Film,
  ImageIcon,
  KeyRound,
  MessageSquarePlus,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Route,
  ShieldCheck,
  Store,
  TriangleAlert,
  Truck,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
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
import { orderService } from '../services/order.service'
import {
  OrderActionModal,
  type OrderActionFormValues,
  type OrderActionKind,
  type OrderActionSelection,
} from './OrderActionModal'
import type {
  AdminOrderDetail,
  AdminOrderItem,
  AdminOrderLogisticsTimelineItem,
  AdminOrderMediaAsset,
  AdminOrderNote,
  AdminOrderPayment,
  AdminOrderRefund,
  AdminOrderStatus,
  AdminOrderStatusHistoryItem,
} from '../types/order.types'

const itemColumns: DynamicTableColumn<AdminOrderItem>[] = [
  {
    key: 'itemName',
    label: 'Item',
    minWidth: 220,
    renderCell: (item) => (
      <div>
        <p className="font-semibold text-foreground">{item.itemName}</p>
        <p className="mt-1 text-xs text-muted">
          {item.serviceTypeId ?? 'Custom item'}
        </p>
      </div>
    ),
  },
  {
    key: 'quantity',
    label: 'Qty',
    minWidth: 90,
    renderCell: (item) => (
      <span className="font-semibold text-foreground">{item.quantity}</span>
    ),
  },
  {
    key: 'unitPricePaise',
    label: 'Unit',
    align: 'right',
    minWidth: 140,
    renderCell: (item) =>
      item.unitPricePaise == null
        ? 'Not available'
        : formatPaise(item.unitPricePaise),
  },
  {
    key: 'totalPricePaise',
    label: 'Total',
    align: 'right',
    minWidth: 140,
    renderCell: (item) =>
      item.totalPricePaise == null
        ? 'Not available'
        : formatPaise(item.totalPricePaise),
  },
]

const statusColumns: DynamicTableColumn<AdminOrderStatusHistoryItem>[] = [
  {
    key: 'transition',
    label: 'Transition',
    minWidth: 300,
    renderCell: (event) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{formatStatusLabel(event.fromStatus)}</Badge>
          <ArrowRight className="size-3 text-muted" />
          <Badge tone={statusTone(event.toStatus)}>
            {formatStatusLabel(event.toStatus)}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-muted">
          {event.note ?? 'No transition note'}
        </p>
      </div>
    ),
  },
  {
    key: 'actor',
    label: 'Actor',
    minWidth: 190,
    renderCell: (event) => (
      <div>
        <p className="font-medium text-foreground">
          {formatStatusLabel(event.actorType)}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {event.changedByAdminId ?? event.changedByUserId ?? 'System'}
        </p>
      </div>
    ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    minWidth: 190,
    renderCell: (event) => formatDateSafe(event.createdAt),
  },
]

const logisticsColumns: DynamicTableColumn<AdminOrderLogisticsTimelineItem>[] = [
  {
    key: 'event',
    label: 'Event',
    minWidth: 260,
    renderCell: (event) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">{formatStatusLabel(event.eventType)}</Badge>
          {event.proofMediaAssetId ? (
            <Badge tone="success">Proof attached</Badge>
          ) : (
            <Badge tone="neutral">No proof</Badge>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">
          {formatDateSafe(event.eventTime)}
        </p>
      </div>
    ),
  },
  {
    key: 'condition',
    label: 'Condition / Issue',
    minWidth: 220,
    renderCell: (event) => (
      <div>
        <p className="font-medium text-foreground">
          {formatStatusLabel(event.packageCondition)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {formatStatusLabel(event.issueType)}
        </p>
      </div>
    ),
  },
  {
    key: 'notifications',
    label: 'Notifications',
    minWidth: 190,
    renderCell: (event) => (
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={event.customerNotificationSent ? 'success' : 'neutral'}>
          Customer
        </Badge>
        <Badge tone={event.vendorNotificationSent ? 'success' : 'neutral'}>
          Vendor
        </Badge>
      </div>
    ),
  },
  {
    key: 'internalNote',
    label: 'Note',
    minWidth: 260,
    renderCell: (event) => event.internalNote ?? 'No note',
  },
]

const noteColumns: DynamicTableColumn<AdminOrderNote>[] = [
  {
    key: 'note',
    label: 'Note',
    minWidth: 320,
    renderCell: (note) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {note.isPinned ? <Badge tone="warning">Pinned</Badge> : null}
          <p className="font-medium text-foreground">{note.note}</p>
        </div>
        <p className="mt-1 text-xs text-muted">
          {note.adminId ?? 'System'} · {formatDateSafe(note.createdAt)}
        </p>
      </div>
    ),
  },
]

const paymentColumns: DynamicTableColumn<AdminOrderPayment>[] = [
  {
    key: 'payment',
    label: 'Payment',
    minWidth: 240,
    renderCell: (payment) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">
            {payment.publicPaymentId}
          </p>
          <Badge tone={financePaymentTone(payment.status)}>
            {formatStatusLabel(payment.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {formatStatusLabel(payment.gateway)} · {formatStatusLabel(payment.method)}
        </p>
      </div>
    ),
  },
  {
    key: 'amountPaise',
    label: 'Amount',
    align: 'right',
    minWidth: 160,
    renderCell: (payment) => (
      <div>
        <p className="font-semibold text-foreground">
          {formatPaise(payment.amountPaise, payment.currency)}
        </p>
        <p className="mt-1 text-xs text-muted">{payment.currency}</p>
      </div>
    ),
  },
  {
    key: 'verifiedAt',
    label: 'Verified',
    minWidth: 190,
    renderCell: (payment) => formatDateSafe(payment.verifiedAt),
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    minWidth: 190,
    renderCell: (payment) => formatDateSafe(payment.updatedAt),
  },
]

const refundColumns: DynamicTableColumn<AdminOrderRefund>[] = [
  {
    key: 'refund',
    label: 'Refund',
    minWidth: 260,
    renderCell: (refund) => (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{refund.refundId}</p>
          <Badge tone={refundTone(refund.status)}>
            {formatStatusLabel(refund.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          Payment {refund.paymentId}
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
        {formatPaise(refund.amountPaise)}
      </p>
    ),
  },
  {
    key: 'reason',
    label: 'Reason',
    minWidth: 260,
    renderCell: (refund) => (
      <p className="line-clamp-2 text-sm text-foreground">{refund.reason}</p>
    ),
  },
  {
    key: 'processedAt',
    label: 'Processed',
    minWidth: 190,
    renderCell: (refund) => formatDateSafe(refund.processedAt),
  },
]

const mediaColumns: DynamicTableColumn<AdminOrderMediaAsset>[] = [
  {
    key: 'purpose',
    label: 'Purpose',
    minWidth: 210,
    renderCell: (asset) => (
      <div>
        <Badge tone="info">{formatStatusLabel(asset.purpose)}</Badge>
        <p className="mt-2 text-xs text-muted">{asset.mediaAssetId}</p>
      </div>
    ),
  },
  {
    key: 'fileName',
    label: 'File',
    minWidth: 260,
    renderCell: (asset) => (
      <div>
        <p className="font-semibold text-foreground">{asset.fileName}</p>
        <p className="mt-1 text-xs text-muted">
          {asset.mimeType} · {formatFileSize(asset.sizeBytes)}
        </p>
      </div>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    minWidth: 180,
    renderCell: (asset) => (
      <div>
        <Badge tone={asset.status === 'CONFIRMED' ? 'success' : 'warning'}>
          {formatStatusLabel(asset.status)}
        </Badge>
        <p className="mt-2 text-xs text-muted">
          {formatStatusLabel(asset.accessLevel)}
        </p>
      </div>
    ),
  },
  {
    key: 'createdAt',
    label: 'Created',
    minWidth: 190,
    renderCell: (asset) => formatDateSafe(asset.createdAt),
  },
]

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p>
    </div>
  )
}

function DetailPanel({
  children,
  description,
  id,
  icon,
  title,
}: {
  children: ReactNode
  description?: string
  id?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-[1rem] border border-border bg-surface p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function TableToolbar({
  actionNode,
  count,
  description,
  icon,
  title,
}: {
  actionNode?: ReactNode
  count: number
  description: string
  icon: ReactNode
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

type OrderTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const orderSectionIds = {
  finance: 'order-finance',
  history: 'order-history',
  items: 'order-items',
  notes: 'order-notes',
  proofMedia: 'order-proof-media',
} as const

type OrderSectionId = (typeof orderSectionIds)[keyof typeof orderSectionIds]

function toneClasses(tone: OrderTone) {
  if (tone === 'success') return 'border-border bg-surface text-success'
  if (tone === 'warning') return 'border-border bg-surface text-warning'
  if (tone === 'danger') return 'border-border bg-surface text-danger'
  if (tone === 'info') return 'border-border bg-surface text-primary'
  return 'border-border bg-surface text-muted'
}

function DetailMetricCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: OrderTone
  value: string
}) {
  return (
    <div
      className={cn(
        'min-h-[4.35rem] rounded-[0.75rem] border p-2.5',
        toneClasses(tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal opacity-80">
            {label}
          </p>
          <p className="mt-1 truncate text-lg font-semibold tracking-normal">
            {value}
          </p>
        </div>
        <span className="mt-0.5 shrink-0 opacity-80">{icon}</span>
      </div>
      <p className="mt-0.5 truncate text-xs leading-4 opacity-80">{meta}</p>
    </div>
  )
}

function orderDisplayValue(order: AdminOrderDetail) {
  const pendingRevision = order.pricing.pendingPriceRevision

  if (pendingRevision) {
    return formatMoney(pendingRevision.revisedPricePaise / 100)
  }

  const amountPaise =
    order.pricing.finalPricePaise ??
    order.pricing.payableAmountPaise ??
    order.pricing.priceEstimatePaise

  return formatMoney(amountPaise / 100)
}

function formatPaise(value: number | null | undefined, currency = 'INR') {
  if (value == null) return 'Not available'
  return formatMoney(value / 100, currency)
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'
  return formatDate(value, true)
}

function formatFileSize(value: number | null | undefined) {
  if (value == null) return 'Size unknown'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const logisticsStatusOrder: AdminOrderStatus[] = [
  'VENDOR_ACCEPTED',
  'PICKUP_SCHEDULED',
  'PICKED_UP_FROM_CUSTOMER',
  'HANDED_OVER_TO_VENDOR',
  'ITEM_RECEIVED_BY_VENDOR',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'COLLECTED_FROM_VENDOR',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

const manualStatusCopy: Partial<Record<AdminOrderStatus, { label: string; description: string }>> = {
  PICKUP_SCHEDULED: {
    label: 'Schedule pickup',
    description: 'Pickup is planned and ready for field pickup.',
  },
  PICKED_UP_FROM_CUSTOMER: {
    label: 'Mark picked up',
    description: 'Package was collected from the customer.',
  },
  HANDED_OVER_TO_VENDOR: {
    label: 'Hand over to vendor',
    description: 'Package was handed over to the service vendor.',
  },
  COLLECTED_FROM_VENDOR: {
    label: 'Collect from vendor',
    description: 'Completed package was collected from the vendor.',
  },
  OUT_FOR_DELIVERY: {
    label: 'Send out for delivery',
    description: 'Package is on the way back to the customer.',
  },
  DELIVERED: {
    label: 'Mark delivered',
    description: 'Customer received the completed order.',
  },
  DELIVERY_FAILED: {
    label: 'Mark delivery failed',
    description: 'Delivery attempt failed and needs follow-up.',
  },
  CUSTOMER_UNAVAILABLE: {
    label: 'Customer unavailable',
    description: 'Customer could not receive the delivery.',
  },
  CANCELLED: {
    label: 'Cancel order',
    description: 'Stop the order from further processing.',
  },
}

function formatStatusLabel(status?: string | null) {
  if (!status) {
    return 'Not available'
  }

  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function statusTone(status: string) {
  if (status === 'DELIVERED' || status === 'SERVICE_COMPLETED') {
    return 'success' as const
  }
  if (['CANCELLED', 'DELIVERY_FAILED', 'CUSTOMER_UNAVAILABLE', 'ITEM_DAMAGED', 'ITEM_LOST', 'WRONG_ITEM'].includes(status)) {
    return 'danger' as const
  }
  if (['OUT_FOR_DELIVERY', 'PICKED_UP_FROM_CUSTOMER', 'COLLECTED_FROM_VENDOR'].includes(status)) {
    return 'warning' as const
  }
  if (['PRICE_REVISION_PENDING_CUSTOMER', 'VENDOR_ACCEPTANCE_PENDING'].includes(status)) {
    return 'warning' as const
  }
  return 'info' as const
}

function paymentTone(status: string) {
  if (status === 'PAID' || status === 'REFUNDED') return 'success' as const
  if (status === 'FAILED') return 'danger' as const
  if (status === 'PARTIALLY_REFUNDED') return 'info' as const
  return 'warning' as const
}

function financePaymentTone(status: string) {
  if (['SUCCESS', 'PAID', 'REFUNDED'].includes(status)) return 'success' as const
  if (['FAILED', 'CANCELLED'].includes(status)) return 'danger' as const
  if (['PARTIALLY_REFUNDED', 'AUTHORIZED'].includes(status)) return 'info' as const
  return 'warning' as const
}

function refundTone(status: string) {
  if (status === 'SUCCESS') return 'success' as const
  if (['FAILED', 'REJECTED'].includes(status)) return 'danger' as const
  if (['APPROVED', 'PROCESSING'].includes(status)) return 'info' as const
  return 'warning' as const
}

function actionTargetStatus(action: string) {
  return action.replace(/^MARK_/, '') as AdminOrderStatus
}

function hasOrderAction(order: AdminOrderDetail, action: string) {
  return order.availableActions.includes(action)
}

function hasActiveDeliveryOtp(order: AdminOrderDetail) {
  const expiresAt = Date.parse(order.activeDeliveryOtp?.expiresAt ?? '')

  return Boolean(
    order.activeDeliveryOtp && Number.isFinite(expiresAt) && expiresAt > Date.now(),
  )
}

function canGenerateDeliveryOtp(order: AdminOrderDetail) {
  return hasOrderAction(order, 'GENERATE_DELIVERY_OTP') && !hasActiveDeliveryOtp(order)
}

function canConfirmDeliveryOtp(order: AdminOrderDetail) {
  return order.orderStatus === 'OUT_FOR_DELIVERY' && hasActiveDeliveryOtp(order)
}

function buildOrderAuditPath(order: AdminOrderDetail) {
  const params = new URLSearchParams({
    moduleCode: 'orders',
    entityType: 'order',
    entityId: order.orderId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function canRunOrderAction(
  kind: OrderActionKind,
  canUpdateOrders: boolean,
  canRefundPayments: boolean,
) {
  if (kind === 'INITIATE_REFUND') return canRefundPayments
  return canUpdateOrders
}

function OrderHeaderStatus({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={statusTone(order.orderStatus)}>
        {formatStatusLabel(order.orderStatus)}
      </Badge>
      <Badge tone={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'FAILED' ? 'danger' : 'warning'}>
        {formatStatusLabel(order.paymentStatus)}
      </Badge>
    </div>
  )
}

function PriceRevisionNotice({ order }: { order: AdminOrderDetail }) {
  const revision = order.pricing.pendingPriceRevision

  if (!revision) {
    return null
  }

  return (
    <section className="rounded-[1rem] border border-warning/35 bg-warning/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Customer price approval pending</h2>
            <p className="max-w-3xl text-sm text-muted">
              Vendor revised the quote before accepting the order. The customer must approve, ask for clarification, find another vendor, or cancel from the customer app.
            </p>
          </div>
        </div>
        <Badge tone="warning">{formatStatusLabel(order.orderStatus)}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <DetailField label="Original Estimate" value={formatMoney(revision.previousPricePaise / 100)} />
        <DetailField label="Revised Quote" value={formatMoney(revision.revisedPricePaise / 100)} />
        <DetailField label="Difference" value={formatMoney(revision.differencePaise / 100)} />
        <DetailField label="Requested At" value={formatDate(revision.requestedAt, true)} />
      </div>

      <div className="mt-4">
        <DetailField label="Vendor Reason" value={revision.reason} />
      </div>
    </section>
  )
}

function OrderHeaderActions({
  canRefundPayments,
  canUpdateOrders,
  isSubmitting,
  onSelectAction,
  order,
}: {
  canRefundPayments: boolean
  canUpdateOrders: boolean
  isSubmitting: boolean
  onSelectAction: (kind: OrderActionKind, targetStatus?: AdminOrderStatus) => void
  order: AdminOrderDetail
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {canRefundPayments && hasOrderAction(order, 'INITIATE_REFUND') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('INITIATE_REFUND')}>
          <RotateCcw className="mr-2 size-4" />
          Refund
        </Button>
      ) : null}
      {canUpdateOrders && hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('CREATE_PROOF_UPLOAD_INTENT')}>
          <FileUp className="mr-2 size-4" />
          Proof Upload
        </Button>
      ) : null}
      {canUpdateOrders && hasOrderAction(order, 'CANCEL') ? (
        <Button disabled={isSubmitting} size="sm" variant="danger" onClick={() => onSelectAction('CANCEL')}>
          <Ban className="mr-2 size-4" />
          Cancel
        </Button>
      ) : null}
      {canUpdateOrders && hasOrderAction(order, 'ADD_NOTE') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('ADD_NOTE')}>
          <MessageSquarePlus className="mr-2 size-4" />
          Add Note
        </Button>
      ) : null}
    </div>
  )
}

function ManualLogisticsPanel({
  canUpdateOrders,
  isSubmitting,
  onSelectAction,
  order,
}: {
  canUpdateOrders: boolean
  isSubmitting: boolean
  onSelectAction: (kind: OrderActionKind, targetStatus?: AdminOrderStatus) => void
  order: AdminOrderDetail
}) {
  const markActions = order.availableActions.filter((action) => action.startsWith('MARK_'))
  const currentStepIndex = logisticsStatusOrder.indexOf(order.orderStatus)
  const primaryAction =
    order.nextRecommendedAction?.startsWith('MARK_') && markActions.includes(order.nextRecommendedAction)
      ? order.nextRecommendedAction
      : markActions[0]
  const secondaryActions = markActions.filter((action) => action !== primaryAction)
  const primaryTarget = primaryAction ? actionTargetStatus(primaryAction) : null

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.85fr)]">
      <div className="rounded-[1rem] border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Route className="size-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Manual Logistics</h2>
            </div>
            <p className="max-w-2xl text-sm text-muted">
              Admin-controlled pickup and delivery movement until the delivery partner app is ready.
            </p>
          </div>
          <Badge tone={statusTone(order.orderStatus)}>{formatStatusLabel(order.orderStatus)}</Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 p-3">
            <p className="text-xs font-semibold uppercase text-muted">Current status</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatStatusLabel(order.orderStatus)}</p>
          </div>
          <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 p-3">
            <p className="text-xs font-semibold uppercase text-muted">Next step</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {primaryTarget ? manualStatusCopy[primaryTarget]?.label ?? formatStatusLabel(primaryTarget) : 'No manual step'}
            </p>
          </div>
          <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 p-3">
            <p className="text-xs font-semibold uppercase text-muted">Event count</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{order.counts?.logisticsEventCount ?? order.logisticsTimeline.length}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {logisticsStatusOrder.map((status, index) => {
            const isCurrent = order.orderStatus === status
            const isDone = currentStepIndex >= 0 && index < currentStepIndex
            const tone = isCurrent ? statusTone(status) : isDone ? 'success' : 'neutral'

            return (
              <div className="flex items-center gap-2" key={status}>
                <Badge tone={tone}>{formatStatusLabel(status)}</Badge>
                {index < logisticsStatusOrder.length - 1 ? <ArrowRight className="size-3 text-muted" /> : null}
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {primaryTarget && canUpdateOrders ? (
            <Button disabled={isSubmitting} size="sm" onClick={() => onSelectAction('UPDATE_STATUS', primaryTarget)}>
              <Truck className="mr-2 size-4" />
              {manualStatusCopy[primaryTarget]?.label ?? formatStatusLabel(primaryTarget)}
            </Button>
          ) : !canUpdateOrders ? (
            <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 px-3 py-2 text-sm text-muted">
              Your role can view logistics, but cannot update order status.
            </div>
          ) : (
            <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 px-3 py-2 text-sm text-muted">
              No valid manual transition is available for this status.
            </div>
          )}

          {canUpdateOrders ? secondaryActions.map((action) => {
            const targetStatus = actionTargetStatus(action)
            return (
              <Button disabled={isSubmitting} key={action} size="sm" variant="secondary" onClick={() => onSelectAction('UPDATE_STATUS', targetStatus)}>
                {manualStatusCopy[targetStatus]?.label ?? formatStatusLabel(targetStatus)}
              </Button>
            )
          }) : null}
        </div>

        {primaryTarget ? (
          <p className="mt-3 text-sm text-muted">
            {manualStatusCopy[primaryTarget]?.description ?? 'This update will write order history and a logistics timeline event.'}
          </p>
        ) : null}
      </div>

      <div className="rounded-[1rem] border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Delivery OTP</h2>
            </div>
            <p className="text-sm text-muted">Customer handover verification for final delivery.</p>
          </div>
          {order.activeDeliveryOtp ? <Badge tone="warning">{order.activeDeliveryOtp.status}</Badge> : <Badge tone="neutral">No active OTP</Badge>}
        </div>

        {order.activeDeliveryOtp ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 p-3">
              <p className="text-xs font-semibold uppercase text-muted">Expires</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatDate(order.activeDeliveryOtp.expiresAt, true)}</p>
            </div>
            <div className="rounded-[0.85rem] border border-border bg-surface-muted/50 p-3">
              <p className="text-xs font-semibold uppercase text-muted">Attempts</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {order.activeDeliveryOtp.attempts}/{order.activeDeliveryOtp.maxAttempts}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[0.85rem] border border-border bg-surface-muted/50 p-3 text-sm text-muted">
            OTP controls become available when the order is out for delivery.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canUpdateOrders && canGenerateDeliveryOtp(order) ? (
            <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('GENERATE_DELIVERY_OTP')}>
              <ShieldCheck className="mr-2 size-4" />
              Generate OTP
            </Button>
          ) : null}
          {canUpdateOrders && canConfirmDeliveryOtp(order) ? (
            <Button disabled={isSubmitting} size="sm" onClick={() => onSelectAction('CONFIRM_DELIVERY_OTP')}>
              <CircleCheck className="mr-2 size-4" />
              Confirm OTP
            </Button>
          ) : null}
          {canUpdateOrders && hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT') ? (
            <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('CREATE_PROOF_UPLOAD_INTENT')}>
              <PackageCheck className="mr-2 size-4" />
              Proof Upload
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-[0.85rem] border border-border bg-surface-muted/50 p-3 text-sm text-muted">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <p>Every manual update writes order history, logistics timeline, and admin audit records.</p>
        </div>
      </div>
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

function RelatedRecordsPanel({
  canReadAudit,
  canReadCustomers,
  canReadPayments,
  canReadReels,
  canReadVendors,
  onNavigate,
  onOpenSection,
  order,
}: {
  canReadAudit: boolean
  canReadCustomers: boolean
  canReadPayments: boolean
  canReadReels: boolean
  canReadVendors: boolean
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: OrderSectionId) => void
  order: AdminOrderDetail
}) {
  const historyCount = order.statusHistory.length + order.logisticsTimeline.length

  return (
    <DetailPanel
      description="Primary records and child sections linked to this order."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          canOpen={canReadCustomers}
          icon={<UserRound className="size-4" />}
          label="Customer"
          meta={order.customer.mobileNumber ?? order.customer.email ?? order.customer.status}
          value={order.customer.fullName}
          onOpen={() => onNavigate(`${routePaths.customers}/${order.customer.customerId}`)}
        />
        <RelatedRecordRow
          canOpen={canReadVendors}
          icon={<Store className="size-4" />}
          label="Vendor"
          meta={`${order.vendor.publicVendorId} · ${order.vendor.zone?.zoneName ?? order.vendor.city}`}
          value={order.vendor.shopName}
          onOpen={() => onNavigate(`${routePaths.vendors}/${order.vendor.vendorId}`)}
        />
        {order.sourceReelId ? (
          <RelatedRecordRow
            canOpen={canReadReels}
            icon={<Film className="size-4" />}
            label="Source reel"
            meta="Attributed booking source"
            value={order.sourceReelId}
            onOpen={() => onNavigate(`${routePaths.reels}/${order.sourceReelId}`)}
          />
        ) : null}
        <RelatedRecordRow
          actionLabel="Review"
          canOpen
          icon={<CreditCard className="size-4" />}
          label="Finance"
          meta={
            canReadPayments
              ? 'Payment and refund detail links enabled'
              : 'Payments permission required'
          }
          value={formatStatusLabel(order.paymentStatus)}
          onOpen={() => onOpenSection(orderSectionIds.finance)}
        />
        <RelatedRecordRow
          actionLabel="Timeline"
          canOpen
          icon={<Truck className="size-4" />}
          label="Status & logistics"
          meta={`${order.statusHistory.length} status events · ${order.logisticsTimeline.length} logistics events`}
          value={`${historyCount} total events`}
          onOpen={() => onOpenSection(orderSectionIds.history)}
        />
        <RelatedRecordRow
          actionLabel="Proofs"
          canOpen
          icon={<ImageIcon className="size-4" />}
          label="Proof media"
          meta="Upload intents and delivery proof assets"
          value={`${order.mediaAssets.length} media assets`}
          onOpen={() => onOpenSection(orderSectionIds.proofMedia)}
        />
        <RelatedRecordRow
          actionLabel="Items"
          canOpen
          icon={<PackageCheck className="size-4" />}
          label="Line items"
          meta="Booked services and item-level pricing"
          value={`${order.items.length} items`}
          onOpen={() => onOpenSection(orderSectionIds.items)}
        />
        <RelatedRecordRow
          actionLabel="Notes"
          canOpen
          icon={<MessageSquarePlus className="size-4" />}
          label="Admin notes"
          meta="Pinned and regular internal notes"
          value={`${order.counts?.noteCount ?? order.notes.length} notes`}
          onOpen={() => onOpenSection(orderSectionIds.notes)}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by module, entity type, and order id"
          value={order.orderId}
          onOpen={() => onNavigate(buildOrderAuditPath(order))}
        />
      </div>
    </DetailPanel>
  )
}

function FinanceLockedPanel({ order }: { order: AdminOrderDetail }) {
  return (
    <DetailPanel
      description="Payment attempts and refund rows require finance access."
      icon={<CreditCard className="size-4" />}
      id={orderSectionIds.finance}
      title="Finance"
    >
      <div className="grid gap-2.5 md:grid-cols-2">
        <DetailMetricCard
          icon={<CreditCard className="size-4" />}
          label="Payments"
          meta="Payments permission required"
          tone="neutral"
          value="Locked"
        />
        <DetailMetricCard
          icon={<RotateCcw className="size-4" />}
          label="Refunds"
          meta="Payments permission required"
          tone="neutral"
          value="Locked"
        />
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-[0.85rem] border border-border bg-surface-muted/50 p-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Payments permission required
          </p>
          <p className="mt-1 text-sm leading-5 text-muted">
            This order remains available for operations work. Payment attempts
            and refund records are hidden until payments:read is assigned.
          </p>
          <p className="mt-2 text-xs font-semibold uppercase text-muted">
            Current payment status
          </p>
          <Badge tone={paymentTone(order.paymentStatus)}>
            {formatStatusLabel(order.paymentStatus)}
          </Badge>
        </div>
      </div>
    </DetailPanel>
  )
}

function OperationalSignalsPanel({ order }: { order: AdminOrderDetail }) {
  return (
    <DetailPanel
      description="Backend workflow signals that should drive admin attention."
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {order.warnings.length ? (
              order.warnings.map((warning) => (
                <Badge key={warning} tone="warning">
                  {formatStatusLabel(warning)}
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
            {order.availableActions.length ? (
              order.availableActions.map((action) => (
                <Badge key={action} tone="neutral">
                  {formatStatusLabel(action)}
                </Badge>
              ))
            ) : (
              <Badge tone="neutral">No actions</Badge>
            )}
          </div>
        </div>

        <DetailField
          label="Recommended next"
          value={formatStatusLabel(order.nextRecommendedAction)}
        />
      </div>
    </DetailPanel>
  )
}

interface OrderDetailPageProps {
  listHref?: string
  listLabel?: string
}

export function OrderDetailPage({
  listHref = routePaths.orders,
  listLabel = 'Orders',
}: OrderDetailPageProps = {}) {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canReadCustomers = usePermission('customers:read')
  const canReadVendors = usePermission('vendors:read')
  const canReadPayments = usePermission('payments:read')
  const canReadReels = usePermission('reels:read')
  const canReadAudit = usePermission('audit:read')
  const canUpdateOrders = usePermission('orders:update_status')
  const canRefundPayments = usePermission('payments:refund')
  const [actionError, setActionError] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<OrderActionSelection | null>(null)

  const orderQuery = useQuery({
    enabled: Boolean(orderId),
    queryKey: ['order-detail', orderId],
    queryFn: () => orderService.getOrderById(orderId as string),
  })

  const order = orderQuery.data?.data

  const refreshOrder = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
      queryClient.invalidateQueries({ queryKey: ['manual-logistics'] }),
      queryClient.invalidateQueries({ queryKey: ['manual-logistics-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['payments'] }),
      queryClient.invalidateQueries({ queryKey: ['refunds'] }),
    ])
  }

  const actionMutation = useMutation({
    mutationFn: async ({ action, values }: { action: OrderActionSelection; values: OrderActionFormValues }) => {
      if (!order) {
        throw new Error('Order details are unavailable.')
      }

      if (action.kind === 'UPDATE_STATUS') {
        if (!action.targetStatus) {
          throw new Error('Target status is required.')
        }

        return orderService.updateOrderStatus(order.orderId, {
          targetStatus: action.targetStatus,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
          issueType: values.issueType,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        })
      }

      if (action.kind === 'CANCEL') {
        if (!values.reason) {
          throw new Error('Cancellation reason is required.')
        }

        return orderService.cancelOrder(order.orderId, {
          reason: values.reason,
          notifyCustomer: values.notifyCustomer,
          notifyVendor: values.notifyVendor,
        })
      }

      if (action.kind === 'INITIATE_REFUND') {
        if (!values.reason) {
          throw new Error('Refund reason is required.')
        }

        return orderService.initiateOrderRefund(order.orderId, {
          paymentId: values.paymentId,
          amountPaise: values.amountPaise,
          reason: values.reason,
        })
      }

      if (action.kind === 'GENERATE_DELIVERY_OTP') {
        return orderService.generateDeliveryOtp(order.orderId, {
          expiresInMinutes: values.expiresInMinutes,
          notifyCustomer: values.notifyCustomer,
          reason: values.reason,
        })
      }

      if (action.kind === 'CONFIRM_DELIVERY_OTP') {
        if (!values.otpCode) {
          throw new Error('Delivery OTP is required.')
        }

        return orderService.confirmDeliveryOtp(order.orderId, {
          otpCode: values.otpCode,
          eventTime: values.eventTime,
          internalNote: values.internalNote,
          proofMediaAssetId: values.proofMediaAssetId,
          packageCondition: values.packageCondition,
        })
      }

      if (action.kind === 'ADD_NOTE') {
        if (!values.note) {
          throw new Error('Note is required.')
        }

        return orderService.addOrderNote(order.orderId, {
          note: values.note,
          isPinned: values.isPinned,
        })
      }

      if (!values.purpose || !values.fileName || !values.mimeType || !values.sizeBytes) {
        throw new Error('Proof upload file details are required.')
      }

      return orderService.createProofUploadIntent(order.orderId, {
        purpose: values.purpose,
        fileName: values.fileName,
        mimeType: values.mimeType,
        sizeBytes: values.sizeBytes,
      })
    },
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      setSelectedAction(null)
      await refreshOrder()
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Order action failed.')
    },
  })

  const openAction = (kind: OrderActionKind, targetStatus?: AdminOrderStatus) => {
    if (!canRunOrderAction(kind, canUpdateOrders, canRefundPayments)) {
      return
    }

    setActionError(null)
    setSelectedAction({ kind, targetStatus })
  }

  const openSection = (sectionId: OrderSectionId) => {
    const section = document.getElementById(sectionId)

    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (section) {
      window.history.replaceState(null, '', `#${sectionId}`)
    }
  }

  if (!orderId) {
    return <PageContainer><ErrorState title="Order not found" description="The order route is missing an order id." /></PageContainer>
  }

  if (orderQuery.isLoading) {
    return <PageContainer><DetailPageHeaderSkeleton /><Skeleton className="h-[28rem] w-full" /></PageContainer>
  }

  if (orderQuery.isError) {
    return <PageContainer><ErrorState title="Order unavailable" description="We could not load this order. Please retry." onRetry={() => void orderQuery.refetch()} /></PageContainer>
  }

  if (!order) {
    return <PageContainer><EmptyState title="Order not found" description="The order detail API returned no order data." /></PageContainer>
  }

  return (
    <PageContainer className="!px-3 !py-4 space-y-3 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <OrderHeaderActions
            canRefundPayments={canRefundPayments}
            canUpdateOrders={canUpdateOrders}
            isSubmitting={actionMutation.isPending}
            order={order}
            onSelectAction={openAction}
          />
        }
        description={`${order.customer.fullName} · ${order.vendor.shopName}`}
        listHref={listHref}
        listLabel={listLabel}
        recordName={order.publicOrderId}
        titleMetaNode={<OrderHeaderStatus order={order} />}
      />

      <PriceRevisionNotice order={order} />

      <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <DetailMetricCard
          icon={<Route className="size-4" />}
          label="Order status"
          meta={order.nextRecommendedAction ? `Next: ${formatStatusLabel(order.nextRecommendedAction)}` : 'No immediate action'}
          tone={statusTone(order.orderStatus)}
          value={formatStatusLabel(order.orderStatus)}
        />
        <DetailMetricCard
          icon={<CreditCard className="size-4" />}
          label="Payment"
          meta={order.paymentMethod}
          tone={paymentTone(order.paymentStatus)}
          value={formatStatusLabel(order.paymentStatus)}
        />
        <DetailMetricCard
          icon={<PackageCheck className="size-4" />}
          label="Value"
          meta={order.pricing.pendingPriceRevision ? 'Price revision pending' : 'Current payable value'}
          tone={order.pricing.pendingPriceRevision ? 'warning' : 'info'}
          value={orderDisplayValue(order)}
        />
        <DetailMetricCard
          icon={<CalendarClock className="size-4" />}
          label="Timeline"
          meta={`${order.counts?.noteCount ?? order.notes.length} notes / ${order.counts?.refundCount ?? order.refunds.length} refunds`}
          tone={(order.counts?.logisticsEventCount ?? order.logisticsTimeline.length) ? 'info' : 'neutral'}
          value={String(order.counts?.logisticsEventCount ?? order.logisticsTimeline.length)}
        />
      </section>

      <ManualLogisticsPanel
        canUpdateOrders={canUpdateOrders}
        isSubmitting={actionMutation.isPending}
        order={order}
        onSelectAction={openAction}
      />

      <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <DetailPanel
            description="Core booking, schedule, customer, vendor, and pricing fields."
            id="order-information"
            icon={<ReceiptText className="size-4" />}
            title="Order information"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailField label="Order ID" value={order.orderId} />
              <DetailField label="Public Order ID" value={order.publicOrderId} />
              <DetailField label="Customer" value={order.customer.fullName} />
              <DetailField label="Customer Mobile" value={order.customer.mobileNumber} />
              <DetailField label="Vendor" value={order.vendor.shopName} />
              <DetailField label="Category" value={order.category?.name} />
              <DetailField label="Payment Method" value={order.paymentMethod} />
              <DetailField label="Value" value={orderDisplayValue(order)} />
              <DetailField label="Pickup Date" value={formatDateSafe(order.schedule.pickupDate)} />
              <DetailField label="Expected Delivery" value={formatDateSafe(order.schedule.expectedDeliveryAt)} />
              <DetailField label="Delivered At" value={formatDateSafe(order.schedule.deliveredAt)} />
              <DetailField label="Cancellation Reason" value={order.cancellationReason} />
              <DetailField label="Active Delivery OTP" value={order.activeDeliveryOtp?.status} />
              <DetailField label="Created At" value={formatDateSafe(order.createdAt)} />
              <DetailField label="Updated At" value={formatDateSafe(order.updatedAt)} />
            </div>
          </DetailPanel>

          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
            <DetailMetricCard
              icon={<PackageCheck className="size-4" />}
              label="Items"
              meta="Service line items"
              tone={order.items.length ? 'info' : 'neutral'}
              value={String(order.counts?.itemCount ?? order.items.length)}
            />
            <DetailMetricCard
              icon={<CreditCard className="size-4" />}
              label="Payments"
              meta={
                canReadPayments
                  ? `${order.refunds.length} linked refunds`
                  : 'Payments permission required'
              }
              tone={canReadPayments && order.payments.length ? 'success' : 'neutral'}
              value={canReadPayments ? String(order.payments.length) : 'Locked'}
            />
            <DetailMetricCard
              icon={<ImageIcon className="size-4" />}
              label="Proofs"
              meta="Order media assets"
              tone={order.mediaAssets.length ? 'info' : 'neutral'}
              value={String(order.mediaAssets.length)}
            />
            <DetailMetricCard
              icon={<FileText className="size-4" />}
              label="Notes"
              meta="Internal admin notes"
              tone={order.notes.length ? 'warning' : 'neutral'}
              value={String(order.counts?.noteCount ?? order.notes.length)}
            />
          </div>

        {canReadPayments ? (
          <div id={orderSectionIds.finance} className="grid scroll-mt-4 gap-3 2xl:grid-cols-2">
            <DynamicTable
              actionColumnLabel="Payment Actions"
              actionColumnMinWidth={180}
              bodyMaxHeight={320}
              columns={paymentColumns}
              data={order.payments}
              emptyDescription="This order does not have payment records yet."
              emptyTitle="No payments"
              getRowId={(row) => row.paymentId}
              stickyHeader
              title="Payments"
              toolbar={
                <TableToolbar
                  count={order.payments.length}
                  description="Payment attempts and verification state linked to this order."
                  icon={<CreditCard className="size-4" />}
                  title="Payments"
                />
              }
              rowActions={(payment) => [
                {
                  icon: <ArrowUpRight className="size-4" />,
                  key: 'open-payment',
                  label: 'Open',
                  onClick: () => navigate(`${routePaths.payments}/${payment.paymentId}`),
                  variant: 'ghost',
                },
              ]}
              onRowClick={(payment) => navigate(`${routePaths.payments}/${payment.paymentId}`)}
            />

            <DynamicTable
              actionColumnLabel="Refund Actions"
              actionColumnMinWidth={180}
              bodyMaxHeight={320}
              columns={refundColumns}
              data={order.refunds}
              emptyDescription="This order does not have refund records yet."
              emptyTitle="No refunds"
              getRowId={(row) => row.refundId}
              stickyHeader
              title="Refunds"
              toolbar={
                <TableToolbar
                  actionNode={
                    canRefundPayments && hasOrderAction(order, 'INITIATE_REFUND') ? (
                      <Button
                        disabled={actionMutation.isPending}
                        size="sm"
                        variant="secondary"
                        onClick={() => openAction('INITIATE_REFUND')}
                      >
                        <RotateCcw className="mr-2 size-4" />
                        Refund
                      </Button>
                    ) : null
                  }
                  count={order.refunds.length}
                  description="Refund requests created for this order payment."
                  icon={<RotateCcw className="size-4" />}
                  title="Refunds"
                />
              }
              rowActions={(refund) => [
                {
                  icon: <ArrowUpRight className="size-4" />,
                  key: 'open-refund',
                  label: 'Open',
                  onClick: () => navigate(`${routePaths.refunds}/${refund.refundId}`),
                  variant: 'ghost',
                },
              ]}
              onRowClick={(refund) => navigate(`${routePaths.refunds}/${refund.refundId}`)}
            />
          </div>
        ) : (
          <FinanceLockedPanel order={order} />
        )}

        <div id={orderSectionIds.history} className="grid scroll-mt-4 gap-3 2xl:grid-cols-2">
          <DynamicTable
            bodyMaxHeight={340}
            columns={statusColumns}
            data={order.statusHistory}
            emptyDescription="No status transitions were returned for this order."
            emptyTitle="No status history"
            getRowId={(row) => row.statusHistoryId}
            stickyHeader
            title="Status history"
            toolbar={
              <TableToolbar
                count={order.statusHistory.length}
                description="Lifecycle status transitions with actors and notes."
                icon={<Route className="size-4" />}
                title="Status history"
              />
            }
          />

          <DynamicTable
            bodyMaxHeight={340}
            columns={logisticsColumns}
            data={order.logisticsTimeline}
            emptyDescription="No manual logistics events were returned for this order."
            emptyTitle="No logistics timeline"
            getRowId={(row) => row.logisticsEventId}
            stickyHeader
            title="Logistics timeline"
            toolbar={
              <TableToolbar
                count={order.logisticsTimeline.length}
                description="Pickup, handover, delivery, proof, and notification events."
                icon={<Truck className="size-4" />}
                title="Logistics timeline"
              />
            }
          />
        </div>

        <div id={orderSectionIds.proofMedia} className="scroll-mt-4">
          <DynamicTable
            actionColumnLabel="Proof Actions"
            actionColumnMinWidth={210}
            bodyMaxHeight={300}
            columns={mediaColumns}
            data={order.mediaAssets}
            emptyDescription="No proof media assets were returned for this order."
            emptyTitle="No media assets"
            getRowId={(row) => row.orderMediaAssetId}
            stickyHeader
            title="Media assets"
            toolbar={
              <TableToolbar
                actionNode={
                  canUpdateOrders && hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT') ? (
                    <Button
                      disabled={actionMutation.isPending}
                      size="sm"
                      variant="secondary"
                      onClick={() => openAction('CREATE_PROOF_UPLOAD_INTENT')}
                    >
                      <FileUp className="mr-2 size-4" />
                      Proof Upload
                    </Button>
                  ) : null
                }
                count={order.mediaAssets.length}
                description="Order proof files and upload intents linked to manual logistics."
                icon={<ImageIcon className="size-4" />}
                title="Media assets"
              />
            }
          />
        </div>

        <div className="grid gap-3 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div id={orderSectionIds.items} className="scroll-mt-4">
            <DynamicTable
              bodyMaxHeight={300}
              columns={itemColumns}
              data={order.items}
              emptyDescription="This order does not have item rows yet."
              emptyTitle="No items"
              getRowId={(row) => row.orderItemId}
              stickyHeader
              title="Items"
              toolbar={
                <TableToolbar
                  count={order.items.length}
                  description="Booked services and item-level pricing."
                  icon={<PackageCheck className="size-4" />}
                  title="Items"
                />
              }
            />
          </div>

          <div id={orderSectionIds.notes} className="scroll-mt-4">
            <DynamicTable
              actionColumnLabel="Note Actions"
              actionColumnMinWidth={190}
              bodyMaxHeight={300}
              columns={noteColumns}
              data={order.notes}
              emptyDescription="No internal notes were returned for this order."
              emptyTitle="No notes"
              getRowId={(row) => row.orderNoteId}
              stickyHeader
              title="Internal notes"
              toolbar={
                <TableToolbar
                  actionNode={
                    canUpdateOrders && hasOrderAction(order, 'ADD_NOTE') ? (
                      <Button
                        disabled={actionMutation.isPending}
                        size="sm"
                        variant="secondary"
                        onClick={() => openAction('ADD_NOTE')}
                      >
                        <MessageSquarePlus className="mr-2 size-4" />
                        Add Note
                      </Button>
                    ) : null
                  }
                  count={order.notes.length}
                  description="Pinned and regular admin notes for this order."
                  icon={<MessageSquarePlus className="size-4" />}
                  title="Internal notes"
                />
              }
            />
          </div>
        </div>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-[5.5rem]">
          <RelatedRecordsPanel
            canReadAudit={canReadAudit}
            canReadCustomers={canReadCustomers}
            canReadPayments={canReadPayments}
            canReadReels={canReadReels}
            canReadVendors={canReadVendors}
            order={order}
            onNavigate={navigate}
            onOpenSection={openSection}
          />
          <OperationalSignalsPanel order={order} />
        </aside>
      </section>

      <OrderActionModal
        action={selectedAction}
        error={actionError}
        isSubmitting={actionMutation.isPending}
        key={selectedAction ? `${selectedAction.kind}-${selectedAction.targetStatus ?? 'order'}` : 'closed'}
        order={order}
        onClose={() => {
          if (!actionMutation.isPending) {
            setSelectedAction(null)
            setActionError(null)
          }
        }}
        onSubmit={(values) => {
          if (selectedAction) {
            void actionMutation.mutateAsync({ action: selectedAction, values })
          }
        }}
      />
    </PageContainer>
  )
}
