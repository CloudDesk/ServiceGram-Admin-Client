import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { GlobalLoadingBar } from '../components/feedback/GlobalLoadingBar'
import { routePaths } from '../config/routes'
import { useAuthSession } from '../features/auth/hooks/useAuthSession'
import { safeAuthRedirectPath } from '../features/auth/utils/redirect'

export function ProtectedRoute() {
  const location = useLocation()
  const { isHydrated, accessToken } = useAuthSession()

  if (!isHydrated) {
    return <GlobalLoadingBar />
  }

  if (!accessToken) {
    const redirectTo = safeAuthRedirectPath(
      `${location.pathname}${location.search}${location.hash}`,
    )
    const searchParams = new URLSearchParams({ redirectTo })

    return (
      <Navigate
        replace
        state={{ from: location }}
        to={`${routePaths.login}?${searchParams.toString()}`}
      />
    )
  }

  return <Outlet />
}
