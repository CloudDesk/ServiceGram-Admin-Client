import type { PropsWithChildren, ReactNode } from 'react'
import type { PermissionKey } from '../../../types/common.types'
import { usePermission } from '../../../hooks/usePermission'

interface RoleGuardProps extends PropsWithChildren {
  permission: PermissionKey
  fallback?: ReactNode
}

export function RoleGuard({ children, fallback = null, permission }: RoleGuardProps) {
  const allowed = usePermission(permission)
  return allowed ? children : fallback
}
