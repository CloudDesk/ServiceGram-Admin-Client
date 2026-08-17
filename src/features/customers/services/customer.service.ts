import { buildApiUrl } from '../../../config/api'
import {
  CUSTOMER_ADD_NOTE_PATH,
  CUSTOMER_ADDRESS_DETAIL_PATH,
  CUSTOMER_ADDRESS_LIST_PATH,
  CUSTOMER_ADDRESS_SET_DEFAULT_PATH,
  CUSTOMER_BLOCK_PATH,
  CUSTOMER_DETAIL_PATH,
  CUSTOMER_LIST_PATH,
  CUSTOMER_OVERVIEW_PATH,
  CUSTOMER_PROFILE_UPDATE_PATH,
  CUSTOMER_RELATED_VENDORS_PATH,
  CUSTOMER_UNBLOCK_PATH,
  CUSTOMER_WALLET_CREDIT_PATH,
} from '../../../config/customerApiPaths'
import { apiClient } from '../../../services/apiClient'
import {
  buildPathWithQueryParams,
  buildQueryParams,
} from '../../../utils/buildQueryParams'
import type {
  AddCustomerNoteResponse,
  AdminCustomerDetailResponse,
  AdminCustomerOverviewQueryParams,
  AdminCustomerOverviewResponse,
  AdminCustomerRelatedVendorsQueryParams,
  AdminCustomerRelatedVendorsResponse,
  AdminCustomersListResponse,
  AdminCustomersQueryParams,
  BlockCustomerResponse,
  CustomerAddressPayload,
  CustomerAddressReasonPayload,
  CustomerAddressResponse,
  CustomerLifecycleActionPayload,
  DeleteCustomerAddressResponse,
  CustomerNotePayload,
  CustomerProfileUpdatePayload,
  CustomerWalletCreditPayload,
  CustomerWalletCreditResponse,
  UnblockCustomerResponse,
  UpdateCustomerProfileResponse,
} from '../types/customer.types'

interface ErrorEnvelope {
  message?: string
  details?: {
    fieldErrors?: {
      field: string
      message: string
    }[]
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorEnvelope

  if (!response.ok) {
    const fieldMessage =
      payload && typeof payload === 'object' && 'details' in payload
        ? payload.details?.fieldErrors?.[0]?.message
        : undefined
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : undefined

    throw new Error(fieldMessage ?? message ?? 'Customer request failed.')
  }

  return payload as T
}

function jsonRequest<TPayload>(method: 'POST' | 'PUT' | 'DELETE', payload: TPayload) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

function postJson<TPayload>(payload: TPayload) {
  return jsonRequest('POST', payload)
}

function putJson<TPayload>(payload: TPayload) {
  return jsonRequest('PUT', payload)
}

function deleteJson<TPayload>(payload: TPayload) {
  return jsonRequest('DELETE', payload)
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

/**
 * `include` must name every section the caller intends to render. The endpoint
 * defaults to orders + relatedVendors, and anything not requested comes back in
 * `omittedSections` as NOT_REQUESTED with its data null — which is
 * indistinguishable from "no records" unless the caller checks.
 */
async function getCustomerOverview(
  customerId: string,
  query: AdminCustomerOverviewQueryParams = {},
): Promise<AdminCustomerOverviewResponse> {
  const response = await apiClient.request(
    buildApiUrl(
      buildPathWithQueryParams(CUSTOMER_OVERVIEW_PATH(customerId), {
        include: query.include,
        childLimit: query.childLimit,
      }),
    ),
  )

  return parseJsonResponse<AdminCustomerOverviewResponse>(response)
}

async function getCustomerRelatedVendors(
  customerId: string,
  query: AdminCustomerRelatedVendorsQueryParams = {},
): Promise<AdminCustomerRelatedVendorsResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${CUSTOMER_RELATED_VENDORS_PATH(customerId)}?${queryString}`
        : CUSTOMER_RELATED_VENDORS_PATH(customerId),
    ),
  )

  return parseJsonResponse<AdminCustomerRelatedVendorsResponse>(response)
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

async function updateCustomerProfile(
  customerId: string,
  payload: CustomerProfileUpdatePayload,
): Promise<UpdateCustomerProfileResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_PROFILE_UPDATE_PATH(customerId)),
    putJson(payload),
  )

  return parseJsonResponse<UpdateCustomerProfileResponse>(response)
}

async function createCustomerAddress(
  customerId: string,
  payload: CustomerAddressPayload,
): Promise<CustomerAddressResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_ADDRESS_LIST_PATH(customerId)),
    postJson(payload),
  )

  return parseJsonResponse<CustomerAddressResponse>(response)
}

async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  payload: CustomerAddressPayload,
): Promise<CustomerAddressResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_ADDRESS_DETAIL_PATH(customerId, addressId)),
    putJson(payload),
  )

  return parseJsonResponse<CustomerAddressResponse>(response)
}

async function setDefaultCustomerAddress(
  customerId: string,
  addressId: string,
  payload: CustomerAddressReasonPayload,
): Promise<CustomerAddressResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_ADDRESS_SET_DEFAULT_PATH(customerId, addressId)),
    postJson(payload),
  )

  return parseJsonResponse<CustomerAddressResponse>(response)
}

async function deleteCustomerAddress(
  customerId: string,
  addressId: string,
  payload: CustomerAddressReasonPayload,
): Promise<DeleteCustomerAddressResponse> {
  const response = await apiClient.request(
    buildApiUrl(CUSTOMER_ADDRESS_DETAIL_PATH(customerId, addressId)),
    deleteJson(payload),
  )

  return parseJsonResponse<DeleteCustomerAddressResponse>(response)
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
  getCustomerOverview,
  getCustomerRelatedVendors,
  updateCustomerProfile,
  createCustomerAddress,
  updateCustomerAddress,
  setDefaultCustomerAddress,
  deleteCustomerAddress,
  addCustomerNote,
  blockCustomer,
  unblockCustomer,
  creditCustomerWallet,
}
