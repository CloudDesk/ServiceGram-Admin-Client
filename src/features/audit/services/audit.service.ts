import { buildApiUrl } from '../../../config/api'
import { AUDIT_LOGS_PATH } from '../../../config/auditApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type { AuditLogsQueryParams, AuditLogsResponse } from '../types/audit.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
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
