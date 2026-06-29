import { buildApiUrl } from '../../../config/api'
import {
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_LOGOUT_PATH,
  ADMIN_RESET_PASSWORD_PATH,
} from '../../../config/apiPaths'
import { useAuthStore } from '../../../store/authStore'
import { apiClient } from '../../../services/apiClient'
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
import { buildAuthSession } from '../utils/session'

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
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
  const session = buildAuthSession(body.data)

  useAuthStore.getState().setSession(session)

  return session
}

async function logout(): Promise<void> {
  try {
    await apiClient.request(buildApiUrl(ADMIN_LOGOUT_PATH), {
      method: 'POST',
      credentials: 'include',
    })
  } finally {
    useAuthStore.getState().clearSession()
  }
}

async function requestPasswordReset(
  payload: ForgotPasswordPayload,
): Promise<AuthActionResponse> {
  const response = await apiClient.request(buildApiUrl(ADMIN_FORGOT_PASSWORD_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
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
    credentials: 'include',
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
  logout,
  requestPasswordReset,
  resetPassword,
}
