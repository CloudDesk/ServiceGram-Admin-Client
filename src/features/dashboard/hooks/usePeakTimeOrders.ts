import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboard.service'

export function usePeakTimeOrders(range: '7d' | '30d' | '90d', enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'peak-times', range],
    queryFn: () => dashboardService.getPeakTimes(range),
    enabled,
  })
}
