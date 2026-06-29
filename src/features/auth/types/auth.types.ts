import type { ApiErrorDetails } from '../../../types/api.types'
import type { AppUser } from '../../../types/common.types'

export interface LoginPayload {
  email: string
  password: string
  deviceId: string
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
  confirmPassword: string
}

export interface AuthResponseData {
  accessToken: string
  accessTokenExpiresInSeconds: number
  refreshTokenExpiresAt: string
  admin: AdminSessionAdmin
}

export interface LoginResponse {
  success: true
  code: 'LOGIN_SUCCESS'
  message: string
  data: AuthResponseData
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
    durationMs?: number
    apiVersion?: string
  }
}

export interface RefreshResponse {
  success: true
  code: 'TOKEN_REFRESHED'
  message: string
  data: AuthResponseData
  meta?: LoginResponse['meta']
}

export interface AdminSessionAdmin {
  adminId: string
  userId: string
  fullName: string
  email: string
  status: string
  roleCodes: string[]
  permissions: string[]
}

export interface LoginValidationErrorResponse {
  success: false
  code: 'VALIDATION_FAILED'
  message: string
  details: ApiErrorDetails & {
    reason: string
    action: string
    fieldErrors: {
      field: string
      code: string
      message: string
    }[]
  }
  meta?: LoginResponse['meta']
}

export interface LoginUnauthorizedErrorResponse {
  success: false
  code: 'AUTH_INVALID_CREDENTIALS'
  message: string
  details?: {
    reason?: string
  }
  meta?: LoginResponse['meta']
}

export type LoginErrorResponse =
  | LoginValidationErrorResponse
  | LoginUnauthorizedErrorResponse

export interface AuthActionResponse {
  success: true
  code: string
  message: string
  data: Record<string, unknown>
  meta?: LoginResponse['meta']
}

export interface AuthSession {
  accessToken: string
  accessTokenExpiresAt: string
  accessTokenExpiresInSeconds: number
  refreshTokenExpiresAt: string
  admin: AdminSessionAdmin
  user: AppUser
}

export type LoginSession = AuthSession

export class LoginServiceError extends Error {
  status: 400 | 401 | number
  response: LoginErrorResponse | null

  constructor(
    message: string,
    status: 400 | 401 | number,
    response: LoginErrorResponse | null,
  ) {
    super(message)
    this.name = 'LoginServiceError'
    this.status = status
    this.response = response
  }
}

export class AuthActionServiceError extends Error {
  status: number
  response: LoginErrorResponse | null

  constructor(
    message: string,
    status: number,
    response: LoginErrorResponse | null,
  ) {
    super(message)
    this.name = 'AuthActionServiceError'
    this.status = status
    this.response = response
  }
}
