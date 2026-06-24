import { buildApiUrl } from '../../../config/api'
import {
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_RESET_PASSWORD_PATH,
} from '../../../config/apiPaths'
import { useAuthStore } from '../../../store/authStore'
import { apiClient } from '../../../services/apiClient'
import type { AppUser } from '../../../types/common.types'
import type {
  AuthSession,
  AuthActionResponse,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  LoginErrorResponse,
  LoginPayload,
  LoginResponse,
} from '../types/auth.types'
import { AuthActionServiceError, LoginServiceError } from '../types/auth.types'

function mapAdminToUser(admin: LoginResponse['data']['admin']): AppUser {
  const role = admin.roleCodes[0]?.toLowerCase().replaceAll('_', '-') as AppUser['role']

  return {
    id: admin.userId,
    name: admin.fullName,
    email: admin.email,
    role: role ?? 'super-admin',
    permissions: admin.permissions,
  }
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()

  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

async function login(payload: LoginPayload): Promise<AuthSession> {
  const response = await apiClient.request(buildApiUrl(ADMIN_LOGIN_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await readJsonResponse<LoginErrorResponse>(response)
    const message =
      errorBody?.message ??
      (response.status === 401
        ? 'Invalid email or password.'
        : 'Please correct the highlighted fields and try again.')

    throw new LoginServiceError(message, response.status, errorBody)
  }

  const body = (await response.json()) as LoginResponse
  const user = mapAdminToUser(body.data.admin)

  const accessTokenExpiresAt = new Date(
    Date.now() + body.data.accessTokenExpiresInSeconds * 1000,
  ).toISOString()

  const session: AuthSession = {
    accessToken: body.data.accessToken,
    accessTokenExpiresInSeconds: body.data.accessTokenExpiresInSeconds,
    accessTokenExpiresAt,
    refreshTokenExpiresAt: body.data.refreshTokenExpiresAt,
    admin: body.data.admin,
    user,
  }

  useAuthStore.getState().setSession(session)

  return session
}

async function requestPasswordReset(
  payload: ForgotPasswordPayload,
): Promise<AuthActionResponse> {
  const response = await apiClient.request(buildApiUrl(ADMIN_FORGOT_PASSWORD_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await readJsonResponse<LoginErrorResponse>(response)
    throw new AuthActionServiceError(
      errorBody?.message ?? 'We could not request a password reset.',
      response.status,
      errorBody,
    )
  }

  return (await response.json()) as AuthActionResponse
}

async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<AuthActionResponse> {
  const response = await apiClient.request(buildApiUrl(ADMIN_RESET_PASSWORD_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorBody = await readJsonResponse<LoginErrorResponse>(response)
    throw new AuthActionServiceError(
      errorBody?.message ?? 'We could not reset this password.',
      response.status,
      errorBody,
    )
  }

  return (await response.json()) as AuthActionResponse
}

export const authService = {
  login,
  requestPasswordReset,
  resetPassword,
}
