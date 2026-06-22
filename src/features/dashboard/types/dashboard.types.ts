import type { ModuleMetric, ModuleRecord } from '../../../types/common.types'

export interface DashboardData {
  metrics: ModuleMetric[]
  pendingActions: ModuleRecord[]
}

export interface DashboardApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
}

export interface DashboardCard {
  code: string
  label: string
  value: number
  severity: 'NORMAL' | 'ATTENTION'
  action: string | null
}

export interface DashboardScope {
  type: string
  zoneIds: string[]
}

export interface DashboardSummaryData {
  cards: DashboardCard[]
  alerts: string[]
  scope: DashboardScope
  nextRecommendedAction: string | null
}

export interface DashboardQueue {
  code: string
  label: string
  count: number
  path: string
  severity: 'NORMAL' | 'ATTENTION'
  availableActions: string[]
}

export interface DashboardReviewQueuesData {
  queues: DashboardQueue[]
  nextRecommendedAction: string | null
  scope: DashboardScope
}

export interface DashboardFinanceWidget {
  code: string
  totalCount: number
  totalAmountPaise: number
  byStatus: Record<string, { count: number; amountPaise: number }>
}

export interface DashboardFinanceData {
  permitted: boolean
  widgets: DashboardFinanceWidget[]
  warnings: string[]
  scope?: DashboardScope
}

export type DashboardSummaryResponse = DashboardApiResponse<DashboardSummaryData>
export type DashboardReviewQueuesResponse =
  DashboardApiResponse<DashboardReviewQueuesData>
export type DashboardFinanceResponse = DashboardApiResponse<DashboardFinanceData>
