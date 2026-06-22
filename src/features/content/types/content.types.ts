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
  status?: ContentPageStatus
  pageType?: ContentPageType
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
