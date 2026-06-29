import type {
  ApiErrorDetails,
  ApiErrorResponse,
} from '../../../types/api.types'

export interface AuditLogsQueryParams {
  page?: number
  limit?: number
  actorAdminId?: string
  actorUserId?: string
  moduleCode?: string
  actionCode?: string
  entityType?: string
  entityId?: string
  dateFrom?: string
  dateTo?: string
}

export interface AuditActor {
  actorType: string
  actorUserId: string | null
  actorAdminId: string | null
  adminName: string | null
  email: string | null
  userType: string | null
  userStatus: string | null
}

export interface AuditLog {
  auditLogId: string
  actor: AuditActor
  moduleCode: string
  actionCode: string
  entityType: string
  entityId: string | null
  oldValue: unknown
  newValue: unknown
  reason: string | null
  requestId: string
  ipAddress: string | null
  createdAt: string
}

export interface AuditPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AuditLogsResponse {
  success?: boolean
  code?: string
  message?: string
  data: AuditLog[]
  pagination: AuditPagination
}

export interface AuditApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}

export type AuditErrorResponse = ApiErrorResponse<AuditApiErrorDetails>
