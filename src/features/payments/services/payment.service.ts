import { buildApiUrl } from '../../../config/api'
import {
  PAYMENT_CUSTOMER_LIST_PATH,
  PAYMENT_DETAIL_PATH,
  PAYMENT_LIST_PATH,
  PAYMENT_RECONCILE_PATH,
  REFUND_APPROVE_PATH,
  REFUND_CUSTOMER_LIST_PATH,
  REFUND_DETAIL_PATH,
  REFUND_LIST_PATH,
  REFUND_REJECT_PATH,
} from '../../../config/paymentApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminCustomerPaymentsListResponse,
  AdminCustomerRefundsListResponse,
  AdminPaymentDetailResponse,
  AdminPaymentsListResponse,
  AdminPaymentsQueryParams,
  AdminRefundDetailResponse,
  AdminRefundsListResponse,
  AdminRefundsQueryParams,
  ApproveRefundPayload,
  ApproveRefundResponse,
  ReconcilePaymentPayload,
  ReconcilePaymentResponse,
  RejectRefundPayload,
  RejectRefundResponse,
} from '../types/payment.types'

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
      fieldMessage ?? errorPayload?.message ?? errorPayload?.error ?? 'Finance request failed.',
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

async function getPaymentList(
  query: AdminPaymentsQueryParams = {},
): Promise<AdminPaymentsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${PAYMENT_LIST_PATH}?${queryString}` : PAYMENT_LIST_PATH),
  )

  return parseJsonResponse<AdminPaymentsListResponse>(response)
}

async function getCustomerPayments(
  customerId: string,
  query: AdminPaymentsQueryParams = {},
): Promise<AdminCustomerPaymentsListResponse> {
  const queryString = buildQueryParams(query)
  const path = PAYMENT_CUSTOMER_LIST_PATH(customerId)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${path}?${queryString}` : path),
  )

  return parseJsonResponse<AdminCustomerPaymentsListResponse>(response)
}

async function getPaymentById(paymentId: string): Promise<AdminPaymentDetailResponse> {
  const response = await apiClient.request(buildApiUrl(PAYMENT_DETAIL_PATH(paymentId)))

  return parseJsonResponse<AdminPaymentDetailResponse>(response)
}

async function reconcilePayment(
  paymentId: string,
  payload: ReconcilePaymentPayload = {},
): Promise<ReconcilePaymentResponse> {
  const response = await apiClient.request(
    buildApiUrl(PAYMENT_RECONCILE_PATH(paymentId)),
    postJson(payload),
  )

  return parseJsonResponse<ReconcilePaymentResponse>(response)
}

async function getRefundList(
  query: AdminRefundsQueryParams = {},
): Promise<AdminRefundsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${REFUND_LIST_PATH}?${queryString}` : REFUND_LIST_PATH),
  )

  return parseJsonResponse<AdminRefundsListResponse>(response)
}

async function getCustomerRefunds(
  customerId: string,
  query: AdminRefundsQueryParams = {},
): Promise<AdminCustomerRefundsListResponse> {
  const queryString = buildQueryParams(query)
  const path = REFUND_CUSTOMER_LIST_PATH(customerId)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${path}?${queryString}` : path),
  )

  return parseJsonResponse<AdminCustomerRefundsListResponse>(response)
}

async function getRefundById(refundId: string): Promise<AdminRefundDetailResponse> {
  const response = await apiClient.request(buildApiUrl(REFUND_DETAIL_PATH(refundId)))

  return parseJsonResponse<AdminRefundDetailResponse>(response)
}

async function approveRefund(
  refundId: string,
  payload: ApproveRefundPayload,
): Promise<ApproveRefundResponse> {
  const response = await apiClient.request(
    buildApiUrl(REFUND_APPROVE_PATH(refundId)),
    postJson(payload),
  )

  return parseJsonResponse<ApproveRefundResponse>(response)
}

async function rejectRefund(
  refundId: string,
  payload: RejectRefundPayload,
): Promise<RejectRefundResponse> {
  const response = await apiClient.request(
    buildApiUrl(REFUND_REJECT_PATH(refundId)),
    postJson(payload),
  )

  return parseJsonResponse<RejectRefundResponse>(response)
}

export const paymentService = {
  getPaymentList,
  getCustomerPayments,
  getPaymentById,
  reconcilePayment,
  getRefundList,
  getCustomerRefunds,
  getRefundById,
  approveRefund,
  rejectRefund,
}
