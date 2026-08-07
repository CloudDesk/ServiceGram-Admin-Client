import type { ApiErrorDetails } from '../../../types/api.types'
import type { AdminOrdersListResponse } from '../../orders/types/order.types'
import type { AdminVendorPayoutsListResponse } from '../../payouts/types/payout.types'
import type { AdminReelsListResponse } from '../../reels/types/reel.types'

export interface VendorListQueryParams {
  page?: number
  limit?: number
  search?: string
  city?: string
  categoryId?: string
  zoneId?: string
  onboardingStatus?: VendorOnboardingStatus
  vendorStatus?: VendorStatus
}

export type VendorOnboardingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DOCUMENTS_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type VendorStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'

export type VendorServicePriceType =
  | 'FIXED'
  | 'STARTING_FROM'
  | 'RANGE'
  | 'INSPECTION_REQUIRED'

export type VendorServicePricingUnit =
  | 'KG'
  | 'PIECE'
  | 'BAG'
  | 'LOT'
  | 'SQFT'
  | 'PAIR'
  | 'HOUR'
  | 'VISIT'
  | 'DEVICE'

export interface VendorOptionalReasonPayload {
  reason?: string
}

export interface VendorRequiredReasonPayload {
  reason: string
}

export type VendorBrandLogoMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'

export interface CreateVendorBrandLogoUploadIntentPayload {
  fileName: string
  mimeType: VendorBrandLogoMimeType
  sizeBytes: number
}

export interface ConfirmVendorBrandLogoUploadPayload {
  mediaAssetId: string
  uploadedAt?: string
  checksum?: string
  reason: string
}

export interface RemoveVendorBrandLogoPayload {
  reason: string
}

export interface VendorProfileUpdatePayload {
  shopName?: string
  ownerName?: string | null
  mobileNumber?: string
  categoryId?: string
  addressLine1?: string
  addressLine2?: string | null
  city?: string
  zoneId?: string | null
  pincode?: string | null
  latitude?: number | null
  longitude?: number | null
  referralId?: string | null
  reason: string
}

export interface VendorServicePayload {
  categoryId?: string
  serviceTypeId?: string | null
  serviceName?: string
  description?: string | null
  basePricePaise?: number
  priceType?: VendorServicePriceType
  minPricePaise?: number | null
  maxPricePaise?: number | null
  isActive?: boolean
  reason: string
}

export interface VendorServiceCatalogItemPayload {
  itemCode?: string
  itemName: string
  pricingUnit: VendorServicePricingUnit
  unitPricePaise: number
  minQuantity: number
  maxQuantity: number
  isPopular: boolean
  isActive: boolean
  displayOrder: number
  metadata?: Record<string, unknown>
}

export interface VendorServiceCatalogPayload {
  items: VendorServiceCatalogItemPayload[]
  reason: string
}

export interface VendorRequestDocumentsPayload {
  reason: string
  requestedDocumentTypes?: string[]
}

export interface VendorDocumentVerificationPayload {
  reason?: string
}

export interface VendorNotePayload {
  note: string
}

export type VendorBankAccountStatus =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'DISABLED'

export type VendorBankAccountType = 'SAVINGS' | 'CURRENT'

export interface VendorCategory {
  categoryId: string
  categoryCode: string
  name: string
}

export interface VendorZone {
  zoneId: string
  city: string
  zoneName: string
}

export interface VendorAddress {
  addressLine1: string
  addressLine2: string | null
  city: string
  zone: VendorZone | null
  pincode: string | null
  latitude: string | null
  longitude: string | null
}

export interface VendorDocumentSummary {
  total: number
  pending: number
  verified: number
  rejected: number
  expired: number
}

export interface VendorDocumentDownload {
  downloadUrl: string | null
  expiresAt: string | null
  providerStatus: string
  warnings: string[]
}

export interface VendorBrandLogo {
  mediaAssetId: string
  url: string | null
  downloadUrl: string | null
  expiresAt: string | null
  fileName: string
  mimeType: string
  sizeBytes: number | null
  status: string
  accessLevel: string
  providerStatus: string
  warnings: string[]
  updatedAt: string
}

export interface VendorContactPerson {
  name: string
  mobileNumber: string
}

