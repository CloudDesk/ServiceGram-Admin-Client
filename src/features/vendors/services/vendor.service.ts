import { buildApiUrl } from '../../../config/api'
import {
  VENDOR_ADD_NOTE_PATH,
  VENDOR_APPROVE_PATH,
  VENDOR_DETAIL_PATH,
  VENDOR_LIST_PATH,
  VENDOR_ONBOARDING_QUEUE_PATH,
  VENDOR_REACTIVATE_PATH,
  VENDOR_REJECT_BANK_ACCOUNT_PATH,
  VENDOR_REJECT_DOCUMENT_PATH,
  VENDOR_REJECT_PATH,
  VENDOR_REQUEST_DOCUMENTS_PATH,
  VENDOR_SUSPEND_PATH,
  VENDOR_VERIFY_BANK_ACCOUNT_PATH,
  VENDOR_VERIFY_DOCUMENT_PATH,
} from '../../../config/vendorApiPaths'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import { apiClient } from '../../../services/apiClient'
import type {
  VendorActionResponse,
  VendorDetailResponse,
  VendorDocumentVerificationPayload,
  VendorListQueryParams,
  VendorListResponse,
  VendorNotePayload,
  VendorOnboardingQueueResponse,
  VendorOptionalReasonPayload,
  VendorRequiredReasonPayload,
  VendorRequestDocumentsPayload,
} from '../types/vendor.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function getVendorList(
  query: VendorListQueryParams = {},
): Promise<VendorListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${VENDOR_LIST_PATH}?${queryString}` : VENDOR_LIST_PATH),
  )
  return parseJsonResponse<VendorListResponse>(response)
}

async function getVendorOnboardingQueue(
  query: VendorListQueryParams = {},
): Promise<VendorOnboardingQueueResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${VENDOR_ONBOARDING_QUEUE_PATH}?${queryString}`
        : VENDOR_ONBOARDING_QUEUE_PATH,
    ),
  )
  return parseJsonResponse<VendorOnboardingQueueResponse>(response)
}

async function getVendorById(vendorId: string): Promise<VendorDetailResponse> {
  const response = await apiClient.request(buildApiUrl(VENDOR_DETAIL_PATH(vendorId)))
  return parseJsonResponse<VendorDetailResponse>(response)
}

async function approveVendor(
  vendorId: string,
  payload: VendorOptionalReasonPayload = {},
): Promise<VendorActionResponse> {
  const response = await apiClient.request(buildApiUrl(VENDOR_APPROVE_PATH(vendorId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<VendorActionResponse>(response)
}

async function rejectVendor(
  vendorId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(buildApiUrl(VENDOR_REJECT_PATH(vendorId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<VendorActionResponse>(response)
}

async function requestVendorDocuments(
  vendorId: string,
  payload: VendorRequestDocumentsPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_REQUEST_DOCUMENTS_PATH(vendorId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function suspendVendor(
  vendorId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(buildApiUrl(VENDOR_SUSPEND_PATH(vendorId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<VendorActionResponse>(response)
}

async function reactivateVendor(
  vendorId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(buildApiUrl(VENDOR_REACTIVATE_PATH(vendorId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<VendorActionResponse>(response)
}

async function verifyVendorDocument(
  vendorId: string,
  documentId: string,
  payload: VendorDocumentVerificationPayload = {},
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_VERIFY_DOCUMENT_PATH(vendorId, documentId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function rejectVendorDocument(
  vendorId: string,
  documentId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_REJECT_DOCUMENT_PATH(vendorId, documentId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function verifyVendorBankAccount(
  vendorId: string,
  bankAccountId: string,
  payload: VendorOptionalReasonPayload = {},
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_VERIFY_BANK_ACCOUNT_PATH(vendorId, bankAccountId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function rejectVendorBankAccount(
  vendorId: string,
  bankAccountId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_REJECT_BANK_ACCOUNT_PATH(vendorId, bankAccountId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function addVendorNote(
  vendorId: string,
  payload: VendorNotePayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(buildApiUrl(VENDOR_ADD_NOTE_PATH(vendorId)), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseJsonResponse<VendorActionResponse>(response)
}

export const vendorService = {
  getVendorList,
  getVendorOnboardingQueue,
  getVendorById,
  approveVendor,
  rejectVendor,
  requestVendorDocuments,
  suspendVendor,
  reactivateVendor,
  verifyVendorDocument,
  rejectVendorDocument,
  verifyVendorBankAccount,
  rejectVendorBankAccount,
  addVendorNote,
}
