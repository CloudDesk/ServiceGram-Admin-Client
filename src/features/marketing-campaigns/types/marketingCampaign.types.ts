import type { ApiErrorDetails } from '../../../types/api.types'

export type MarketingCampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ARCHIVED'

export type MarketingCampaignPlacement = 'CUSTOMER_HOME_POPOVER'

export type MarketingCampaignCtaActionType =
  | 'NONE'
  | 'SERVICE_CATEGORY'
  | 'VENDOR'
  | 'ORDERS'
  | 'PROFILE'
  | 'SUPPORT'
  | 'EXTERNAL_LINK'

export type MarketingCampaignActiveOrderRule =
  | 'ANY'
  | 'NO_ACTIVE_BOOKINGS'
  | 'HAS_ACTIVE_BOOKINGS'

export interface MarketingCampaignTargeting {
  activeOrderRule?: MarketingCampaignActiveOrderRule
  newUserRule?: 'ANY' | 'NEW_USERS_ONLY' | 'RETURNING_USERS_ONLY'
  newUserWindowDays?: number
  cities?: string[]
  zoneIds?: string[]
  categoryIds?: string[]
  platforms?: ('IOS' | 'ANDROID' | 'WEB')[]
  customerStatuses?: string[]
  minAppVersion?: string
  maxAppVersion?: string
}

export interface MarketingCampaignFrequencyCap {
  maxImpressionsPerCustomer?: number
  cooldownHoursAfterDismiss?: number
  maxImpressionsPerDay?: number
}

export interface MarketingCampaign {
  campaignId: string
  campaignCode: string
  placement: MarketingCampaignPlacement
  status: MarketingCampaignStatus
  priority: number
  title: string
  headline: string
  body: string
  cta: {
    label: string
    actionType: MarketingCampaignCtaActionType
    actionPayload: Record<string, unknown>
  }
  image: {
    mediaAssetId: string | null
    url: string | null
    aspectRatio: string
    width: number | null
    height: number | null
    recommended: {
      aspectRatio: string
      minWidth: number
      minHeight: number
    }
  }
  theme: Record<string, unknown>
  targeting: MarketingCampaignTargeting
  frequencyCap: MarketingCampaignFrequencyCap
  schedule: {
    startsAt: string | null
    endsAt: string | null
  }
  lifecycle: {
    version: number
    publishedAt: string | null
    pausedAt: string | null
    archivedAt: string | null
    createdAt: string
    updatedAt: string
  }
  warnings: string[]
  blockingReasons: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
}

export interface MarketingCampaignsQueryParams {
  page?: number
  limit?: number
  status?: MarketingCampaignStatus[]
  placement?: MarketingCampaignPlacement[]
  search?: string
}

export interface MarketingCampaignPayload {
  campaignCode: string
  placement: MarketingCampaignPlacement
  priority: number
  title: string
  headline: string
  body: string
  ctaLabel: string
  ctaActionType: MarketingCampaignCtaActionType
  ctaActionPayload: Record<string, unknown>
  theme: Record<string, unknown>
  targeting: MarketingCampaignTargeting
  frequencyCap: MarketingCampaignFrequencyCap
  startsAt?: string | null
  endsAt?: string | null
  reason: string
}

export interface MarketingCampaignActionPayload {
  reason: string
}

export interface MarketingCampaignImageUploadIntentPayload {
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface MarketingCampaignImageConfirmPayload {
  mediaAssetId: string
  width: number
  height: number
  uploadedAt?: string
  reason: string
}

export interface MarketingCampaignImageUploadIntent {
  mediaAssetId: string
  uploadUrl: string | null
  headers: Record<string, string>
  providerStatus: string
  warnings: string[]
  acceptedMimeTypes: string[]
  maxSizeBytes: number
  recommendedDimensions: {
    aspectRatio: string
    minWidth: number
    minHeight: number
  }
}

export interface MarketingPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface MarketingCampaignSummary {
  total: number
  draft: number
  scheduled: number
  published: number
  paused: number
  archived: number
}

export interface MarketingCampaignApiResponse<TData> {
  code?: string
  message?: string
  data: TData
  pagination?: MarketingPagination
  summary?: MarketingCampaignSummary
}

export interface MarketingCampaignsResponse
  extends MarketingCampaignApiResponse<MarketingCampaign[]> {
  data: MarketingCampaign[]
  pagination: MarketingPagination
  summary: MarketingCampaignSummary
}

export type MarketingCampaignResponse =
  MarketingCampaignApiResponse<MarketingCampaign>

export interface MarketingCampaignApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
