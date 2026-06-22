import type { ApiErrorDetails } from '../../../types/api.types'

export type AdminReportType =
  | 'ORDER_LIFECYCLE'
  | 'VENDOR_PERFORMANCE'
  | 'PAYMENTS'
  | 'PAYOUTS'
  | 'REFUNDS'
export type ReportExportFormat = 'JSON' | 'CSV'
export type ReportExportStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type ReportAction = 'CREATE_EXPORT'
export type ReportExportAction =
  | 'DOWNLOAD_FILE'
  | 'VIEW_INLINE_RESULT'
  | 'REFRESH_STATUS'
  | 'RETRY_EXPORT'

export interface ReportQueryParams {
  dateFrom?: string
  dateTo?: string
  city?: string
  zoneId?: string
  vendorId?: string
  categoryId?: string
  status?: string
  limit?: number
}

export type ReportSummary = Record<string, unknown>
export type ReportRow = Record<string, unknown>

export interface ReportData {
  reportType: AdminReportType
  filters: Record<string, unknown>
  generatedAt: string
  summary: ReportSummary
  byStatus?: Record<string, unknown>[]
  rows: ReportRow[]
  rowCount: number
  availableActions: ReportAction[]
  nextRecommendedAction: ReportAction | null
  warnings: string[]
}

export interface CreateReportExportPayload {
  reportType: AdminReportType
  format?: ReportExportFormat
  filters?: Record<string, unknown>
  reason: string
}

export interface ReportExport {
  exportId: string
  reportType: AdminReportType
  format: ReportExportFormat
  status: ReportExportStatus
  filters: Record<string, unknown>
  rowCount: number | null
  download: {
    downloadUrl: string | null
    fileMediaAssetId: string | null
    providerStatus: string
    expiresAt: string | null
    warnings: string[]
  }
  result: {
    reportType: string
    generatedAt: string | null
    summary: unknown
    rows: unknown[]
  } | null
  failureReason: string | null
  availableActions: ReportExportAction[]
  nextRecommendedAction: ReportExportAction | null
  lifecycle: {
    requestedByAdminId: string | null
    processedByAdminId: string | null
    queuedAt: string
    startedAt: string | null
    completedAt: string | null
    failedAt: string | null
    createdAt: string
    updatedAt: string
  }
}

export interface ReportApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
}

export type ReportResponse = ReportApiResponse<ReportData>
export type ReportExportResponse = ReportApiResponse<ReportExport>

export interface ReportApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
