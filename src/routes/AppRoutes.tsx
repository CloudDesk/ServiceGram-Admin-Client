import { useRoutes } from 'react-router-dom'
import { appRoutes } from './routeConfig'

export function AppRoutes() {
  return useRoutes(appRoutes)
}
