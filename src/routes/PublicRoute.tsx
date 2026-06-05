import { Navigate, Outlet } from 'react-router-dom'
import { routePaths } from '../config/routes'
import { useAuthSession } from '../features/auth/hooks/useAuthSession'

export function PublicRoute() {
  const { isHydrated, user } = useAuthSession()

  if (!isHydrated) {
    return null
  }

  if (user) {
    return <Navigate replace to={routePaths.dashboard} />
  }

  return <Outlet />
}
