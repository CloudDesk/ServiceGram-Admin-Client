import { formatDate } from '../../utils/formatDate'
import type {
  VendorListItem,
  VendorOnboardingStatus,
  VendorStatus,
} from './types/vendor.types'

export type VendorTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** Actions the list surface can offer. The detail page supports more. */
export const vendorListActionKinds = [
  'ADD_NOTE',
  'APPROVE',
  'REACTIVATE',
  'REJECT',
  'REQUEST_DOCUMENTS',
  'SUSPEND',
] as const

export type VendorListActionKind = (typeof vendorListActionKinds)[number]

export function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Review vendor'

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

export function isRejectedVendor(vendor: VendorListItem) {
  return (
    vendor.onboardingStatus === 'REJECTED' && vendor.vendorStatus === 'INACTIVE'
  )
}

/**
 * A rejected vendor can always be reactivated even when the API omits the
 * action, because rejection is the state reactivation exists to undo.
 */
export function getVendorActionSource(vendor: VendorListItem) {
  if (!isRejectedVendor(vendor) || vendor.availableActions.includes('REACTIVATE')) {
    return vendor.availableActions
  }

  return [...vendor.availableActions, 'REACTIVATE']
}

export function isVendorListActionKind(
  action: string | null | undefined,
): action is VendorListActionKind {
  return vendorListActionKinds.includes(action as VendorListActionKind)
}

export function getVisibleVendorActions(actions: string[]) {
  return actions.filter(isVendorListActionKind)
}

export function getVendorStatusTone(status: VendorStatus): VendorTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED') return 'danger'
  if (status === 'PENDING') return 'warning'
  return 'neutral'
}

export function getOnboardingStatusTone(
  status: VendorOnboardingStatus,
): VendorTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'DOCUMENTS_PENDING' || status === 'UNDER_REVIEW') return 'warning'
  return 'info'
}

export function getPayoutAccountTone(vendor: VendorListItem): VendorTone {
  const summary = vendor.bankAccountSummary

  if (!summary || !summary.hasPrimary) return 'warning'
  if (summary.payoutReady || summary.primaryStatus === 'VERIFIED') return 'success'
  if (summary.primaryStatus === 'REJECTED' || summary.primaryStatus === 'DISABLED') {
    return 'danger'
  }

  return 'warning'
}

export function getPayoutAccountLabel(vendor: VendorListItem) {
  const summary = vendor.bankAccountSummary

  if (!summary) return '—'
  if (!summary.hasPrimary) return 'Not submitted'
  if (summary.payoutReady) return 'Payout ready'

  return summary.primaryStatus ? humanizeCode(summary.primaryStatus) : 'Review needed'
}

export function getDocumentSummaryLabel(vendor: VendorListItem) {
  if (!vendor.documentSummary) return '—'

  return `${vendor.documentSummary.verified}/${vendor.documentSummary.total}`
}

export function getDocumentSummaryTone(vendor: VendorListItem): VendorTone {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) return 'warning'
  if (summary.rejected || summary.expired) return 'danger'
  if (summary.verified === summary.total) return 'success'
  return 'warning'
}

export function vendorLocationLabel(vendor: VendorListItem) {
  const city = vendor.address.city
  const zone = vendor.address.zone?.zoneName

  if (city && zone) return `${city} · ${zone}`
  if (city) return city
  if (zone) return zone
  return '—'
}

function visibleRecommendedAction(vendor: VendorListItem) {
  const action = vendor.nextRecommendedAction?.toUpperCase()

  return isVendorListActionKind(action) ? action : null
}

export function vendorNeedsAttention(vendor: VendorListItem) {
  return (
    vendor.vendorStatus === 'SUSPENDED' ||
    vendor.onboardingStatus !== 'APPROVED' ||
    vendor.warnings.length > 0 ||
    Boolean(visibleRecommendedAction(vendor)) ||
    getPayoutAccountTone(vendor) !== 'success'
  )
}

/**
 * The server's recommendation, honoured only when `availableActions` also
 * permits it — the recommendation alone is not authorisation.
 */
export function mapRecommendedAction(
  vendor: VendorListItem,
): VendorListActionKind | null {
  const action =
    visibleRecommendedAction(vendor) ??
    (isRejectedVendor(vendor) ? 'REACTIVATE' : null)

  if (!action) return null

  if (
    action === 'ADD_NOTE' ||
    getVisibleVendorActions(getVendorActionSource(vendor)).includes(action)
  ) {
    return action
  }

  return null
}

/**
 * Approval is gated on document verification. Returns the reason when it is
 * blocked, so the UI can explain rather than silently disable.
 */
export function getApprovalBlockMessage(vendor: VendorListItem) {
  const summary = vendor.documentSummary

  if (!summary || summary.total === 0) {
    return 'Approval is blocked until the vendor uploads required documents.'
  }

  const unverifiedCount = Math.max(summary.total - summary.verified, 0)

  if (unverifiedCount === 0) return null

  return `Approval is blocked until ${unverifiedCount} document${
    unverifiedCount === 1 ? '' : 's'
  } are verified.`
}

export function vendorActionLabel(kind: VendorListActionKind) {
  if (kind === 'REQUEST_DOCUMENTS') return 'Request docs'
  if (kind === 'ADD_NOTE') return 'Add note'
  return humanizeCode(kind)
}

export function isHighRiskVendorAction(kind: VendorListActionKind) {
  return kind === 'REJECT' || kind === 'SUSPEND'
}

/**
 * Only constructive lifecycle actions may occupy the row's primary button.
 *
 * The API sets `nextRecommendedAction` to whatever lifecycle action is
 * available, so a healthy active vendor comes back recommending SUSPEND —
 * it means "this is what you could do", not "you should do this". Promoting
 * that to an emphasised button puts a destructive action one click away on
 * every healthy row. Destructive actions stay in the overflow menu.
 */
export function getRowPrimaryAction(
  vendor: VendorListItem,
): VendorListActionKind | null {
  const recommended = mapRecommendedAction(vendor)

  if (recommended === 'APPROVE' || recommended === 'REACTIVATE') {
    return recommended
  }

  return null
}
