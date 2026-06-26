import type { ApiErrorDetails } from '../../../types/api.types'

export type ReelContentType = 'BEFORE_AFTER' | 'SERVICE_DEMO' | 'NEW_OFFER' | 'INTRODUCTION'
export type ReelUploadStatus =
  | 'UPLOAD_REQUESTED'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'
  | 'DELETED'
export type ReelModerationStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EDIT_REQUESTED'
  | 'PAUSED'
  | 'REMOVED'

type AdminReelFilterValue<T extends string> = T | T[]
type AdminReelIdFilterValue = string | string[]

export interface AdminReelsQueryParams {
  page?: number
  limit?: number
  search?: string
  city?: string
  categoryId?: AdminReelIdFilterValue
  zoneId?: string
  vendorId?: AdminReelIdFilterValue
  contentType?: AdminReelFilterValue<ReelContentType>
  uploadStatus?: AdminReelFilterValue<ReelUploadStatus>
  moderationStatus?: AdminReelFilterValue<ReelModerationStatus>
}

export interface ReelOptionalReasonPayload {
  reason?: string
}

export interface ReelRequiredReasonPayload {
  reason: string
}

export interface ReelDeletePayload extends ReelRequiredReasonPayload {
  hardDelete: boolean
}

export interface AdminReelZone {
  zoneId: string
  city: string
  zoneName: string
}

export interface AdminReelVendor {
  vendorId: string
  publicVendorId: string
  shopName: string
  ownerName: string | null
  mobileNumber: string
  vendorStatus: string
  onboardingStatus: string
  city: string
  zone: AdminReelZone | null
}

export interface AdminReelCategory {
  categoryId: string
  categoryCode: string
  name: string
  isActive: boolean
}

export interface AdminReelMedia {
  cloudflareVideoUid: string | null
  playbackUrl: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
  uploadStatus: ReelUploadStatus
}

export interface AdminReelModeration {
  status: ReelModerationStatus
  rejectionReason: string | null
  approvedByAdminId: string | null
  approvedAt: string | null
}

export interface AdminReelPublish {
  isPublished: boolean
  publishedAt: string | null
  customerVisibility: 'VISIBLE' | 'HIDDEN'
}

export interface AdminReelChecklistItem {
  code: string
  label: string
  passed: boolean
  missingFields?: string[]
}

export interface AdminReel {
  reelId: string
  publicReelId: string
  contentType: ReelContentType
  caption: string | null
  priceIndicator: string | null
  vendor: AdminReelVendor
  category: AdminReelCategory | null
  media: AdminReelMedia
  moderation: AdminReelModeration
  publish: AdminReelPublish
  reviewChecklist: AdminReelChecklistItem[]
  missingFields: string[]
  blockingReasons: string[]
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminReelDeleteResult {
  reelId: string
  publicReelId: string
  deleted: boolean
  deleteMode: 'SOFT' | 'HARD'
  hardDeleted: boolean
  deletedAt: string | null
  media: {
    uploadStatus: ReelUploadStatus
    cloudflareVideoUid?: string | null
  }
  moderation: {
    status: ReelModerationStatus
    rejectionReason: string | null
  }
  publish: AdminReelPublish
  storage?: {
    cloudflareVideoUid?: string | null
    deleted: boolean
    providerStatus: string
    warnings: string[]
  }
  database?: {
    reelDeleted: boolean
    mediaAssetsDeleted: number
    webhookEventsDeleted: number
  }
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
}

export interface AdminReelsSummary {
  total: number
  live: number
  needsAttention: number
  byUploadStatus: Record<string, number>
  byModerationStatus: Record<string, number>
}

export interface AdminReelsPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminReelApiResponse<TData> {
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

export interface AdminReelsListResponse extends AdminReelApiResponse<AdminReel[]> {
  data: AdminReel[]
  pagination: AdminReelsPagination
  summary: AdminReelsSummary
}

export type AdminReelDetailResponse = AdminReelApiResponse<AdminReel>
export type AdminReelActionResponse = AdminReelApiResponse<AdminReel>
export type AdminReelDeleteResponse = AdminReelApiResponse<AdminReelDeleteResult>

export interface AdminReelApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
