import {
  ArrowRight,
  Ban,
  CalendarClock,
  CircleCheck,
  FileUp,
  KeyRound,
  MessageSquarePlus,
  PackageCheck,
  RotateCcw,
  Route,
  ShieldCheck,
  TriangleAlert,
  Truck,
} from 'lucide-react'
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
  { key: 'itemName', label: 'Item', minWidth: 180 },
  { key: 'quantity', label: 'Qty', minWidth: 80 },
  {
    key: 'totalPricePaise',
    label: 'Total',
    align: 'right',
    renderCell: (item) => item.totalPricePaise == null ? 'Not available' : formatMoney(item.totalPricePaise / 100),
  },
]

const statusColumns: DynamicTableColumn<AdminOrderStatusHistoryItem>[] = [
  { key: 'fromStatus', label: 'From', minWidth: 170 },
  { key: 'toStatus', label: 'To', minWidth: 170, format: 'status', statusTone: 'info' },
  { key: 'actorType', label: 'Actor', minWidth: 120 },
  { key: 'createdAt', label: 'Created', format: 'date', minWidth: 180 },
]

const logisticsColumns: DynamicTableColumn<AdminOrderLogisticsTimelineItem>[] = [
  { key: 'eventType', label: 'Event', minWidth: 190 },
  { key: 'packageCondition', label: 'Condition', minWidth: 140 },
  { key: 'issueType', label: 'Issue', minWidth: 140 },
  { key: 'internalNote', label: 'Note', minWidth: 240, placeholder: 'No note' },
  {
    key: 'proofMediaAssetId',
    label: 'Proof',
    minWidth: 160,
    renderCell: (event) => event.proofMediaAssetId ? 'Attached' : 'Not attached',
  },
  { key: 'eventTime', label: 'Event Time', format: 'date', minWidth: 180 },
]

const noteColumns: DynamicTableColumn<AdminOrderNote>[] = [
  { key: 'note', label: 'Note', minWidth: 280 },
  { key: 'isPinned', label: 'Pinned', renderCell: (note) => note.isPinned ? 'Yes' : 'No' },
  { key: 'createdAt', label: 'Created', format: 'date', minWidth: 180 },
]

const paymentColumns: DynamicTableColumn<AdminOrderPayment>[] = [
  { key: 'publicPaymentId', label: 'Payment', minWidth: 180 },
  { key: 'status', label: 'Status', format: 'status', statusTone: (value) => value === 'PAID' ? 'success' : 'warning' },
  { key: 'amountPaise', label: 'Amount', align: 'right', renderCell: (payment) => formatMoney(payment.amountPaise / 100) },
]

const refundColumns: DynamicTableColumn<AdminOrderRefund>[] = [
  { key: 'refundId', label: 'Refund', minWidth: 220 },
  { key: 'status', label: 'Status', format: 'status', statusTone: 'warning' },
  { key: 'amountPaise', label: 'Amount', align: 'right', renderCell: (refund) => formatMoney(refund.amountPaise / 100) },
  { key: 'reason', label: 'Reason', minWidth: 220 },
]

const mediaColumns: DynamicTableColumn<AdminOrderMediaAsset>[] = [
  { key: 'purpose', label: 'Purpose', minWidth: 180 },
  { key: 'fileName', label: 'File', minWidth: 220 },
  { key: 'status', label: 'Status', format: 'status', statusTone: 'info' },
]

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p>
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

function actionTargetStatus(action: string) {
  return action.replace(/^MARK_/, '') as AdminOrderStatus
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
  isSubmitting,
  onSelectAction,
  order,
}: {
  isSubmitting: boolean
  onSelectAction: (kind: OrderActionKind, targetStatus?: AdminOrderStatus) => void
  order: AdminOrderDetail
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {order.availableActions.includes('INITIATE_REFUND') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('INITIATE_REFUND')}>
          <RotateCcw className="mr-2 size-4" />
          Refund
        </Button>
      ) : null}
      {order.availableActions.includes('CREATE_PROOF_UPLOAD_INTENT') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('CREATE_PROOF_UPLOAD_INTENT')}>
          <FileUp className="mr-2 size-4" />
          Proof Upload
        </Button>
      ) : null}
      {order.availableActions.includes('CANCEL') ? (
        <Button disabled={isSubmitting} size="sm" variant="danger" onClick={() => onSelectAction('CANCEL')}>
          <Ban className="mr-2 size-4" />
          Cancel
        </Button>
      ) : null}
      <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('ADD_NOTE')}>
        <MessageSquarePlus className="mr-2 size-4" />
        Add Note
      </Button>
    </div>
  )
}

