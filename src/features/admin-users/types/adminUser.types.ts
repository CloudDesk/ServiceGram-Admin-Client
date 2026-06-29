import type {
  ApiErrorDetails,
  ApiErrorResponse,
} from '../../../types/api.types'

export type AdminUserStatus = 'ACTIVE' | 'DISABLED'

export interface AdminUsersQueryParams {
  page?: number
  limit?: number
  status?: AdminUserStatus
  roleId?: string
  search?: string
}

export interface AdminUserRole {
  roleId: string
  roleCode: string
  roleName: string
  isSystem: boolean
  isActive: boolean
}

export interface AdminUserScope {
  scopeType: string
  scopeId?: string | null
  scopeRefId?: string | null
}

export interface AdminUser {
  adminId: string
  userId: string
  email: string | null
  fullName: string
  status: AdminUserStatus
  userStatus: string
  permissionVersion: number
  lastLoginAt: string | null
  role: AdminUserRole | null
  createdAt: string
  updatedAt: string
}

export interface CurrentAdminUser extends AdminUser {
  roleCodes: string[]
  permissions: string[]
  scopes: AdminUserScope[]
  session?: {
    authenticatedAt: string | null
    expiresAt: string | null
    remainingSeconds: number
    recentAuthExpiresAt: string | null
    recentAuthRemainingSeconds: number
  }
}

export interface CreateAdminUserPayload {
  email: string
  fullName: string
  password: string
  roleId: string
  status?: AdminUserStatus
}

export interface UpdateAdminUserPayload {
  fullName?: string
  roleId?: string
  status?: AdminUserStatus
  forceLogout?: boolean
  reason?: string
}

export interface ForceLogoutAdminUserResponseData {
  revokedSessionCount: number
}

export interface AdminUsersPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AdminUserApiResponse<TData> {
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

export interface AdminUsersListResponse
  extends AdminUserApiResponse<AdminUser[]> {
  data: AdminUser[]
  pagination: AdminUsersPagination
}

export type AdminUserDetailResponse = AdminUserApiResponse<AdminUser>
export type CurrentAdminUserResponse = AdminUserApiResponse<CurrentAdminUser>
export type AdminUserActionResponse = AdminUserApiResponse<AdminUser>
export type ForceLogoutAdminUserResponse =
  AdminUserApiResponse<ForceLogoutAdminUserResponseData>

export interface AdminUserApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}

export type AdminUserErrorResponse = ApiErrorResponse<AdminUserApiErrorDetails>

export class AdminUserServiceError extends Error {
  status: number
  response: AdminUserErrorResponse | null

  constructor(
    message: string,
    status: number,
    response: AdminUserErrorResponse | null,
  ) {
    super(message)
    this.name = 'AdminUserServiceError'
    this.status = status
    this.response = response
  }
}
