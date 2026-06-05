import type { ModuleMetric, ModuleRecord } from '../../../types/common.types'

export interface DashboardData {
  metrics: ModuleMetric[]
  pendingActions: ModuleRecord[]
}
