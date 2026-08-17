import { formatDate } from '../../utils/formatDate'
import { formatMoney } from '../../utils/formatMoney'
import type { AdminPayoutStatus, AdminPayoutSummary } from './types/payout.types'
import type { PayoutActionKind } from './components/PayoutActionModal'

export type PayoutTone = 'success' | 'warning' | 'danger' | 'neutral'

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

export function getPayoutStatusTone(status: AdminPayoutStatus): PayoutTone {
  if (status === 'PAID') return 'success'
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger'
  if (status === 'HELD' || status === 'UNDER_REVIEW' || status === 'PENDING') {
    return 'warning'
  }
  return 'neutral'
}

/** A one-line reason this payout needs attention, or null when it is clear. */
export function payoutSignal(payout: AdminPayoutSummary) {
  if (payout.failureReason) {
    return { label: payout.failureReason, tone: 'danger' as const }
  }

  if (payout.holdReason) {
    return { label: payout.holdReason, tone: 'warning' as const }
  }

  if (payout.warnings[0]) {
    return { label: humanizeCode(payout.warnings[0]), tone: 'warning' as const }
  }

  if (payout.status === 'UNDER_REVIEW' || payout.status === 'PENDING') {
    return { label: 'Awaiting review', tone: 'warning' as const }
  }

  return null
}

export function hasPayoutAction(payout: AdminPayoutSummary, kind: PayoutActionKind) {
  return payout.availableActions.includes(kind)
}

/**
 * Only constructive actions may occupy the row's primary button. Hold, mark
 * failed and cancel withhold money from a vendor, so they stay behind the
 * overflow — the same rule as vendorPresenters.getRowPrimaryAction.
 */
export function getRowPrimaryAction(
  payout: AdminPayoutSummary,
): PayoutActionKind | null {
  const constructive: PayoutActionKind[] = ['APPROVE', 'RELEASE_HOLD', 'MARK_PAID']

  return constructive.find((kind) => hasPayoutAction(payout, kind)) ?? null
}

export function getOverflowActions(
  payout: AdminPayoutSummary,
  primary: PayoutActionKind | null,
): PayoutActionKind[] {
  const rest: PayoutActionKind[] = [
    'APPROVE',
    'RELEASE_HOLD',
    'MARK_PAID',
    'HOLD',
    'MARK_FAILED',
  ]

  return rest.filter((kind) => kind !== primary && hasPayoutAction(payout, kind))
}

export function isDestructivePayoutAction(kind: PayoutActionKind) {
  return kind === 'HOLD' || kind === 'MARK_FAILED'
}

export function payoutActionLabel(kind: PayoutActionKind) {
  return {
    CREATE: 'Create payout',
    APPROVE: 'Approve',
    HOLD: 'Hold',
    RELEASE_HOLD: 'Release hold',
    MARK_PAID: 'Mark paid',
    MARK_FAILED: 'Mark failed',
  }[kind]
}
