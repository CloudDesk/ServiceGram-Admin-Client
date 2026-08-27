import { buildApiUrl } from '../../../config/api'
import {
  VENDOR_ADD_NOTE_PATH,
  VENDOR_APPROVE_PATH,
  VENDOR_BRAND_LOGO_CONFIRM_UPLOAD_PATH,
  VENDOR_BRAND_LOGO_PATH,
  VENDOR_BRAND_LOGO_UPLOAD_INTENT_PATH,
  VENDOR_DETAIL_PATH,
  VENDOR_DOCUMENT_DOWNLOAD_TARGET_PATH,
  VENDOR_DOCUMENTS_PATH,
  VENDOR_LIST_PATH,
  VENDOR_ONBOARDING_QUEUE_PATH,
  VENDOR_OVERVIEW_PATH,
  VENDOR_ANALYTICS_OVERVIEW_PATH,
  VENDOR_REACTIVATE_PATH,
  VENDOR_REJECT_BANK_ACCOUNT_PATH,
  VENDOR_REJECT_DOCUMENT_PATH,
  VENDOR_REJECT_PATH,
  VENDOR_REQUEST_DOCUMENTS_PATH,
  VENDOR_SERVICE_CATALOG_PATH,
  VENDOR_SERVICE_DETAIL_PATH,
  VENDOR_SERVICE_DISABLE_PATH,
  VENDOR_SERVICES_PATH,
  VENDOR_SUSPEND_PATH,
  VENDOR_UPDATE_PROFILE_PATH,
  VENDOR_VERIFY_BANK_ACCOUNT_PATH,
  VENDOR_VERIFY_DOCUMENT_PATH,
} from '../../../config/vendorApiPaths'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import { apiClient } from '../../../services/apiClient'
import type {
  ConfirmVendorBrandLogoUploadPayload,
  CreateVendorBrandLogoUploadIntentPayload,
  RemoveVendorBrandLogoPayload,
  VendorActionResponse,
  VendorBrandLogoUploadIntentResponse,
  VendorDetailResponse,
  VendorDocumentListQueryParams,
  VendorDocumentListResponse,
  VendorDocumentDownloadTargetResponse,
  VendorDocumentVerificationPayload,
  VendorListQueryParams,
  VendorListResponse,
  VendorNotePayload,
  VendorOnboardingQueueResponse,
  VendorOptionalReasonPayload,
  VendorOverviewResponse,
  VendorAnalyticsOverviewResponse,
  VendorAnalyticsPeriod,
  VendorProfileUpdatePayload,
  VendorRequiredReasonPayload,
  VendorRequestDocumentsPayload,
  VendorServiceActionResponse,
  VendorServiceCatalogPayload,
  VendorServicePayload,
  VendorServicesResponse,
} from '../types/vendor.types'

interface VendorErrorEnvelope {
  message?: string
  error?: string
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
    | VendorErrorEnvelope
    | null

  if (!response.ok) {
    const fieldMessage =
      payload && typeof payload === 'object' && 'details' in payload
        ? payload.details?.fieldErrors?.[0]?.message
        : undefined
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : undefined
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : undefined

    throw new Error(fieldMessage ?? message ?? error ?? 'Vendor request failed.')
  }

  return payload as T
}

function jsonRequest<TPayload>(
  method: 'DELETE' | 'POST' | 'PUT',
  payload: TPayload,
) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

async function getVendorList(
  query: VendorListQueryParams = {},
): Promise<VendorListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString ? `${VENDOR_LIST_PATH}?${queryString}` : VENDOR_LIST_PATH,
    ),
  )
  return parseJsonResponse<VendorListResponse>(response)
}

