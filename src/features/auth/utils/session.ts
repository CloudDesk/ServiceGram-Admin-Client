import type { AppUser } from '../../../types/common.types'
import type {
  AdminSessionAdmin,
  AuthResponseData,
  AuthSession,
} from '../types/auth.types'

export function mapAdminToUser(admin: AdminSessionAdmin): AppUser {
  const role = admin.roleCodes[0]?.toLowerCase().replaceAll('_', '-') as AppUser['role']

  return {
    id: admin.userId,
    name: admin.fullName,
    email: admin.email,
    role: role ?? 'super-admin',
    permissions: admin.permissions,
  }
}

export function buildAuthSession(
  data: AuthResponseData,
  nowMs = Date.now(),
): AuthSession {
  return {
    accessToken: data.accessToken,
    accessTokenExpiresInSeconds: data.accessTokenExpiresInSeconds,
    accessTokenExpiresAt: new Date(
      nowMs + data.accessTokenExpiresInSeconds * 1000,
    ).toISOString(),
    refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    admin: data.admin,
    user: mapAdminToUser(data.admin),
  }
}

export function isAuthSessionUsable(
  session: AuthSession | null,
  nowMs = Date.now(),
) {
  if (!session?.accessToken || !session.admin?.adminId) {
    return false
  }

  const refreshTokenExpiresAt = Date.parse(session.refreshTokenExpiresAt)

  return Number.isFinite(refreshTokenExpiresAt) && refreshTokenExpiresAt > nowMs
}
