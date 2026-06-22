export const REPORT_ORDER_LIFECYCLE_PATH = '/admin/reports/order-lifecycle'
export const REPORT_VENDOR_PERFORMANCE_PATH = '/admin/reports/vendor-performance'
export const REPORT_PAYMENTS_PATH = '/admin/reports/payments'
export const REPORT_PAYOUTS_PATH = '/admin/reports/payouts'
export const REPORT_REFUNDS_PATH = '/admin/reports/refunds'
export const REPORT_EXPORTS_PATH = '/admin/reports/exports'
export const REPORT_EXPORT_DETAIL_PATH = (exportId: string) =>
  `/admin/reports/exports/${exportId}`
