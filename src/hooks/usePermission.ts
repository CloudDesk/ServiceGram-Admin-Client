import type { PermissionKey } from '../types/common.types'
import { useAuthStore } from '../store/authStore'

export function usePermission(permission: PermissionKey) {
  return useAuthStore((state) => state.can(permission))
}
