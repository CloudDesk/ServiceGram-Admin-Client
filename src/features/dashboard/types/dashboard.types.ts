import type { ModuleMetric, ModuleRecord } from '../../../types/common.types'

export interface DashboardOverviewData {
  summary: DashboardSummaryData
  reviewQueues: DashboardReviewQueuesData
  finance: DashboardFinanceData
  orders: DashboardOrdersData
  trends: DashboardTrendsData
  scope?: DashboardScope
  loadedAt: string
}

export interface DashboardData extends DashboardOverviewData {
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

export interface DashboardOrderDistributionRow {
  orderStatus: string
  paymentStatus: string
  count: number
}

export interface DashboardChartItem {
  code: string
  label: string
  count: number
  sortOrder: number
  severity: 'NORMAL' | 'ATTENTION'
  routeFilter: Record<string, string>
}

export interface DashboardOrderMatrixRow {
  orderStatus: string
  orderStatusLabel: string
  paymentStatus: string
  paymentStatusLabel: string
  count: number
  severity: 'NORMAL' | 'ATTENTION'
  routeFilter: {
    orderStatus: string
    paymentStatus: string
  }
}

export interface DashboardOrdersData {
  byStatus: Record<string, number>
  byPaymentStatus: Record<string, number>
  statusItems?: DashboardChartItem[]
  paymentStatusItems?: DashboardChartItem[]
  rows: DashboardOrderDistributionRow[]
  matrixRows?: DashboardOrderMatrixRow[]
  scope: DashboardScope
}

export interface DashboardFinanceStatusItem extends DashboardChartItem {
  amountPaise: number
}

export interface DashboardFinanceWidget {
  code: string
  totalCount: number
  totalAmountPaise: number
  statusItems?: DashboardFinanceStatusItem[]
  byStatus: Record<string, { count: number; amountPaise: number }>
}

export interface DashboardFinanceData {
  permitted: boolean
  widgets: DashboardFinanceWidget[]
  warnings: string[]
  scope?: DashboardScope
}

export interface DashboardTrendPoint {
  bucketStart: string
  label: string
  ordersCreated: number
  ordersDelivered: number
  ordersCancelled: number
  paymentsCaptured: number
  refundsCreated: number
  payoutsCreated: number
  paymentAmountPaise: number
  refundAmountPaise: number
  payoutAmountPaise: number
}

export interface DashboardTrendSeries {
  code: string
  label: string
  unit: 'count' | 'paise'
  route: string
}

export interface DashboardTrendsData {
  range: '7d' | '30d' | '90d'
  bucket: 'day' | 'week'
  points: DashboardTrendPoint[]
  series: DashboardTrendSeries[]
  scope: DashboardScope
}

export type DashboardSummaryResponse = DashboardApiResponse<DashboardSummaryData>
export type DashboardOverviewResponse =
  DashboardApiResponse<DashboardOverviewData>
export type DashboardOrdersResponse = DashboardApiResponse<DashboardOrdersData>
export type DashboardReviewQueuesResponse =
  DashboardApiResponse<DashboardReviewQueuesData>
export type DashboardFinanceResponse = DashboardApiResponse<DashboardFinanceData>
export type DashboardTrendsResponse = DashboardApiResponse<DashboardTrendsData>
