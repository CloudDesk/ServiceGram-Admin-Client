import { formatDate } from '../../utils/formatDate'
import { formatMoney } from '../../utils/formatMoney'
import type {
  AdminPaymentStatus,
  AdminPaymentSummary,
  AdminRefundStatus,
  AdminRefundSummary,
} from './types/payment.types'

export type PaymentTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export function humanizeCode(value: string | null | undefined) {
  if (!value) return '—'

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

export function formatPaise(value: number | null | undefined) {
  return formatMoney((value ?? 0) / 100)
}

export function getPaymentStatusTone(status: AdminPaymentStatus): PaymentTone {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'CREATED' || status === 'PENDING') return 'warning'
  return 'neutral'
}

/** Statuses that constitute the "needs review" queue. */
export const paymentReviewStatuses: AdminPaymentStatus[] = [
  'CREATED',
  'PENDING',
  'FAILED',
]

/**
 * A one-line reason this payment might need attention, or null when it is
 * clear. Used for the row's signal column so an admin can triage without
 * opening the record.
 */
export function paymentSignal(payment: AdminPaymentSummary) {
  if (payment.warnings[0]) {
    return { label: humanizeCode(payment.warnings[0]), tone: 'danger' as const }
  }

  if (payment.status === 'FAILED') {
    return {
      label: payment.failureCode ? humanizeCode(payment.failureCode) : 'Failed',
      tone: 'danger' as const,
    }
  }

  if (payment.status === 'CANCELLED') {
    return { label: 'Cancelled', tone: 'danger' as const }
  }

  if (payment.refundSummary.requestedCount > 0) {
    return {
      label: `${payment.refundSummary.requestedCount} refund request${
        payment.refundSummary.requestedCount === 1 ? '' : 's'
      }`,
      tone: 'warning' as const,
    }
  }

  if (payment.status === 'CREATED' || payment.status === 'PENDING') {
    return { label: 'Awaiting confirmation', tone: 'warning' as const }
  }

  return null
}

/**
 * Reconcile is the only list-level action, and it is constructive, so it may
 * occupy the row's primary button. See vendorPresenters.getRowPrimaryAction
 * for why `nextRecommendedAction` is not promoted blindly.
 */
export function canReconcilePayment(payment: AdminPaymentSummary) {
  return payment.availableActions.includes('RECONCILE')
}

export function getRefundStatusTone(status: AdminRefundStatus): PaymentTone {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED' || status === 'REJECTED') return 'danger'
  if (status === 'REQUESTED' || status === 'PROCESSING') return 'warning'
  return 'neutral'
}

/** A one-line reason this refund needs attention, or null when it is clear. */
export function refundSignal(refund: AdminRefundSummary) {
  if (refund.warnings[0]) {
    return { label: humanizeCode(refund.warnings[0]), tone: 'danger' as const }
  }

  if (refund.status === 'FAILED') {
    return { label: 'Refund failed', tone: 'danger' as const }
  }

  if (refund.status === 'REJECTED') {
    return {
      label: refund.rejectionReason || 'Rejected',
      tone: 'danger' as const,
    }
  }

  if (refund.status === 'REQUESTED') {
    return { label: 'Awaiting review', tone: 'warning' as const }
  }

  if (refund.status === 'PROCESSING') {
    return { label: 'Processing', tone: 'warning' as const }
  }

  return null
}

export function canApproveRefund(refund: AdminRefundSummary) {
  return refund.availableActions.includes('APPROVE')
}

export function canRejectRefund(refund: AdminRefundSummary) {
  return refund.availableActions.includes('REJECT')
}
