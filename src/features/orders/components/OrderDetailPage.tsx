import {
  Ban,
  FileUp,
  MessageSquarePlus,
  RotateCcw,
  ShieldCheck,
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

function OrderHeaderStatus({ order }: { order: AdminOrderDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={order.orderStatus === 'DELIVERED' ? 'success' : order.orderStatus === 'CANCELLED' ? 'danger' : 'info'}>
        {order.orderStatus}
      </Badge>
      <Badge tone={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'FAILED' ? 'danger' : 'warning'}>
        {order.paymentStatus}
      </Badge>
    </div>
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
  const markActions = order.availableActions.filter((action) => action.startsWith('MARK_'))

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {markActions.map((action) => {
        const targetStatus = action.replace(/^MARK_/, '') as AdminOrderStatus

        return (
          <Button disabled={isSubmitting} key={action} size="sm" onClick={() => onSelectAction('UPDATE_STATUS', targetStatus)}>
            <Truck className="mr-2 size-4" />
            {targetStatus.replaceAll('_', ' ')}
          </Button>
        )
      })}
      {order.availableActions.includes('GENERATE_DELIVERY_OTP') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('GENERATE_DELIVERY_OTP')}>
          <ShieldCheck className="mr-2 size-4" />
          Generate OTP
        </Button>
      ) : null}
      {order.availableActions.includes('CONFIRM_DELIVERY_OTP') ? (
        <Button disabled={isSubmitting} size="sm" variant="secondary" onClick={() => onSelectAction('CONFIRM_DELIVERY_OTP')}>
          <ShieldCheck className="mr-2 size-4" />
          Confirm OTP
        </Button>
      ) : null}
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

export function OrderDetailPage() {
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
        listHref={routePaths.orders}
        listLabel="Orders"
        recordName={order.publicOrderId}
        titleMetaNode={<OrderHeaderStatus order={order} />}
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
            <DetailField label="Value" value={formatMoney((order.pricing.finalPricePaise ?? order.pricing.priceEstimatePaise) / 100)} />
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
