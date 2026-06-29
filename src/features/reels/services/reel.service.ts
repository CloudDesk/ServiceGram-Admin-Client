import { buildApiUrl } from '../../../config/api'
import {
  REEL_APPROVE_PATH,
  REEL_DELETE_PATH,
  REEL_DETAIL_PATH,
  REEL_LIVE_LIST_PATH,
  REEL_PAUSE_PATH,
  REEL_PENDING_LIST_PATH,
  REEL_REJECT_PATH,
  REEL_REMOVE_PATH,
  REEL_REQUEST_EDIT_PATH,
  REEL_VENDOR_LIST_PATH,
} from '../../../config/reelApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminReelActionResponse,
  AdminReelDeleteResponse,
  AdminReelDetailResponse,
  AdminReelsListResponse,
  AdminReelsQueryParams,
  ReelDeletePayload,
  ReelOptionalReasonPayload,
  ReelRequiredReasonPayload,
} from '../types/reel.types'

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

function deleteJson<TPayload>(payload: TPayload) {
  return {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }
}

async function getPendingReels(
  query: AdminReelsQueryParams = {},
): Promise<AdminReelsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${REEL_PENDING_LIST_PATH}?${queryString}`
        : REEL_PENDING_LIST_PATH,
    ),
  )

  return parseJsonResponse<AdminReelsListResponse>(response)
}

async function getLiveReels(
  query: AdminReelsQueryParams = {},
): Promise<AdminReelsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${REEL_LIVE_LIST_PATH}?${queryString}`
        : REEL_LIVE_LIST_PATH,
    ),
  )

  return parseJsonResponse<AdminReelsListResponse>(response)
}

async function getVendorReels(
  vendorId: string,
  query: AdminReelsQueryParams = {},
): Promise<AdminReelsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${REEL_VENDOR_LIST_PATH(vendorId)}?${queryString}`
        : REEL_VENDOR_LIST_PATH(vendorId),
    ),
  )

  return parseJsonResponse<AdminReelsListResponse>(response)
}

async function getReelById(reelId: string): Promise<AdminReelDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_DETAIL_PATH(reelId)),
  )

  return parseJsonResponse<AdminReelDetailResponse>(response)
}

async function approveReel(
  reelId: string,
  payload: ReelOptionalReasonPayload = {},
): Promise<AdminReelActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_APPROVE_PATH(reelId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminReelActionResponse>(response)
}

async function rejectReel(
  reelId: string,
  payload: ReelRequiredReasonPayload,
): Promise<AdminReelActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_REJECT_PATH(reelId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminReelActionResponse>(response)
}

async function requestReelEdit(
  reelId: string,
  payload: ReelRequiredReasonPayload,
): Promise<AdminReelActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_REQUEST_EDIT_PATH(reelId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminReelActionResponse>(response)
}

async function pauseReel(
  reelId: string,
  payload: ReelRequiredReasonPayload,
): Promise<AdminReelActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_PAUSE_PATH(reelId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminReelActionResponse>(response)
}

async function removeReel(
  reelId: string,
  payload: ReelRequiredReasonPayload,
): Promise<AdminReelActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_REMOVE_PATH(reelId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminReelActionResponse>(response)
}

async function deleteReel(
  reelId: string,
  payload: ReelDeletePayload,
): Promise<AdminReelDeleteResponse> {
  const response = await apiClient.request(
    buildApiUrl(REEL_DELETE_PATH(reelId)),
    deleteJson(payload),
  )

  return parseJsonResponse<AdminReelDeleteResponse>(response)
}

export const reelService = {
  getPendingReels,
  getLiveReels,
  getVendorReels,
  getReelById,
  approveReel,
  rejectReel,
  requestReelEdit,
  pauseReel,
  removeReel,
  deleteReel,
}
