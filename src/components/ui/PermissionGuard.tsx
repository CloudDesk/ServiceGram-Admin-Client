import type { PropsWithChildren } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { routePaths } from '../../config/routes'
import { useAuthSession } from '../../features/auth/hooks/useAuthSession'
import { useAuthStore } from '../../store/authStore'

interface PermissionGuardProps extends PropsWithChildren {
  permission?: string
}

export function PermissionGuard({ permission }: PermissionGuardProps) {
  const { accessToken, isHydrated } = useAuthSession()
  const can = useAuthStore((state) => state.can)

  if (!isHydrated) {
    return null
  }

  if (!accessToken) {
    return <Navigate replace to={routePaths.login} />
  }

  if (permission && !can(permission)) {
    return <Navigate replace to={routePaths.accessDenied} />
  }

  return <Outlet />
}
