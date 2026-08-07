import type { ApiErrorDetails } from '../../../types/api.types'

export type ContentPageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ContentPageType =
  | 'LEGAL'
  | 'FAQ'
  | 'SUPPORT'
  | 'ONBOARDING'
  | 'POLICY'
  | 'MARKETING'
export type ContentFormat = 'MARKDOWN' | 'HTML' | 'PLAIN_TEXT'

export interface ContentPagesQueryParams {
  page?: number
  limit?: number
  status?: ContentPageStatus[]
  pageType?: ContentPageType[]
  contentFormat?: ContentFormat[]
  isVisibleToCustomers?: boolean
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface CreateContentPagePayload {
  slug: string
  title: string
  pageType: ContentPageType
  contentFormat?: ContentFormat
  body: string
  excerpt?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  isVisibleToCustomers?: boolean
  metadata?: Record<string, unknown>
  reason: string
}

export interface UpdateContentPagePayload
  extends Partial<Omit<CreateContentPagePayload, 'reason'>> {
  reason: string
}

export interface ContentPageActionPayload {
  reason: string
}

export interface ContentPage {
  pageId: string
  slug: string
  title: string
  pageType: ContentPageType
  contentFormat: ContentFormat
  status: ContentPageStatus
  version: number
  publishedVersion: number | null
  isVisibleToCustomers: boolean
  excerpt: string | null
  bodyPreview: string
  body?: string
  seo: {
    title: string | null
    description: string | null
  }
  metadata: Record<string, unknown>
  lifecycle: {
    createdByAdminId: string | null
    updatedByAdminId: string | null
    publishedByAdminId: string | null
    archivedByAdminId: string | null
    publishedAt: string | null
    archivedAt: string | null
    createdAt: string
    updatedAt: string
  }
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  blockingReasons: string[]
}

export interface ContentPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ContentSummary {
  total: number
  draft: number
  published: number
  archived: number
}

export interface ContentApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
  pagination?: ContentPagination
  summary?: ContentSummary
}

export interface ContentPagesResponse extends ContentApiResponse<ContentPage[]> {
  data: ContentPage[]
  pagination: ContentPagination
  summary: ContentSummary
}

export type ContentPageResponse = ContentApiResponse<ContentPage>

export interface ContentApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}

export type CustomerHomeCarouselSlideStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'ARCHIVED'

export type CustomerHomeCtaActionType =
  | 'NONE'
  | 'SERVICE_CATEGORY'
  | 'VENDOR'
  | 'ORDERS'
  | 'PROFILE'
  | 'SUPPORT'
  | 'EXTERNAL_LINK'

export interface CustomerHomeSection {
  sectionCode: 'HERO_CAROUSEL'
  title: string
  isEnabled: boolean
  displayOrder: number
  autoplayIntervalMs: number
  config: Record<string, unknown>
  lifecycle: {
    updatedByAdminId: string | null
    createdAt: string
    updatedAt: string
  }
}

export interface CustomerHomeCarouselSlide {
  slideId: string
  slideKey: string
  status: CustomerHomeCarouselSlideStatus
  displayOrder: number
  label: string
  headline: string
  description: string
  cta: {
    label: string
    actionType: CustomerHomeCtaActionType
    actionPayload: Record<string, unknown>
  }
  category: {
    categoryId: string
    categoryCode: string
    name: string
    description: string | null
    iconAssetId: string | null
    isActive: boolean
    displayOrder: number
  } | null
  image: {
    mediaAssetId: string | null
    url: string | null
    width: number | null
    height: number | null
    recommended: {
      aspectRatio: string
      minWidth: number
      minHeight: number
    }
  }
  visual: Record<string, unknown>
  targeting: Record<string, unknown>
  schedule: {
    startsAt: string | null
    endsAt: string | null
  }
  lifecycle: {
    version: number
    createdByAdminId: string | null
    updatedByAdminId: string | null
    publishedByAdminId: string | null
    pausedByAdminId: string | null
    archivedByAdminId: string | null
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

export interface CustomerHomeCarouselSummary {
  total: number
  draft: number
  scheduled: number
  published: number
  paused: number
  archived: number
}

export interface CustomerAppHomePayload {
  section: CustomerHomeSection
  carousel: {
    slides: CustomerHomeCarouselSlide[]
    summary: CustomerHomeCarouselSummary
  }
}

export interface CustomerAppHomeResponse
  extends ContentApiResponse<CustomerAppHomePayload> {
  data: CustomerAppHomePayload
}

export interface CustomerHomeCarouselSlidesQueryParams {
  page?: number
  limit?: number
  status?: CustomerHomeCarouselSlideStatus[]
  categoryId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface CustomerHomeCarouselSlidesResponse
  extends ContentApiResponse<CustomerHomeCarouselSlide[]> {
  data: CustomerHomeCarouselSlide[]
  pagination: ContentPagination
  summary: CustomerHomeCarouselSummary
}

export type CustomerHomeCarouselSlideResponse =
  ContentApiResponse<CustomerHomeCarouselSlide>

export interface UpdateCustomerHomeSectionPayload {
  isEnabled?: boolean
  autoplayIntervalMs?: number
  displayOrder?: number
  reason: string
}

export interface CreateCustomerHomeCarouselSlidePayload {
  slideKey?: string
  label: string
  headline: string
  description: string
  ctaLabel: string
  ctaActionType?: CustomerHomeCtaActionType
  ctaActionPayload?: Record<string, unknown>
  categoryId?: string | null
  displayOrder?: number
  visual?: Record<string, unknown>
  targeting?: Record<string, unknown>
  startsAt?: string | null
  endsAt?: string | null
  reason: string
}

export interface UpdateCustomerHomeCarouselSlidePayload
  extends Partial<Omit<CreateCustomerHomeCarouselSlidePayload, 'reason'>> {
  reason: string
}

export interface CustomerHomeCarouselSlideActionPayload {
  reason: string
}

export interface CustomerHomeCarouselImageUploadIntentPayload {
  fileName: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  sizeBytes: number
  metadata?: Record<string, unknown>
}

export interface CustomerHomeCarouselImageUploadIntent {
  mediaAssetId: string
  ownerType: string
  ownerId: string
  purpose: 'CUSTOMER_HOME_CAROUSEL_IMAGE'
  storageProvider: string
  bucketName: string
  objectKey: string
  fileName: string
  mimeType: string
  sizeBytes: number
  status: string
  accessLevel: 'PUBLIC_READ'
  uploadUrl: string | null
  expiresAt: string | null
  headers: Record<string, string>
  providerStatus: string
  warnings: string[]
  createdAt: string
  acceptedMimeTypes: string[]
  maxSizeBytes: number
  recommendedDimensions: {
    aspectRatio: string
    minWidth: number
    minHeight: number
  }
}

export type CustomerHomeCarouselImageUploadIntentResponse =
  ContentApiResponse<CustomerHomeCarouselImageUploadIntent>

export interface ConfirmCustomerHomeCarouselImageUploadPayload {
  mediaAssetId: string
  checksum?: string
  uploadedAt?: string
  width: number
  height: number
  reason: string
}
