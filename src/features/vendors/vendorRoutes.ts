import { routePaths } from '../../config/routes'
import type { VendorOnboardingStatus } from './types/vendor.types'

export type VendorQueueKey =
  | 'active'
  | 'onboarding'
  | 'submitted'
  | 'underReview'
  | 'documentsPending'
  | 'rejected'
  | 'suspended'

export type VendorDetailTab =
  | 'overview'
  | 'analytics'
  | 'reputation'
  | 'documents'
  | 'payout-account'
  | 'payouts'
  | 'orders'
  | 'services'
  | 'reels'
  | 'profile'

export const vendorDetailSectionIds = {
  overview: 'vendor-detail-overview',
  documents: 'vendor-detail-documents',
  payoutAccount: 'vendor-detail-payout-account',
  payouts: 'vendor-detail-payouts',
  orders: 'vendor-detail-orders',
  services: 'vendor-detail-services',
  reels: 'vendor-detail-reels',
  profile: 'vendor-detail-profile',
} as const

export type VendorDetailSectionKey = keyof typeof vendorDetailSectionIds

export const vendorDetailTabBySection: Record<
  VendorDetailSectionKey,
  VendorDetailTab
> = {
  overview: 'overview',
  documents: 'documents',
  payoutAccount: 'payout-account',
  payouts: 'payouts',
  orders: 'orders',
  services: 'services',
  reels: 'reels',
  profile: 'profile',
}

const vendorQueueKeys: VendorQueueKey[] = [
  'active',
  'onboarding',
  'submitted',
  'underReview',
  'documentsPending',
  'rejected',
  'suspended',
]

const legacyOnboardingQueue: Partial<
  Record<VendorOnboardingStatus, VendorQueueKey>
> = {
  SUBMITTED: 'submitted',
  DOCUMENTS_PENDING: 'documentsPending',
  UNDER_REVIEW: 'underReview',
  REJECTED: 'rejected',
}

export function readVendorQueue(searchParams: URLSearchParams): VendorQueueKey {
  const queue = searchParams.get('queue') as VendorQueueKey | null
  if (queue && vendorQueueKeys.includes(queue)) return queue

  const onboardingStatus = searchParams.get(
    'onboardingStatus',
  ) as VendorOnboardingStatus | null
  if (onboardingStatus && legacyOnboardingQueue[onboardingStatus]) {
    return legacyOnboardingQueue[onboardingStatus]
  }

  if (searchParams.get('vendorStatus') === 'SUSPENDED') return 'suspended'
  if (searchParams.get('vendorStatus') === 'ACTIVE') return 'active'

  return 'active'
}

export function buildVendorOnboardingRedirect(
  search: string,
  hash = '',
  vendorId?: string,
) {
  if (vendorId) return `${routePaths.vendors}/${vendorId}`

  const params = new URLSearchParams(search)
  const onboardingStatus = params.get('onboardingStatus')
  const queue = onboardingStatus
    ? legacyOnboardingQueue[onboardingStatus as VendorOnboardingStatus]
    : null

  params.set('queue', queue ?? 'onboarding')
  params.delete('onboardingStatus')

  if (params.has('bankAccountStatus')) {
    params.set('approvalQueue', 'BANK_ACCOUNT_APPROVALS')
    params.delete('bankAccountStatus')
  }

  const query = params.toString()
  return `${routePaths.vendors}${query ? `?${query}` : ''}${hash}`
}

export function buildVendorDetailSectionPath(
  vendorId: string,
  section: VendorDetailSectionKey,
) {
  const tab = vendorDetailTabBySection[section]
  const basePath = `${routePaths.vendors}/${vendorId}`
  const pathname = tab === 'overview' ? basePath : `${basePath}/tab/${tab}`

  return `${pathname}#${vendorDetailSectionIds[section]}`
}
