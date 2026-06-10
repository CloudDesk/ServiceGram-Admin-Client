import { buildApiUrl } from '../../../config/api'
import {
  CUSTOMER_ADD_NOTE_PATH,
  CUSTOMER_BLOCK_PATH,
  CUSTOMER_DETAIL_PATH,
  CUSTOMER_LIST_PATH,
  CUSTOMER_UNBLOCK_PATH,
  CUSTOMER_WALLET_CREDIT_PATH,
} from '../../../config/customerApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AddCustomerNoteResponse,
  AdminCustomerDetailResponse,
  AdminCustomersListResponse,
  AdminCustomersQueryParams,
  BlockCustomerResponse,
  CustomerLifecycleActionPayload,
  CustomerNotePayload,
  CustomerWalletCreditPayload,
  CustomerWalletCreditResponse,
  UnblockCustomerResponse,
} from '../types/customer.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
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

async function getCustomerList(
  query: AdminCustomersQueryParams = {},
): Promise<AdminCustomersListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${CUSTOMER_LIST_PATH}?${queryString}` : CUSTOMER_LIST_PATH),
  )

  return parseJsonResponse<AdminCustomersListResponse>(response)
}

async function getCustomerById(
  customerId: string,
): Promise<AdminCustomerDetailResponse> {
  const response = await apiClient.request(buildApiUrl(CUSTOMER_DETAIL_PATH(customerId)))

  return parseJsonResponse<AdminCustomerDetailResponse>(response)
}

async function addCustomerNote(
  customerId: string,
  payload: CustomerNotePayload,
): Promise<AddCustomerNoteResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_ADD_NOTE_PATH(customerId)),
    postJson(payload),
  )

  return parseJsonResponse<AddCustomerNoteResponse>(response)
}

async function blockCustomer(
  customerId: string,
  payload: CustomerLifecycleActionPayload,
): Promise<BlockCustomerResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_BLOCK_PATH(customerId)),
    postJson(payload),
  )

  return parseJsonResponse<BlockCustomerResponse>(response)
}

async function unblockCustomer(
  customerId: string,
  payload: CustomerLifecycleActionPayload,
): Promise<UnblockCustomerResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_UNBLOCK_PATH(customerId)),
    postJson(payload),
  )

  return parseJsonResponse<UnblockCustomerResponse>(response)
}

async function creditCustomerWallet(
  customerId: string,
  payload: CustomerWalletCreditPayload,
): Promise<CustomerWalletCreditResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_WALLET_CREDIT_PATH(customerId)),
    postJson(payload),
  )

  return parseJsonResponse<CustomerWalletCreditResponse>(response)
}

export const customerService = {
  getCustomerList,
  getCustomerById,
  addCustomerNote,
  blockCustomer,
  unblockCustomer,
  creditCustomerWallet,
}