export interface VendorListItem {
  vendorId: string
  publicVendorId: string
  shopName: string
  ownerName: string | null
  mobileNumber: string
  businessEmail: string | null
  alternativeMobileNumber: string | null
  contactPersons: VendorContactPerson[]
  brandLogo: VendorBrandLogo | null
  category: VendorCategory | null
  address: VendorAddress
  referralId: string | null
  onboardingStatus: VendorOnboardingStatus
  vendorStatus: VendorStatus
  reviewNotes: string | null
  rejectionReason: string | null
  documentSummary: VendorDocumentSummary | null
  bankAccountSummary: VendorBankAccountSummary | null
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  verifiedAt: string | null
  suspendedAt: string | null
  suspensionReason: string | null
  createdAt: string
  updatedAt: string
}

export interface VendorDocument {
  documentId: string
  documentType: string
  mediaAssetId: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  mediaStatus: VendorDocumentMediaStatus | null
  status: string
  download?: VendorDocumentDownload
  rejectionReason: string | null
  verifiedByAdminId: string | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type VendorDocumentStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'

export type VendorDocumentMediaStatus =
  | 'UPLOAD_REQUESTED'
  | 'AVAILABLE'
  | 'FAILED'
  | 'DELETED'

export type VendorDocumentType =
  | 'BUSINESS_REGISTRATION'
  | 'ADDRESS_PROOF'
  | 'OWNER_ID_PROOF'
  | 'BANK_PROOF'
  | 'SHOP_PHOTO'
  | 'GST_CERTIFICATE'

export interface VendorDocumentListQueryParams {
  page?: number
  limit?: number
  search?: string
  city?: string
  categoryId?: string
  documentStatus?: VendorDocumentStatus
  documentType?: VendorDocumentType
  mediaStatus?: VendorDocumentMediaStatus
  onboardingStatus?: VendorOnboardingStatus
  vendorStatus?: VendorStatus
}

export interface VendorDocumentListMedia {
  mediaAssetId: string
  fileName: string
  mimeType: string
  sizeBytes: number | null
  status: VendorDocumentMediaStatus
  accessLevel: string
  updatedAt: string
}

export interface VendorDocumentListVendor {
  vendorId: string
  publicVendorId: string
  shopName: string
  ownerName: string | null
  mobileNumber: string
  businessEmail: string | null
  city: string
  category: VendorCategory | null
  zone: VendorZone | null
  onboardingStatus: VendorOnboardingStatus
  vendorStatus: VendorStatus
}

export interface VendorDocumentListItem {
  documentId: string
  documentType: VendorDocumentType
  mediaAssetId: string | null
  status: VendorDocumentStatus
  rejectionReason: string | null
  verifiedByAdminId: string | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  media: VendorDocumentListMedia | null
  vendor: VendorDocumentListVendor
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
}

export interface VendorReviewTimelineItem {
  reviewEventId: string
  adminId: string | null
  actionCode: string
  fromOnboardingStatus: VendorOnboardingStatus | null
  toOnboardingStatus: VendorOnboardingStatus | null
  fromVendorStatus: VendorStatus | null
  toVendorStatus: VendorStatus | null
  reason: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface VendorBankAccount {
  bankAccountId: string
  vendorId: string
  accountHolderName: string
  bankName: string
  accountType: VendorBankAccountType
  accountNumberMasked: string
  ifscCode: string
  upiId: string | null
  status: VendorBankAccountStatus
  isPrimary: boolean
  rejectionReason: string | null
  verifiedByAdminId: string | null
  verifiedAt: string | null
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface VendorBankAccountSummary {
  total: number
  verified: number
  pending: number
  rejected: number
  disabled: number
  hasPrimary: boolean
  primaryStatus: VendorBankAccountStatus | null
  primaryBankName: string | null
  primaryAccountNumberMasked: string | null
  payoutReady: boolean
  warnings: string[]
  nextRecommendedAction: string | null
}

export interface VendorServiceType {
  serviceTypeId: string
  serviceTypeCode: string
  name: string
}

export interface VendorServiceCatalogItem {
  catalogItemId?: string
  itemCode?: string
  itemName: string
  pricingUnit: VendorServicePricingUnit
  unitPricePaise: number
  minQuantity: number
  maxQuantity: number
  isPopular: boolean
  isActive: boolean
  displayOrder: number
  metadata?: Record<string, unknown>
}

export interface VendorServiceCatalog {
  items: VendorServiceCatalogItem[]
  isConfigured: boolean
  configuredItemCount: number
  activeItemCount: number
  [key: string]: unknown
}

export interface VendorServicePricing {
  basePricePaise: number
  priceType: VendorServicePriceType
  minPricePaise: number | null
  maxPricePaise: number | null
  currency: string
  catalog: VendorServiceCatalog
  suggestedCatalog?: VendorServiceCatalog
}

export interface VendorServiceRecord {
  vendorServiceId: string
  serviceName: string
  description: string | null
  category: VendorCategory
  serviceType: VendorServiceType | null
  pricing: VendorServicePricing
  isActive: boolean
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface VendorServicesSummary {
  total: number
  active: number
  inactive: number
  configuredCatalogs: number
  missingCatalogs: number
  availableActions: string[]
}

export interface VendorDetail extends VendorListItem {
  documents: VendorDocument[]
  bankAccounts: VendorBankAccount[]
  bankAccountSummary: VendorBankAccountSummary
  reviewTimeline: VendorReviewTimelineItem[]
}

export interface VendorVerifiedDocument {
  documentId: string
  documentType: string
  mediaAssetId?: string | null
  rejectionReason?: string | null
  status: string
  verifiedByAdminId?: string | null
  verifiedAt?: string | null
  expiresAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface VendorNote {
  reviewEventId: string
  note: string
}

export interface VendorActionResult {
  vendorId: string
  publicVendorId?: string
  shopName?: string
  onboardingStatus?: VendorOnboardingStatus
  vendorStatus?: VendorStatus
  reviewNotes?: string | null
  rejectionReason?: string | null
  documentSummary?: VendorDocumentSummary | null
  warnings?: string[]
  availableActions?: string[]
  nextRecommendedAction?: string | null
  verifiedAt?: string | null
  suspendedAt?: string | null
  suspensionReason?: string | null
  updatedAt?: string
  notificationQueued?: boolean
  notificationDispatch?: unknown
  verifiedDocument?: VendorVerifiedDocument
  rejectedDocument?: VendorVerifiedDocument
  bankAccount?: VendorBankAccount
  addedNote?: VendorNote
}

export interface VendorBrandLogoUploadIntentResult {
  mediaAssetId: string
  fileName: string
  mimeType: VendorBrandLogoMimeType
  sizeBytes: number
  status: string
  uploadUrl: string | null
  expiresAt: string | null
  headers: Record<string, string>
  providerStatus: string
  warnings: string[]
  acceptedMimeTypes: VendorBrandLogoMimeType[]
  maxSizeBytes: number
  recommendedDimensions: {
    aspectRatio: string
    minWidth: number
    minHeight: number
  }
}

export interface VendorPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface VendorApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
    durationMs?: number
    apiVersion?: string
  }
}

export interface VendorListResponse extends VendorApiResponse<
  VendorListItem[]
> {
  data: VendorListItem[]
  pagination: VendorPagination
}

export interface VendorDocumentListResponse extends VendorApiResponse<
  VendorDocumentListItem[]
> {
  data: VendorDocumentListItem[]
  pagination: VendorPagination
}

export type VendorOnboardingQueueResponse = VendorListResponse

export type VendorDetailResponse = VendorApiResponse<VendorDetail>

export type VendorActionResponse = VendorApiResponse<VendorActionResult>

export interface VendorDocumentDownloadTarget {
  documentId: string
  documentType: string
  mediaAssetId: string | null
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  mediaStatus: VendorDocumentMediaStatus | null
  download: VendorDocumentDownload
}

export type VendorDocumentDownloadTargetResponse =
  VendorApiResponse<VendorDocumentDownloadTarget>

export type VendorBrandLogoUploadIntentResponse =
  VendorApiResponse<VendorBrandLogoUploadIntentResult>

export interface VendorServicesResponse extends VendorApiResponse<{
  summary: VendorServicesSummary
  services: VendorServiceRecord[]
}> {
  data: {
    summary: VendorServicesSummary
    services: VendorServiceRecord[]
  }
}

export type VendorOverviewSectionName =
  | 'services'
  | 'reels'
  | 'orders'
  | 'payouts'

export interface VendorOverviewOmittedSection {
  section: VendorOverviewSectionName
  reason: 'NOT_REQUESTED' | 'MISSING_PERMISSION' | 'SERVICE_UNAVAILABLE'
}

export interface VendorOverview {
  vendor: VendorDetail
  sections: {
    services: VendorServicesResponse['data'] | null
    reels:
      | Pick<AdminReelsListResponse, 'data' | 'pagination' | 'summary'>
      | null
    orders:
      | Pick<AdminOrdersListResponse, 'data' | 'pagination' | 'summary'>
      | null
    payouts:
      | Pick<AdminVendorPayoutsListResponse, 'data' | 'pagination' | 'summary'>
      | null
  }
  omittedSections: VendorOverviewOmittedSection[]
  refreshedAt: string
}

export type VendorOverviewResponse = VendorApiResponse<VendorOverview>

export type VendorServiceActionResponse = VendorApiResponse<VendorServiceRecord>

export interface VendorApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
