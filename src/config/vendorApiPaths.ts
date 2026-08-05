export const VENDOR_LIST_PATH = '/admin/vendors'
export const VENDOR_DOCUMENTS_PATH = '/admin/vendor-documents'
export const VENDOR_ONBOARDING_QUEUE_PATH = '/admin/vendors/onboarding-queue'
export const VENDOR_DETAIL_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}`
export const VENDOR_OVERVIEW_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/overview`
export const VENDOR_UPDATE_PROFILE_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/profile`
export const VENDOR_BRAND_LOGO_UPLOAD_INTENT_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/brand-logo/upload-intent`
export const VENDOR_BRAND_LOGO_CONFIRM_UPLOAD_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/brand-logo/confirm-upload`
export const VENDOR_BRAND_LOGO_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/brand-logo`
export const VENDOR_SERVICES_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/services`
export const VENDOR_SERVICE_DETAIL_PATH = (
  vendorId: string,
  serviceId: string,
) => `/admin/vendors/${vendorId}/services/${serviceId}`
export const VENDOR_SERVICE_DISABLE_PATH = (
  vendorId: string,
  serviceId: string,
) => `/admin/vendors/${vendorId}/services/${serviceId}/disable`
export const VENDOR_SERVICE_CATALOG_PATH = (
  vendorId: string,
  serviceId: string,
) => `/admin/vendors/${vendorId}/services/${serviceId}/catalog`
export const VENDOR_APPROVE_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/approve`
export const VENDOR_REJECT_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/reject`
export const VENDOR_REQUEST_DOCUMENTS_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/request-documents`
export const VENDOR_SUSPEND_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/suspend`
export const VENDOR_REACTIVATE_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/reactivate`
export const VENDOR_VERIFY_DOCUMENT_PATH = (
  vendorId: string,
  documentId: string,
) => `/admin/vendors/${vendorId}/verify-document/${documentId}`
export const VENDOR_REJECT_DOCUMENT_PATH = (
  vendorId: string,
  documentId: string,
) => `/admin/vendors/${vendorId}/reject-document/${documentId}`
export const VENDOR_DOCUMENT_DOWNLOAD_TARGET_PATH = (
  vendorId: string,
  documentId: string,
) => `/admin/vendors/${vendorId}/documents/${documentId}/download-target`
export const VENDOR_VERIFY_BANK_ACCOUNT_PATH = (
  vendorId: string,
  bankAccountId: string,
) => `/admin/vendors/${vendorId}/bank-accounts/${bankAccountId}/verify`
export const VENDOR_REJECT_BANK_ACCOUNT_PATH = (
  vendorId: string,
  bankAccountId: string,
) => `/admin/vendors/${vendorId}/bank-accounts/${bankAccountId}/reject`
export const VENDOR_ADD_NOTE_PATH = (vendorId: string) =>
  `/admin/vendors/${vendorId}/notes`
