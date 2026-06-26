import type { ApiErrorDetails } from '../../../types/api.types'

export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL'
export type NotificationRecipientType = 'CUSTOMER' | 'VENDOR' | 'ADMIN'
export type NotificationEventStatus = 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED'
export type NotificationTargetType = 'USER' | 'SEGMENT'
export type NotificationUserStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE' | 'DELETED'
export type NotificationCustomerStatus = 'ACTIVE' | 'BLOCKED' | 'INCOMPLETE'
export type NotificationVendorStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
export type NotificationVendorOnboardingStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DOCUMENTS_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
export type NotificationAdminStatus = 'ACTIVE' | 'DISABLED'

export interface NotificationTemplatesQueryParams {
  channel?: NotificationChannel
  isActive?: boolean
  search?: string
}

export interface NotificationEventsQueryParams {
  page?: number
  limit?: number
  search?: string
  recipientType?: NotificationRecipientType[]
  channel?: NotificationChannel[]
  status?: NotificationEventStatus[]
  templateCode?: string[]
  recipientUserId?: string[]
  dateFrom?: string
  dateTo?: string
}

export interface UpdateNotificationTemplatePayload {
  titleTemplate?: string | null
  bodyTemplate?: string
  isActive?: boolean
  reason: string
}

export interface NotificationSegmentPayload {
  city?: string
  zoneId?: string
  categoryId?: string
  userStatus?: NotificationUserStatus
  customerStatus?: NotificationCustomerStatus
  vendorStatus?: NotificationVendorStatus
  vendorOnboardingStatus?: NotificationVendorOnboardingStatus
  adminStatus?: NotificationAdminStatus
  limit?: number
}

export interface SendNotificationPayload {
  targetType?: NotificationTargetType
  recipientUserId?: string
  recipientType: NotificationRecipientType
  channel: NotificationChannel
  templateCode: string
  variables?: Record<string, string>
  segment?: NotificationSegmentPayload
  dryRun?: boolean
  reason: string
}

export interface NotificationTemplate {
  templateId: string
  templateCode: string
  channel: NotificationChannel
  titleTemplate: string | null
  bodyTemplate: string
  isActive: boolean
  warnings: string[]
  availableActions: string[]
  createdAt: string
  updatedAt: string
}

export interface NotificationRecipientSummary {
  userId: string
  userType: string
  mobileNumber: string | null
  email: string | null
  status: string
}

export interface NotificationDeliveryRetrySummary {
  attemptNumber: number
  maxAttempts: number
  backoffSeconds: number
  nextRetryAt: string | null
  scheduledAt: string | null
  exhausted: boolean
  lastProviderStatus: string
  lastFailureReason: string | null
}

export interface NotificationEvent {
  eventId: string
  recipientUserId: string | null
  recipientType: NotificationRecipientType
  recipient: NotificationRecipientSummary | null
  channel: NotificationChannel
  templateCode: string
  title: string | null
  body: string
  status: NotificationEventStatus
  providerMessageId: string | null
  failureReason: string | null
  deliveryRetry: NotificationDeliveryRetrySummary | null
  sentAt: string | null
  readAt: string | null
  warnings: string[]
  availableActions: string[]
  createdAt: string
  updatedAt: string
}

export interface NotificationPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface NotificationApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
  summary?: unknown
  pagination?: NotificationPagination
}

export interface NotificationTemplatesResponse
  extends NotificationApiResponse<NotificationTemplate[]> {
  data: NotificationTemplate[]
  summary: {
    total: number
    active: number
    inactive: number
    byChannel: Record<string, number>
  }
}

export interface NotificationEventsResponse
  extends NotificationApiResponse<NotificationEvent[]> {
  data: NotificationEvent[]
  pagination: NotificationPagination
  summary: {
    total: number
    byStatus: Record<string, number>
    byChannel: Record<string, number>
  }
}

export type NotificationEventDetailResponse =
  NotificationApiResponse<NotificationEvent>

export type UpdateNotificationTemplateResponse =
  NotificationApiResponse<NotificationTemplate>

export interface NotificationDispatchSummary {
  requested: boolean
  providerStatus: string
  queued: boolean
  warnings: string[]
}

export interface SegmentNotificationResult {
  targetType: 'SEGMENT'
  dryRun: boolean
  recipientType: NotificationRecipientType
  channel: NotificationChannel
  templateCode: string
  segment: NotificationSegmentPayload
  matchedCount: number
  queuedCount: number
  skippedCount: number
  recipientPreview: NotificationRecipientSummary[]
  events: NotificationEvent[]
  dispatch: NotificationDispatchSummary
}

export interface UserNotificationResult extends NotificationEvent {
  targetType: 'USER'
  dispatch: NotificationDispatchSummary
}

export type SendNotificationData = SegmentNotificationResult | UserNotificationResult

export type SendNotificationResponse = NotificationApiResponse<SendNotificationData>

export interface NotificationApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
