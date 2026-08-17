import { formatDate } from '../../utils/formatDate'
import { formatMoney } from '../../utils/formatMoney'
import type {
  AdminOrderPaymentStatus,
  AdminOrderStatus,
  AdminOrderSummary,
} from './types/order.types'
import type { OrderActionSelection } from './components/OrderActionModal'

export type OrderTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const orderStatuses: AdminOrderStatus[] = [
  'ORDER_PLACED',
  'VENDOR_ACCEPTANCE_PENDING',
  'PRICE_REVISION_PENDING_CUSTOMER',
  'VENDOR_ACCEPTED',
  'VENDOR_DECLINED',
  'PICKUP_SCHEDULED',
  'PICKED_UP_FROM_CUSTOMER',
  'HANDED_OVER_TO_VENDOR',
  'ITEM_RECEIVED_BY_VENDOR',
  'SERVICE_IN_PROGRESS',
  'SERVICE_COMPLETED',
  'COLLECTED_FROM_VENDOR',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'DELIVERY_FAILED',
  'CUSTOMER_UNAVAILABLE',
  'ITEM_DAMAGED',
  'ITEM_LOST',
  'WRONG_ITEM',
]

export const paymentStatuses: AdminOrderPaymentStatus[] = [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'COD_PENDING',
]

export function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review order'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Null renders as an em-dash, never as a sentence. */
export function formatDateSafe(value: string | null | undefined, withTime = false) {
  if (!value) return '—'

  try {
    return formatDate(value, withTime)
  } catch {
    return '—'
  }
}

export function getOrderStatusTone(status: AdminOrderStatus): OrderTone {
  if (status === 'DELIVERED') return 'success'
  if (
    status === 'CANCELLED' ||
    status === 'ITEM_DAMAGED' ||
    status === 'ITEM_LOST' ||
    status === 'WRONG_ITEM'
  ) {
    return 'danger'
  }

  if (
    status === 'PRICE_REVISION_PENDING_CUSTOMER' ||
    status === 'VENDOR_ACCEPTANCE_PENDING' ||
    status === 'DELIVERY_FAILED' ||
    status === 'CUSTOMER_UNAVAILABLE'
  ) {
    return 'warning'
  }

  return 'info'
}

export function getPaymentStatusTone(status: AdminOrderPaymentStatus): OrderTone {
  if (status === 'PAID' || status === 'REFUNDED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PARTIALLY_REFUNDED') return 'info'
  return 'warning'
}

export function orderDisplayValue(order: AdminOrderSummary) {
  const pendingRevision = order.pricing.pendingPriceRevision

  if (pendingRevision) {
    return {
      meta: `Was ${formatMoney(pendingRevision.previousPricePaise / 100)}`,
      value: formatMoney(pendingRevision.revisedPricePaise / 100),
    }
  }

  const amountPaise =
    order.pricing.finalPricePaise ??
    order.pricing.payableAmountPaise ??
    order.pricing.priceEstimatePaise

  return {
    meta: order.pricing.finalPricePaise ? 'Final value' : 'Estimate',
    value: formatMoney(amountPaise / 100),
  }
}

export function hasOrderAction(order: AdminOrderSummary, action: string) {
  return order.availableActions
    .map((availableAction) => availableAction.toUpperCase())
    .includes(action.toUpperCase())
}

function hasActiveDeliveryOtp(order: AdminOrderSummary) {
  return (order.counts?.activeOtpCount ?? 0) > 0
}

function canGenerateDeliveryOtp(order: AdminOrderSummary) {
  return hasOrderAction(order, 'GENERATE_DELIVERY_OTP') && !hasActiveDeliveryOtp(order)
}

function canConfirmDeliveryOtp(order: AdminOrderSummary) {
  return hasOrderAction(order, 'CONFIRM_DELIVERY_OTP') && hasActiveDeliveryOtp(order)
}

function statusFromRecommendedAction(action: string) {
  const normalized = action.toUpperCase()
  const markPrefix = 'MARK_'

  if (normalized.startsWith(markPrefix)) {
    const targetStatus = normalized.slice(markPrefix.length)

    if (orderStatuses.includes(targetStatus as AdminOrderStatus)) {
      return targetStatus as AdminOrderStatus
    }
  }

  return null
}

/**
 * Turns the server's `nextRecommendedAction` into an action the UI can offer,
 * but only when `availableActions` also permits it — the recommendation alone
 * is not authorisation.
 */
