import { buildApiUrl } from '../../../config/api'
import {
  DASHBOARD_APPROVAL_CENTER_PATH,
  DASHBOARD_OVERVIEW_PATH,
} from '../../../config/dashboardApiPaths'
import { apiClient } from '../../../services/apiClient'
import type {
  DashboardApprovalCenterData,
  DashboardApprovalCenterResponse,
  DashboardApiResponse,
  DashboardData,
  DashboardOverviewResponse,
  DashboardQueue,
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
    const overviewResponse = await get<DashboardOverviewResponse>(
      `${DASHBOARD_OVERVIEW_PATH}?range=30d&bucket=day`,
    )

    const overview = overviewResponse.data
    const summary = overview.summary
    const queues = overview.reviewQueues.queues
    const finance = overview.finance
    const updatedAt = overview.loadedAt || new Date().toISOString()

    return {
      ...overview,
      loadedAt: updatedAt,
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
  async getApprovalCenter(): Promise<DashboardApprovalCenterData> {
    const response = await get<DashboardApprovalCenterResponse>(
      DASHBOARD_APPROVAL_CENTER_PATH,
    )

    return response.data
  },
}
