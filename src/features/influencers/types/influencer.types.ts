import type { ApiErrorDetails } from '../../../types/api.types'

export type InfluencerStatus =
  | 'NOT_APPLIED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'

export type InfluencerActionKind =
  | 'APPROVE'
  | 'REJECT'
  | 'SUSPEND'
  | 'REACTIVATE'

export interface AdminInfluencersQueryParams {
  page?: number
  limit?: number
  status?: InfluencerStatus
  search?: string
  city?: string
  categoryId?: string
}

export interface InfluencerActionPayload {
  reason?: string
}

export interface InfluencerSummary {
  reelCount: number
  liveReelCount: number
  pendingReelCount: number
  attributedBookingCount: number
  confirmedCommissionPaise: number
  pendingCommissionPaise: number
  lastCommissionAt: string | null
  providerStatus: string
}

export interface AdminInfluencerProfile {
  influencerProfileId: string
  customerId: string
  userId: string
  publicInfluencerId: string
  displayName: string
  socialHandle: string | null
  bio: string | null
  preferredCategoryIds: string[]
  status: InfluencerStatus
  rejectionReason: string | null
  suspensionReason: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminInfluencerCustomer {
  customerId: string
  fullName: string | null
  mobileNumber: string | null
  email: string | null
  city: string | null
  status: string
  zone: {
    zoneId: string
    city: string
    zoneName: string
  } | null
}

export interface AdminInfluencerApplication {
  applicationId: string
  status: string
  city: string | null
  preferredCategoryIds: string[]
  socialHandle: string | null
  motivation: string | null
  reviewReason: string | null
  reviewedByAdminId: string | null
  reviewedAt: string | null
  createdAt: string
}

export interface AdminInfluencerReel {
  reelId: string
  publicReelId: string
  uploaderType: string
  taggedVendor: {
    vendorId: string
    publicVendorId: string
    shopName: string
    city: string | null
    zone: {
      zoneId: string
      city: string
      zoneName: string
    } | null
  }
  contentType: string
  caption: string | null
  priceIndicator: string | null
  category: {
    categoryId: string
    categoryCode: string
    name: string
  } | null
  media: {
    playbackUrl: string | null
    thumbnailUrl: string | null
    durationSeconds: number | null
    uploadStatus: string
  }
  moderation: {
    status: string
    rejectionReason: string | null
    approvedByAdminId: string | null
    approvedAt: string | null
  }
  publish: {
    isPublished: boolean
    publishedAt: string | null
  }
  missingFields: string[]
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminInfluencerCommission {
  commissionId: string
  orderId: string
  publicOrderId: string
  reelId: string
  publicReelId: string
  vendor: {
    vendorId: string
    publicVendorId: string
    shopName: string
  }
  grossAmountPaise: number
  commissionAmountPaise: number
  currency: string
  status: string
  confirmedAt: string | null
  createdAt: string
}

export interface AdminInfluencer {
  influencerProfileId: string
  customerId: string
  userId: string
  publicInfluencerId: string
  displayName: string
  socialHandle: string | null
  bio: string | null
  preferredCategoryIds: string[]
  status: InfluencerStatus
  rejectionReason: string | null
  suspensionReason: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
  customer: AdminInfluencerCustomer
  application: AdminInfluencerApplication | null
  summary: InfluencerSummary
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
}

export interface AdminInfluencerDetail extends AdminInfluencer {
  reels: AdminInfluencerReel[]
  commissions: AdminInfluencerCommission[]
}

export interface InfluencersPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type InfluencersSummary = Record<string, number>

export interface InfluencerApiResponse<TData> {
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

export interface AdminInfluencersListResponse
  extends InfluencerApiResponse<AdminInfluencer[]> {
  data: AdminInfluencer[]
  pagination: InfluencersPagination
  summary: InfluencersSummary
}

export type AdminInfluencerDetailResponse =
  InfluencerApiResponse<AdminInfluencerDetail>
export type AdminInfluencerActionResponse =
  InfluencerApiResponse<AdminInfluencer>

export interface InfluencerApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