export function mapRecommendedAction(
  order: AdminOrderSummary,
): OrderActionSelection | null {
  const action = order.nextRecommendedAction?.toUpperCase()

  if (!action) return null

  if (action === 'ADD_NOTE' && hasOrderAction(order, 'ADD_NOTE')) {
    return { kind: 'ADD_NOTE' }
  }

  if (
    action === 'CREATE_PROOF_UPLOAD_INTENT' &&
    hasOrderAction(order, 'CREATE_PROOF_UPLOAD_INTENT')
  ) {
    return { kind: 'CREATE_PROOF_UPLOAD_INTENT' }
  }

  if (action === 'CANCEL' && hasOrderAction(order, 'CANCEL')) {
    return { kind: 'CANCEL' }
  }

  if (action === 'INITIATE_REFUND' && hasOrderAction(order, 'INITIATE_REFUND')) {
    return { kind: 'INITIATE_REFUND' }
  }

  if (action === 'GENERATE_DELIVERY_OTP' && canGenerateDeliveryOtp(order)) {
    return { kind: 'GENERATE_DELIVERY_OTP' }
  }

  if (action === 'CONFIRM_DELIVERY_OTP' && canConfirmDeliveryOtp(order)) {
    return { kind: 'CONFIRM_DELIVERY_OTP' }
  }

  const targetStatus = statusFromRecommendedAction(action)

  if (targetStatus && hasOrderAction(order, `MARK_${targetStatus}`)) {
    return { kind: 'UPDATE_STATUS', targetStatus }
  }

  return null
}

export function canRunOrderAction(
  action: OrderActionSelection,
  canRefundPayments: boolean,
  canUpdateOrders: boolean,
) {
  if (action.kind === 'INITIATE_REFUND') return canRefundPayments
  return canUpdateOrders
}

/** Short enough to sit inside a table row without wrapping. */
export function compactOrderRowActionLabel(action: OrderActionSelection) {
  if (action.kind === 'UPDATE_STATUS') {
    if (action.targetStatus === 'PICKUP_SCHEDULED') return 'Schedule pickup'
    if (action.targetStatus === 'COLLECTED_FROM_VENDOR') return 'Collect'
    if (action.targetStatus === 'OUT_FOR_DELIVERY') return 'Out for delivery'
    if (action.targetStatus === 'DELIVERED') return 'Mark delivered'

    return humanizeCode(action.targetStatus)
  }

  if (action.kind === 'CREATE_PROOF_UPLOAD_INTENT') return 'Request proof'
  if (action.kind === 'INITIATE_REFUND') return 'Start refund'
  if (action.kind === 'GENERATE_DELIVERY_OTP') return 'Generate OTP'
  if (action.kind === 'CONFIRM_DELIVERY_OTP') return 'Confirm OTP'
  if (action.kind === 'ADD_NOTE') return 'Add note'
  if (action.kind === 'CANCEL') return 'Cancel order'

  return 'Review'
}

export function orderActionKey(action: OrderActionSelection) {
  return action.kind === 'UPDATE_STATUS'
    ? `mark-${action.targetStatus}`
    : action.kind
}

export function isHighRiskOrderAction(action: OrderActionSelection) {
  return action.kind === 'CANCEL' || action.kind === 'INITIATE_REFUND'
}

export const orderQueueStatusFilters: Partial<Record<string, AdminOrderStatus[]>> = {
  attention: ['PRICE_REVISION_PENDING_CUSTOMER'],
  acceptance: ['VENDOR_ACCEPTANCE_PENDING'],
  inProgress: [
    'VENDOR_ACCEPTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP_FROM_CUSTOMER',
    'HANDED_OVER_TO_VENDOR',
    'ITEM_RECEIVED_BY_VENDOR',
    'SERVICE_IN_PROGRESS',
    'SERVICE_COMPLETED',
  ],
  delivery: [
    'COLLECTED_FROM_VENDOR',
    'OUT_FOR_DELIVERY',
    'DELIVERY_FAILED',
    'CUSTOMER_UNAVAILABLE',
  ],
  completed: ['DELIVERED'],
  cancelled: ['CANCELLED'],
}

export const orderPaymentReviewStatuses: AdminOrderPaymentStatus[] = [
  'PENDING',
  'FAILED',
  'COD_PENDING',
]
