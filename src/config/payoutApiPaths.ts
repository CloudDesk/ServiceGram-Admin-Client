export const PAYOUT_LIST_PATH = '/admin/payouts'
export const PAYOUT_CREATE_PATH = '/admin/payouts'
export const PAYOUT_VENDOR_LIST_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/payouts`
export const PAYOUT_DETAIL_PATH = (payoutId: string) => `/admin/payouts/${payoutId}`
export const PAYOUT_APPROVE_PATH = (payoutId: string) =>
  `/admin/payouts/${payoutId}/approve`
export const PAYOUT_HOLD_PATH = (payoutId: string) => `/admin/payouts/${payoutId}/hold`
export const PAYOUT_RELEASE_HOLD_PATH = (payoutId: string) =>
  `/admin/payouts/${payoutId}/release-hold`
export const PAYOUT_MARK_PAID_PATH = (payoutId: string) =>
  `/admin/payouts/${payoutId}/mark-paid`
export const PAYOUT_MARK_FAILED_PATH = (payoutId: string) =>
  `/admin/payouts/${payoutId}/mark-failed`
