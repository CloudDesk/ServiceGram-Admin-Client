import type { ApiErrorDetails } from '../../../types/api.types'

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

export interface VendorOptionalReasonPayload {
  reason?: string
}

export interface VendorRequiredReasonPayload {
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

export interface VendorListItem {
  vendorId: string
  publicVendorId: string
  shopName: string
  ownerName: string | null
  mobileNumber: string
  category: VendorCategory | null
  address: VendorAddress
  referralId: string | null
  onboardingStatus: VendorOnboardingStatus
  vendorStatus: VendorStatus
  reviewNotes: string | null
  rejectionReason: string | null
  documentSummary: VendorDocumentSummary | null
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
  status: string
  download?: VendorDocumentDownload
  rejectionReason: string | null
  verifiedByAdminId: string | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
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

export interface VendorDetail extends VendorListItem {
  documents: VendorDocument[]
  reviewTimeline: VendorReviewTimelineItem[]
}

export interface VendorVerifiedDocument {
  documentId: string
  documentType: string
  rejectionReason?: string | null
  status: string
}

export interface VendorNote {
  reviewEventId: string
  note: string
}

export interface VendorActionResult extends VendorListItem {
  verifiedDocument?: VendorVerifiedDocument
  rejectedDocument?: VendorVerifiedDocument
  addedNote?: VendorNote
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

export interface VendorListResponse extends VendorApiResponse<VendorListItem[]> {
  data: VendorListItem[]
  pagination: VendorPagination
}

export type VendorOnboardingQueueResponse = VendorListResponse

export type VendorDetailResponse = VendorApiResponse<VendorDetail>

export type VendorActionResponse = VendorApiResponse<VendorActionResult>

export interface VendorApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
