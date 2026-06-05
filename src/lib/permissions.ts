import type { AppUser, PermissionKey } from '../types/common.types'

export function hasPermission(
  user: AppUser | null,
  permission: PermissionKey,
) {
  if (!user) {
    return false
  }

  return user.permissions.includes(permission)
}