async function getVendorDocuments(
  query: VendorDocumentListQueryParams = {},
): Promise<VendorDocumentListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${VENDOR_DOCUMENTS_PATH}?${queryString}`
        : VENDOR_DOCUMENTS_PATH,
    ),
  )
  return parseJsonResponse<VendorDocumentListResponse>(response)
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
  const response = await apiClient.request(
    buildApiUrl(VENDOR_DETAIL_PATH(vendorId)),
  )
  return parseJsonResponse<VendorDetailResponse>(response)
}

async function getVendorDocumentDownloadTarget(
  vendorId: string,
  documentId: string,
): Promise<VendorDocumentDownloadTargetResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_DOCUMENT_DOWNLOAD_TARGET_PATH(vendorId, documentId)),
  )
  return parseJsonResponse<VendorDocumentDownloadTargetResponse>(response)
}

async function getVendorOverview(
  vendorId: string,
): Promise<VendorOverviewResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_OVERVIEW_PATH(vendorId)),
  )
  return parseJsonResponse<VendorOverviewResponse>(response)
}

async function getVendorAnalytics(
  vendorId: string,
  period: VendorAnalyticsPeriod = '30D',
  refresh = false,
): Promise<VendorAnalyticsOverviewResponse> {
  const queryString = buildQueryParams({
    period,
    refresh: refresh ? 'true' : undefined,
    timezone: 'Asia/Kolkata',
    topLimit: 5,
  })
  const response = await apiClient.request(
    buildApiUrl(`${VENDOR_ANALYTICS_OVERVIEW_PATH(vendorId)}?${queryString}`),
  )

  return parseJsonResponse<VendorAnalyticsOverviewResponse>(response)
}

async function updateVendorProfile(
  vendorId: string,
  payload: VendorProfileUpdatePayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_UPDATE_PROFILE_PATH(vendorId)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function createVendorBrandLogoUploadIntent(
  vendorId: string,
  payload: CreateVendorBrandLogoUploadIntentPayload,
): Promise<VendorBrandLogoUploadIntentResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_BRAND_LOGO_UPLOAD_INTENT_PATH(vendorId)),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<VendorBrandLogoUploadIntentResponse>(response)
}

async function confirmVendorBrandLogoUpload(
  vendorId: string,
  payload: ConfirmVendorBrandLogoUploadPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_BRAND_LOGO_CONFIRM_UPLOAD_PATH(vendorId)),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function removeVendorBrandLogo(
  vendorId: string,
  payload: RemoveVendorBrandLogoPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_BRAND_LOGO_PATH(vendorId)),
    jsonRequest('DELETE', payload),
  )

  return parseJsonResponse<VendorActionResponse>(response)
}

async function getVendorServices(
  vendorId: string,
): Promise<VendorServicesResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_SERVICES_PATH(vendorId)),
  )
  return parseJsonResponse<VendorServicesResponse>(response)
}

async function createVendorService(
  vendorId: string,
  payload: VendorServicePayload,
): Promise<VendorServiceActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_SERVICES_PATH(vendorId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorServiceActionResponse>(response)
}

async function updateVendorService(
  vendorId: string,
  serviceId: string,
  payload: VendorServicePayload,
): Promise<VendorServiceActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_SERVICE_DETAIL_PATH(vendorId, serviceId)),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorServiceActionResponse>(response)
}

async function disableVendorService(
  vendorId: string,
  serviceId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorServiceActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_SERVICE_DISABLE_PATH(vendorId, serviceId)),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorServiceActionResponse>(response)
}

async function replaceVendorServiceCatalog(
  vendorId: string,
  serviceId: string,
  payload: VendorServiceCatalogPayload,
): Promise<VendorServiceActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_SERVICE_CATALOG_PATH(vendorId, serviceId)),
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  return parseJsonResponse<VendorServiceActionResponse>(response)
}

async function approveVendor(
  vendorId: string,
  payload: VendorOptionalReasonPayload = {},
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_APPROVE_PATH(vendorId)),
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

async function rejectVendor(
  vendorId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_REJECT_PATH(vendorId)),
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
  const response = await apiClient.request(
    buildApiUrl(VENDOR_SUSPEND_PATH(vendorId)),
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

async function reactivateVendor(
  vendorId: string,
  payload: VendorRequiredReasonPayload,
): Promise<VendorActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(VENDOR_REACTIVATE_PATH(vendorId)),
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
  const response = await apiClient.request(
    buildApiUrl(VENDOR_ADD_NOTE_PATH(vendorId)),
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

export const vendorService = {
  getVendorList,
  getVendorDocuments,
  getVendorOnboardingQueue,
  getVendorById,
  getVendorDocumentDownloadTarget,
  getVendorOverview,
  getVendorAnalytics,
  updateVendorProfile,
  createVendorBrandLogoUploadIntent,
  confirmVendorBrandLogoUpload,
  removeVendorBrandLogo,
  getVendorServices,
  createVendorService,
  updateVendorService,
  disableVendorService,
  replaceVendorServiceCatalog,
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
