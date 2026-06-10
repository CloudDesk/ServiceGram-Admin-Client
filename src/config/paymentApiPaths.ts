export const PAYMENT_LIST_PATH = '/admin/payments'
export const PAYMENT_DETAIL_PATH = (paymentId: string) => `/admin/payments/${paymentId}`
export const PAYMENT_RECONCILE_PATH = (paymentId: string) =>
  `/admin/payments/${paymentId}/reconcile`
export const REFUND_LIST_PATH = '/admin/refunds'
export const REFUND_APPROVE_PATH = (refundId: string) =>
  `/admin/refunds/${refundId}/approve`
export const REFUND_REJECT_PATH = (refundId: string) =>
  `/admin/refunds/${refundId}/reject`