function ManualLogisticsPanel({
  isSubmitting,
  onSelectAction,
  order,
}: {
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
          <div className="rounded-[0.85rem] border border-border bg-background/40 p-3">
            <p className="text-xs font-semibold uppercase text-muted">Current status</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{formatStatusLabel(order.orderStatus)}</p>
          </div>
          <div className="rounded-[0.85rem] border border-border bg-background/40 p-3">
            <p className="text-xs font-semibold uppercase text-muted">Next step</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {primaryTarget ? manualStatusCopy[primaryTarget]?.label ?? formatStatusLabel(primaryTarget) : 'No manual step'}
            </p>
          </div>
          <div className="rounded-[0.85rem] border border-border bg-background/40 p-3">
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
          {primaryTarget ? (
            <Button disabled={isSubmitting} size="sm" onClick={() => onSelectAction('UPDATE_STATUS', primaryTarget)}>
              <Truck className="mr-2 size-4" />
              {manualStatusCopy[primaryTarget]?.label ?? formatStatusLabel(primaryTarget)}
            </Button>
          ) : (
            <div className="rounded-[0.85rem] border border-border bg-background/40 px-3 py-2 text-sm text-muted">
              No valid manual transition is available for this status.
            </div>
          )}

          {secondaryActions.map((action) => {
            const targetStatus = actionTargetStatus(action)
            return (
              <Button disabled={isSubmitting} key={action} size="sm" variant="secondary" onClick={() => onSelectAction('UPDATE_STATUS', targetStatus)}>
                {manualStatusCopy[targetStatus]?.label ?? formatStatusLabel(targetStatus)}
              </Button>
            )
          })}
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
            <div className="rounded-[0.85rem] border border-border bg-background/40 p-3">
              <p className="text-xs font-semibold uppercase text-muted">Expires</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatDate(order.activeDeliveryOtp.expiresAt, true)}</p>
            </div>
            <div className="rounded-[0.85rem] border border-border bg-background/40 p-3">
              <p className="text-xs font-semibold uppercase text-muted">Attempts</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {order.activeDeliveryOtp.attempts}/{order.activeDeliveryOtp.maxAttempts}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-[0.85rem] border border-border bg-background/40 p-3 text-sm text-muted">
            OTP controls become available when the order is out for delivery.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {order.availableActions.includes('GENERATE_DELIVERY_OTP') ? (
            <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('GENERATE_DELIVERY_OTP')}>
              <ShieldCheck className="mr-2 size-4" />
              Generate OTP
            </Button>
          ) : null}
          {order.availableActions.includes('CONFIRM_DELIVERY_OTP') ? (
            <Button disabled={isSubmitting} size="sm" onClick={() => onSelectAction('CONFIRM_DELIVERY_OTP')}>
              <CircleCheck className="mr-2 size-4" />
              Confirm OTP
            </Button>
          ) : null}
          {order.availableActions.includes('CREATE_PROOF_UPLOAD_INTENT') ? (
            <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('CREATE_PROOF_UPLOAD_INTENT')}>
              <PackageCheck className="mr-2 size-4" />
              Proof Upload
            </Button>
          ) : null}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-[0.85rem] border border-border bg-background/40 p-3 text-sm text-muted">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          <p>Every manual update writes order history, logistics timeline, and admin audit records.</p>
        </div>
      </div>
    </section>
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
  const queryClient = useQueryClient()
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
    ])
  }

  const actionMutation = useMutation({
    mutationFn: async ({ action, values }: { action: OrderActionSelection; values: OrderActionFormValues }) => {
      if (!order) {
        throw new Error('Order details are unavailable.')
      }

      if (action.kind === 'UPDATE_STATUS') {
        if (!values.targetStatus) {
          throw new Error('Target status is required.')
        }

        return orderService.updateOrderStatus(order.orderId, {
          targetStatus: values.targetStatus,
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
    onSuccess: () => {
      setSelectedAction(null)
      void refreshOrder()
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Order action failed.')
    },
  })

  const openAction = (kind: OrderActionKind, targetStatus?: AdminOrderStatus) => {
    setActionError(null)
    setSelectedAction({ kind, targetStatus })
  }

  if (!orderId) {
    return <PageContainer><ErrorState title="Order not found" description="The order route is missing an order id." /></PageContainer>
  }

  if (orderQuery.isLoading) {
    return <PageContainer><Skeleton className="h-24 w-full" /><Skeleton className="h-[28rem] w-full" /></PageContainer>
  }

  if (orderQuery.isError) {
    return <PageContainer><ErrorState title="Order unavailable" description="We could not load this order. Please retry." onRetry={() => void orderQuery.refetch()} /></PageContainer>
  }

  if (!order) {
    return <PageContainer><EmptyState title="Order not found" description="The order detail API returned no order data." /></PageContainer>
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={<OrderHeaderActions isSubmitting={actionMutation.isPending} order={order} onSelectAction={openAction} />}
        description={`${order.customer.fullName} · ${order.vendor.shopName}`}
        listHref={listHref}
        listLabel={listLabel}
        recordName={order.publicOrderId}
        titleMetaNode={<OrderHeaderStatus order={order} />}
      />

      <PriceRevisionNotice order={order} />

      <ManualLogisticsPanel
        isSubmitting={actionMutation.isPending}
        order={order}
        onSelectAction={openAction}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Order Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Order ID" value={order.orderId} />
            <DetailField label="Public Order ID" value={order.publicOrderId} />
            <DetailField label="Customer" value={order.customer.fullName} />
            <DetailField label="Customer Mobile" value={order.customer.mobileNumber} />
            <DetailField label="Vendor" value={order.vendor.shopName} />
            <DetailField label="Category" value={order.category?.name} />
            <DetailField label="Payment Method" value={order.paymentMethod} />
            <DetailField label="Value" value={orderDisplayValue(order)} />
            <DetailField label="Pickup Date" value={order.schedule.pickupDate} />
            <DetailField label="Expected Delivery" value={order.schedule.expectedDeliveryAt} />
            <DetailField label="Cancellation Reason" value={order.cancellationReason} />
            <DetailField label="Warnings" value={order.warnings.length ? order.warnings.join(', ') : null} />
            <DetailField label="Active Delivery OTP" value={order.activeDeliveryOtp?.status} />
            <DetailField label="Created At" value={order.createdAt} />
          </div>
        </div>
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Operational Counts</h2>
          <DetailField label="Items" value={order.counts?.itemCount} />
          <DetailField label="Notes" value={order.counts?.noteCount} />
          <DetailField label="Logistics Events" value={order.counts?.logisticsEventCount} />
          <DetailField label="Refunds" value={order.counts?.refundCount} />
          <DetailField label="Active OTPs" value={order.counts?.activeOtpCount} />
          <DetailField label="Next Action" value={order.nextRecommendedAction} />
        </div>
      </section>

      <section className="space-y-4">
        <DynamicTable columns={itemColumns} data={order.items} emptyTitle="No items" getRowId={(row) => row.orderItemId} title="Items" />
        <DynamicTable columns={statusColumns} data={order.statusHistory} emptyTitle="No status history" getRowId={(row) => row.statusHistoryId} title="Status History" />
        <DynamicTable columns={logisticsColumns} data={order.logisticsTimeline} emptyTitle="No logistics timeline" getRowId={(row) => row.logisticsEventId} title="Logistics Timeline" />
        <DynamicTable columns={paymentColumns} data={order.payments} emptyTitle="No payments" getRowId={(row) => row.paymentId} title="Payments" />
        <DynamicTable columns={refundColumns} data={order.refunds} emptyTitle="No refunds" getRowId={(row) => row.refundId} title="Refunds" />
        <DynamicTable columns={noteColumns} data={order.notes} emptyTitle="No notes" getRowId={(row) => row.orderNoteId} title="Notes" />
        <DynamicTable columns={mediaColumns} data={order.mediaAssets} emptyTitle="No media assets" getRowId={(row) => row.orderMediaAssetId} title="Media Assets" />
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
