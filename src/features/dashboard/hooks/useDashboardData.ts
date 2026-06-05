import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboard.service'

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: dashboardService.getDashboard,
  })
}
