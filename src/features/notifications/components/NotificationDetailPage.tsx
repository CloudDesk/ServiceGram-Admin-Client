import { Navigate } from 'react-router-dom'
import { routePaths } from '../../../config/routes'

export function NotificationDetailPage() {
  return <Navigate replace to={routePaths.notifications} />
}
