import { buildApiUrl } from '../../../config/api'
import { ADMIN_LOGIN_PATH } from '../../../config/apiPaths'
import { useAuthStore } from '../../../store/authStore'
import { apiClient } from '../../../services/apiClient'
import type { AppUser } from '../../../types/common.types'
import type {
  AuthSession,
  LoginErrorResponse,
  LoginPayload,
  LoginResponse,
} from '../types/auth.types'
import { LoginServiceError } from '../types/auth.types'

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

export const authService = {
  login,
}
