import { buildApiUrl } from '../../../config/api'
import {
  REPORT_EXPORTS_PATH,
  REPORT_EXPORT_DETAIL_PATH,
  REPORT_ORDER_LIFECYCLE_PATH,
  REPORT_PAYMENTS_PATH,
  REPORT_PAYOUTS_PATH,
  REPORT_REFUNDS_PATH,
  REPORT_VENDOR_PERFORMANCE_PATH,
} from '../../../config/reportApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminReportType,
  CreateReportExportPayload,
  ReportExportResponse,
  ReportApiErrorDetails,
  ReportQueryParams,
  ReportResponse,
} from '../types/report.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
  details?: ReportApiErrorDetails
}

const reportPathByType: Record<AdminReportType, string> = {
  ORDER_LIFECYCLE: REPORT_ORDER_LIFECYCLE_PATH,
  VENDOR_PERFORMANCE: REPORT_VENDOR_PERFORMANCE_PATH,
  PAYMENTS: REPORT_PAYMENTS_PATH,
  PAYOUTS: REPORT_PAYOUTS_PATH,
  REFUNDS: REPORT_REFUNDS_PATH,
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | T
    | ErrorEnvelope
    | null

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorEnvelope) : null
    const fieldMessage = errorPayload?.details?.fieldErrors?.[0]?.message

    throw new Error(
      fieldMessage ?? errorPayload?.message ?? errorPayload?.error ?? 'Request failed.',
    )
  }

  return payload as T
}

function jsonRequest<TPayload>(method: 'POST', payload: TPayload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

async function getReport(
  reportType: AdminReportType,
  query: ReportQueryParams = {},
): Promise<ReportResponse> {
  const queryString = buildQueryParams(query)
  const path = reportPathByType[reportType]
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${path}?${queryString}` : path),
  )
  return parseJsonResponse<ReportResponse>(response)
}

async function createExport(
  payload: CreateReportExportPayload,
): Promise<ReportExportResponse> {
  const response = await apiClient.request(
    buildApiUrl(REPORT_EXPORTS_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<ReportExportResponse>(response)
}

async function getExport(exportId: string): Promise<ReportExportResponse> {
  const response = await apiClient.request(buildApiUrl(REPORT_EXPORT_DETAIL_PATH(exportId)))
  return parseJsonResponse<ReportExportResponse>(response)
}

export const reportService = {
  getReport,
  createExport,
  getExport,
}
