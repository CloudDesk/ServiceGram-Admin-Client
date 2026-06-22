import { buildApiUrl } from '../../../config/api'
import {
  DASHBOARD_FINANCE_PATH,
  DASHBOARD_REVIEW_QUEUES_PATH,
  DASHBOARD_SUMMARY_PATH,
} from '../../../config/dashboardApiPaths'
import { apiClient } from '../../../services/apiClient'
import type {
  DashboardApiResponse,
  DashboardData,
  DashboardFinanceResponse,
  DashboardQueue,
  DashboardReviewQueuesResponse,
  DashboardSummaryResponse,
} from '../types/dashboard.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function get<TResponse extends DashboardApiResponse<unknown>>(
  path: string,
): Promise<TResponse> {
  const response = await apiClient.request(buildApiUrl(path))
  return parseJsonResponse<TResponse>(response)
}

function queueSubtitle(queue: DashboardQueue) {
  if (queue.count === 1) {
    return '1 item waiting for review'
  }

  return `${queue.count} items waiting for review`
}

export const dashboardApiService = {
  async getDashboard(): Promise<DashboardData> {
    const [summaryResponse, queueResponse, financeResponse] = await Promise.all([
      get<DashboardSummaryResponse>(DASHBOARD_SUMMARY_PATH),
      get<DashboardReviewQueuesResponse>(DASHBOARD_REVIEW_QUEUES_PATH),
      get<DashboardFinanceResponse>(DASHBOARD_FINANCE_PATH),
    ])

    const summary = summaryResponse.data
    const queues = queueResponse.data.queues
    const finance = financeResponse.data
    const updatedAt = new Date().toISOString()

    return {
      metrics: [
        ...summary.cards.map((card) => ({
          label: card.label,
          value: String(card.value),
          tone: card.severity === 'ATTENTION' ? 'warning' as const : 'info' as const,
        })),
        ...(finance.permitted
          ? finance.widgets.map((widget) => ({
              label: `${widget.code.toLowerCase()} total`,
              value: String(widget.totalCount),
              tone: widget.totalCount > 0 ? 'success' as const : 'neutral' as const,
            }))
          : []),
      ],
      pendingActions: queues
        .filter((queue) => queue.count > 0)
        .map((queue) => ({
          id: queue.code,
          name: queue.label,
          subtitle: queueSubtitle(queue),
          status: queue.severity === 'ATTENTION' ? 'Needs review' : 'Clear',
          updatedAt,
        })),
    }
  },
}
