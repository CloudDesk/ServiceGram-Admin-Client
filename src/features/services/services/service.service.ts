import { buildApiUrl } from '../../../config/api'
import {
  SERVICE_APPROVE_PATH,
  SERVICE_DETAIL_PATH,
  SERVICE_PENDING_LIST_PATH,
  SERVICE_REJECT_PATH,
} from '../../../config/servicesApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminServiceActionResponse,
  AdminServiceDetailResponse,
  AdminServicesListResponse,
  AdminServicesQueryParams,
  ServiceOptionalReasonPayload,
  ServiceRequiredReasonPayload,
} from '../types/service.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
}

/**
 * Thrown with the backend's own error code attached, mirroring
 * ReelServiceError — the message alone cannot tell a stale session from a
 * version conflict, and those are the two failures a moderation action
 * actually hits.
 */
export class ServiceModerationServiceError extends Error {
  readonly code: string | null
  readonly status: number

  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.name = 'ServiceModerationServiceError'
    this.code = code
    this.status = status
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorEnvelope

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorEnvelope) : null

    throw new ServiceModerationServiceError(
      errorPayload?.message ?? 'Request failed.',
      errorPayload?.code ?? null,
      response.status,
    )
  }

  return payload as T
}

function postJson<TPayload>(payload: TPayload) {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

async function getPendingServices(
  query: AdminServicesQueryParams = {},
): Promise<AdminServicesListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${SERVICE_PENDING_LIST_PATH}?${queryString}`
        : SERVICE_PENDING_LIST_PATH,
    ),
  )

  return parseJsonResponse<AdminServicesListResponse>(response)
}

async function getServiceById(
  serviceId: string,
): Promise<AdminServiceDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(SERVICE_DETAIL_PATH(serviceId)),
  )

  return parseJsonResponse<AdminServiceDetailResponse>(response)
}

async function approveService(
  serviceId: string,
  payload: ServiceOptionalReasonPayload = {},
): Promise<AdminServiceActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(SERVICE_APPROVE_PATH(serviceId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminServiceActionResponse>(response)
}

async function rejectService(
  serviceId: string,
  payload: ServiceRequiredReasonPayload,
): Promise<AdminServiceActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(SERVICE_REJECT_PATH(serviceId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminServiceActionResponse>(response)
}

export const serviceService = {
  getPendingServices,
  getServiceById,
  approveService,
  rejectService,
}
