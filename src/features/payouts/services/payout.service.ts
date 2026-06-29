import { buildApiUrl } from '../../../config/api'
import {
  PAYOUT_APPROVE_PATH,
  PAYOUT_CREATE_PATH,
  PAYOUT_DETAIL_PATH,
  PAYOUT_HOLD_PATH,
  PAYOUT_LIST_PATH,
  PAYOUT_MARK_FAILED_PATH,
  PAYOUT_MARK_PAID_PATH,
  PAYOUT_RELEASE_HOLD_PATH,
  PAYOUT_VENDOR_LIST_PATH,
} from '../../../config/payoutApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminPayoutDetailResponse,
  AdminVendorPayoutsListResponse,
  AdminPayoutsListResponse,
  AdminPayoutsQueryParams,
  ApprovePayoutPayload,
  ApprovePayoutResponse,
  CreatePayoutPayload,
  CreatePayoutResponse,
  MarkPayoutPaidPayload,
  PayoutActionResponse,
  PayoutReasonPayload,
} from '../types/payout.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
  details?: {
    fieldErrors?: {
      field: string
      message: string
    }[]
  }
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
      fieldMessage ?? errorPayload?.message ?? errorPayload?.error ?? 'Payout request failed.',
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

async function getPayoutList(
  query: AdminPayoutsQueryParams = {},
): Promise<AdminPayoutsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${PAYOUT_LIST_PATH}?${queryString}` : PAYOUT_LIST_PATH),
  )

  return parseJsonResponse<AdminPayoutsListResponse>(response)
}

async function getVendorPayouts(
  vendorId: string,
  query: AdminPayoutsQueryParams = {},
): Promise<AdminVendorPayoutsListResponse> {
  const queryString = buildQueryParams(query)
  const path = PAYOUT_VENDOR_LIST_PATH(vendorId)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${path}?${queryString}` : path),
  )

  return parseJsonResponse<AdminVendorPayoutsListResponse>(response)
}

async function createPayout(
  payload: CreatePayoutPayload,
): Promise<CreatePayoutResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYOUT_CREATE_PATH),
    postJson(payload),
  )

  return parseJsonResponse<CreatePayoutResponse>(response)
}

async function getPayoutById(payoutId: string): Promise<AdminPayoutDetailResponse> {
  const response = await apiClient.request(buildApiUrl(PAYOUT_DETAIL_PATH(payoutId)))

  return parseJsonResponse<AdminPayoutDetailResponse>(response)
}

async function approvePayout(
  payoutId: string,
  payload: ApprovePayoutPayload,
): Promise<ApprovePayoutResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYOUT_APPROVE_PATH(payoutId)),
    postJson(payload),
  )

  return parseJsonResponse<ApprovePayoutResponse>(response)
}

async function holdPayout(
  payoutId: string,
  payload: PayoutReasonPayload,
): Promise<PayoutActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYOUT_HOLD_PATH(payoutId)),
    postJson(payload),
  )

  return parseJsonResponse<PayoutActionResponse>(response)
}

async function releasePayoutHold(
  payoutId: string,
  payload: PayoutReasonPayload,
): Promise<PayoutActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYOUT_RELEASE_HOLD_PATH(payoutId)),
    postJson(payload),
  )

  return parseJsonResponse<PayoutActionResponse>(response)
}

async function markPayoutPaid(
  payoutId: string,
  payload: MarkPayoutPaidPayload,
): Promise<PayoutActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYOUT_MARK_PAID_PATH(payoutId)),
    postJson(payload),
  )

  return parseJsonResponse<PayoutActionResponse>(response)
}

async function markPayoutFailed(
  payoutId: string,
  payload: PayoutReasonPayload,
): Promise<PayoutActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYOUT_MARK_FAILED_PATH(payoutId)),
    postJson(payload),
  )

  return parseJsonResponse<PayoutActionResponse>(response)
}

export const payoutService = {
  getPayoutList,
  getVendorPayouts,
  createPayout,
  getPayoutById,
  approvePayout,
  holdPayout,
  releasePayoutHold,
  markPayoutPaid,
  markPayoutFailed,
}
