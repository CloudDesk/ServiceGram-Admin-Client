import { buildApiUrl } from '../../../config/api'
import {
  MARKETING_CAMPAIGNS_PATH,
  MARKETING_CAMPAIGN_ARCHIVE_PATH,
  MARKETING_CAMPAIGN_DETAIL_PATH,
  MARKETING_CAMPAIGN_IMAGE_CONFIRM_UPLOAD_PATH,
  MARKETING_CAMPAIGN_IMAGE_UPLOAD_INTENT_PATH,
  MARKETING_CAMPAIGN_PAUSE_PATH,
  MARKETING_CAMPAIGN_PUBLISH_PATH,
} from '../../../config/marketingCampaignApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  MarketingCampaignActionPayload,
  MarketingCampaignApiErrorDetails,
  MarketingCampaignImageConfirmPayload,
  MarketingCampaignImageUploadIntent,
  MarketingCampaignImageUploadIntentPayload,
  MarketingCampaignPayload,
  MarketingCampaignResponse,
  MarketingCampaignsQueryParams,
  MarketingCampaignsResponse,
} from '../types/marketingCampaign.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
  details?: MarketingCampaignApiErrorDetails
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
      fieldMessage ?? errorPayload?.message ?? errorPayload?.error ?? 'Request failed.',
    )
  }

  return payload as T
}

function jsonRequest<TPayload>(method: 'POST' | 'PUT', payload: TPayload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

async function getCampaigns(
  query: MarketingCampaignsQueryParams = {},
): Promise<MarketingCampaignsResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${MARKETING_CAMPAIGNS_PATH}?${queryString}` : MARKETING_CAMPAIGNS_PATH),
  )
  return parseJsonResponse<MarketingCampaignsResponse>(response)
}

async function getCampaign(campaignId: string): Promise<MarketingCampaignResponse> {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_DETAIL_PATH(campaignId)),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

async function createCampaign(
  payload: MarketingCampaignPayload,
): Promise<MarketingCampaignResponse> {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGNS_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

async function updateCampaign(
  campaignId: string,
  payload: MarketingCampaignPayload,
): Promise<MarketingCampaignResponse> {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_DETAIL_PATH(campaignId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

async function publishCampaign(
  campaignId: string,
  payload: MarketingCampaignActionPayload,
) {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_PUBLISH_PATH(campaignId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

async function pauseCampaign(
  campaignId: string,
  payload: MarketingCampaignActionPayload,
) {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_PAUSE_PATH(campaignId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

async function archiveCampaign(
  campaignId: string,
  payload: MarketingCampaignActionPayload,
) {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_ARCHIVE_PATH(campaignId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

async function createImageUploadIntent(
  campaignId: string,
  payload: MarketingCampaignImageUploadIntentPayload,
) {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_IMAGE_UPLOAD_INTENT_PATH(campaignId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<{ data: MarketingCampaignImageUploadIntent }>(response)
}

async function confirmImageUpload(
  campaignId: string,
  payload: MarketingCampaignImageConfirmPayload,
) {
  const response = await apiClient.request(
    buildApiUrl(MARKETING_CAMPAIGN_IMAGE_CONFIRM_UPLOAD_PATH(campaignId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<MarketingCampaignResponse>(response)
}

export const marketingCampaignService = {
  archiveCampaign,
  confirmImageUpload,
  createCampaign,
  createImageUploadIntent,
  getCampaign,
  getCampaigns,
  pauseCampaign,
  publishCampaign,
  updateCampaign,
}
