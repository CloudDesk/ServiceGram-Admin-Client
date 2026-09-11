export const SERVICE_PENDING_LIST_PATH = '/admin/services/pending'
export const SERVICE_DETAIL_PATH = (serviceId: string) =>
  `/admin/services/${serviceId}`
export const SERVICE_APPROVE_PATH = (serviceId: string) =>
  `/admin/services/${serviceId}/approve`
export const SERVICE_REJECT_PATH = (serviceId: string) =>
  `/admin/services/${serviceId}/reject`
