import { buildApiUrl } from '../../../config/api'
import {
  INFLUENCER_APPROVE_PATH,
  INFLUENCER_DETAIL_PATH,
  INFLUENCER_LIST_PATH,
  INFLUENCER_REACTIVATE_PATH,
  INFLUENCER_REJECT_PATH,
  INFLUENCER_SUSPEND_PATH,
} from '../../../config/influencerApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AdminInfluencerActionResponse,
  AdminInfluencerDetailResponse,
  AdminInfluencersListResponse,
  AdminInfluencersQueryParams,
  InfluencerActionPayload,
} from '../types/influencer.types'

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

async function getInfluencers(
  query: AdminInfluencersQueryParams = {},
): Promise<AdminInfluencersListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${INFLUENCER_LIST_PATH}?${queryString}`
        : INFLUENCER_LIST_PATH,
    ),
  )

  return parseJsonResponse<AdminInfluencersListResponse>(response)
}

async function getInfluencerById(
  profileId: string,
): Promise<AdminInfluencerDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(INFLUENCER_DETAIL_PATH(profileId)),
  )

  return parseJsonResponse<AdminInfluencerDetailResponse>(response)
}

async function approveInfluencer(
  profileId: string,
  payload: InfluencerActionPayload = {},
): Promise<AdminInfluencerActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(INFLUENCER_APPROVE_PATH(profileId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminInfluencerActionResponse>(response)
}

async function rejectInfluencer(
  profileId: string,
  payload: InfluencerActionPayload,
): Promise<AdminInfluencerActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(INFLUENCER_REJECT_PATH(profileId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminInfluencerActionResponse>(response)
}

async function suspendInfluencer(
  profileId: string,
  payload: InfluencerActionPayload,
): Promise<AdminInfluencerActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(INFLUENCER_SUSPEND_PATH(profileId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminInfluencerActionResponse>(response)
}

async function reactivateInfluencer(
  profileId: string,
  payload: InfluencerActionPayload = {},
): Promise<AdminInfluencerActionResponse> {
  const response = await apiClient.request(
    buildApiUrl(INFLUENCER_REACTIVATE_PATH(profileId)),
    postJson(payload),
  )

  return parseJsonResponse<AdminInfluencerActionResponse>(response)
}

export const influencerService = {
  getInfluencers,
  getInfluencerById,
  approveInfluencer,
  rejectInfluencer,
  suspendInfluencer,
  reactivateInfluencer,
}
