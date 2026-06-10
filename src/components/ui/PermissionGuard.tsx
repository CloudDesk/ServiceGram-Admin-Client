import type { PropsWithChildren } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { routePaths } from '../../config/routes'
import { useAuthSession } from '../../features/auth/hooks/useAuthSession'

interface PermissionGuardProps extends PropsWithChildren {
  permission?: string
}

export function PermissionGuard({ permission }: PermissionGuardProps) {
  const { accessToken, isHydrated, permissions } = useAuthSession()

  if (!isHydrated) {
    return null
  }

  if (!accessToken) {
    return <Navigate replace to={routePaths.login} />
  }

  if (permission && !permissions.includes(permission)) {
    return <Navigate replace to={routePaths.accessDenied} />
  }

  return <Outlet />
}
