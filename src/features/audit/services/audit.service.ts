import { buildApiUrl } from '../../../config/api'
import { AUDIT_LOGS_PATH } from '../../../config/auditApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AuditErrorResponse,
  AuditLogsQueryParams,
  AuditLogsResponse,
} from '../types/audit.types'

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text()

  if (!text) {
    return null
  }

  return JSON.parse(text) as T
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await readJsonResponse<T | AuditErrorResponse>(response)

  if (!response.ok) {
    const errorBody = body as AuditErrorResponse | null
    const fieldMessage = errorBody?.details?.fieldErrors?.[0]?.message

    throw new Error(fieldMessage ?? errorBody?.message ?? 'Request failed.')
  }

  return body as T
}

async function getAuditLogs(
  query: AuditLogsQueryParams = {},
): Promise<AuditLogsResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${AUDIT_LOGS_PATH}?${queryString}` : AUDIT_LOGS_PATH),
  )
  return parseJsonResponse<AuditLogsResponse>(response)
}

export const auditService = {
  getAuditLogs,
}
