import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthSession } from '../features/auth/hooks/useAuthSession'
import { safeAuthRedirectPath } from '../features/auth/utils/redirect'

interface PublicRouteLocationState {
  from?: {
    hash?: string
    pathname?: string
    search?: string
  }
}

function redirectFromLocationState(state: unknown) {
  const locationState = state as PublicRouteLocationState | null
  const from = locationState?.from

  if (!from?.pathname) {
    return null
  }

  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
}

export function PublicRoute() {
  const location = useLocation()
  const { isHydrated, accessToken } = useAuthSession()

  if (!isHydrated) {
    return null
  }

  if (accessToken) {
    const searchParams = new URLSearchParams(location.search)
    const redirectTo = safeAuthRedirectPath(
      searchParams.get('redirectTo') ?? redirectFromLocationState(location.state),
    )

    return <Navigate replace to={redirectTo} />
  }

  return <Outlet />
}
