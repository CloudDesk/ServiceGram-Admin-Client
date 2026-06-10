export const VENDOR_LIST_PATH = '/admin/vendors'
export const VENDOR_ONBOARDING_QUEUE_PATH = '/admin/vendors/onboarding-queue'
export const VENDOR_DETAIL_PATH = (vendorId: string) => `/admin/vendors/${vendorId}`
export const VENDOR_APPROVE_PATH = (vendorId: string) => `/admin/vendors/${vendorId}/approve`
export const VENDOR_REJECT_PATH = (vendorId: string) => `/admin/vendors/${vendorId}/reject`
export const VENDOR_REQUEST_DOCUMENTS_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/request-documents`
export const VENDOR_SUSPEND_PATH = (vendorId: string) => `/admin/vendors/${vendorId}/suspend`
export const VENDOR_REACTIVATE_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/reactivate`
export const VENDOR_VERIFY_DOCUMENT_PATH = (vendorId: string, documentId: string) =>
  `/admin/vendors/${vendorId}/verify-document/${documentId}`
export const VENDOR_ADD_NOTE_PATH = (vendorId: string) => `/admin/vendors/${vendorId}/notes`
