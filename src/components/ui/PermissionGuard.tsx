import type { PropsWithChildren } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { GlobalLoadingBar } from '../feedback/GlobalLoadingBar'
import { routePaths } from '../../config/routes'
import { useAuthSession } from '../../features/auth/hooks/useAuthSession'
import { safeAuthRedirectPath } from '../../features/auth/utils/redirect'
import { buildAccessDeniedPath } from '../../routes/adminRouteRecovery'
import { useAuthStore } from '../../store/authStore'

interface PermissionGuardProps extends PropsWithChildren {
  permission?: string
}

export function PermissionGuard({ children, permission }: PermissionGuardProps) {
  const location = useLocation()
  const { accessToken, isHydrated } = useAuthSession()
  const can = useAuthStore((state) => state.can)

  if (!isHydrated) {
    return <GlobalLoadingBar />
  }

  if (!accessToken) {
    const redirectTo = safeAuthRedirectPath(
      `${location.pathname}${location.search}${location.hash}`,
    )
    const searchParams = new URLSearchParams({ redirectTo })

    return <Navigate replace to={`${routePaths.login}?${searchParams.toString()}`} />
  }

  if (permission && !can(permission)) {
    return (
      <Navigate
        replace
        to={buildAccessDeniedPath({
          from: `${location.pathname}${location.search}${location.hash}`,
          permission,
        })}
      />
    )
  }

  return children ? <>{children}</> : <Outlet />
}
