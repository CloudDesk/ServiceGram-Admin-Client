import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { GlobalLoadingBar } from '../components/feedback/GlobalLoadingBar'
import { routePaths } from '../config/routes'
import { useAuthSession } from '../features/auth/hooks/useAuthSession'

export function ProtectedRoute() {
  const location = useLocation()
  const { isHydrated, accessToken } = useAuthSession()

  if (!isHydrated) {
    return <GlobalLoadingBar />
  }

  if (!accessToken) {
    return <Navigate replace state={{ from: location }} to={routePaths.login} />
  }

  return <Outlet />
}
