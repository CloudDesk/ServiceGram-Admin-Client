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
} from '../../../config/payoutApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminPayoutDetailResponse,
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
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorEnvelope

  if (!response.ok) {
    const errorPayload =
      payload && typeof payload === 'object' ? (payload as ErrorEnvelope) : null

    throw new Error(errorPayload?.message ?? 'Request failed.')
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
  createPayout,
  getPayoutById,
  approvePayout,
  holdPayout,
  releasePayoutHold,
  markPayoutPaid,
  markPayoutFailed,
}
