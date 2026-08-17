import { buildApiUrl } from '../../../config/api'
import {
  APP_CONFIG_DELIVERY_PATH,
  APP_CONFIG_PUBLIC_PATH,
  FEATURE_FLAGS_PATH,
  FEATURE_FLAG_ARCHIVE_PATH,
  FEATURE_FLAG_DETAIL_PATH,
  FEATURE_FLAG_EVALUATE_PATH,
  FEATURE_FLAG_HISTORY_PATH,
  FEATURE_FLAG_TARGETS_PATH,
  RELEASE2_OVERVIEW_PATH,
  RELEASE2_SETTINGS_PATH,
  RELEASE2_SETTING_DETAIL_PATH,
  RELEASE2_SETTING_PREVIEW_PATH,
} from '../../../config/release2ApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  AppConfigResponse,
  ArchiveFeatureFlagPayload,
  CreateFeatureFlagPayload,
  EvaluateFeatureFlagPayload,
  FeatureFlagDetailResponse,
  FeatureFlagEvaluationResponse,
  FeatureFlagHistoryResponse,
  FeatureFlagsListResponse,
  FeatureFlagsQueryParams,
  Release2ErrorResponse,
  Release2OverviewResponse,
  Release2SettingPreviewResponse,
  Release2SettingResponse,
  Release2SettingsListResponse,
  ReplaceFeatureFlagTargetsPayload,
  UpdateFeatureFlagPayload,
  UpdateRelease2SettingPayload,
} from '../types/release2.types'
import { Release2ServiceError } from '../types/release2.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  const body = text ? (JSON.parse(text) as T | Release2ErrorResponse) : null

  if (!response.ok) {
    const errorBody = (body ?? null) as Release2ErrorResponse | null

    // The first fieldError is the most specific thing the backend can tell the
    // admin, so it becomes the surfaced message. `response` keeps the rest.
    throw new Release2ServiceError(
      errorBody?.details?.fieldErrors?.[0]?.message ??
        errorBody?.message ??
        `Request failed with status ${response.status}.`,
      response.status,
      errorBody?.code ?? 'REQUEST_FAILED',
      errorBody,
    )
  }

  return body as T
}

function jsonRequest<TPayload>(method: 'POST' | 'PUT', payload: TPayload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

function withQuery(path: string, query: object) {
  const queryString = buildQueryParams(query)

  return queryString ? `${path}?${queryString}` : path
}

async function getOverview(): Promise<Release2OverviewResponse> {
  const response = await apiClient.request(buildApiUrl(RELEASE2_OVERVIEW_PATH))

  return parseJsonResponse<Release2OverviewResponse>(response)
}

async function getFeatureFlags(
  query: FeatureFlagsQueryParams = {},
): Promise<FeatureFlagsListResponse> {
  const response = await apiClient.request(
    buildApiUrl(withQuery(FEATURE_FLAGS_PATH, query)),
  )

  return parseJsonResponse<FeatureFlagsListResponse>(response)
}

async function getFeatureFlag(
  featureKey: string,
): Promise<FeatureFlagDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(FEATURE_FLAG_DETAIL_PATH(featureKey)),
  )

  return parseJsonResponse<FeatureFlagDetailResponse>(response)
}

async function getFeatureFlagHistory(
  featureKey: string,
  query: { page?: number; limit?: number } = {},
): Promise<FeatureFlagHistoryResponse> {
  const response = await apiClient.request(
    buildApiUrl(withQuery(FEATURE_FLAG_HISTORY_PATH(featureKey), query)),
  )

  return parseJsonResponse<FeatureFlagHistoryResponse>(response)
}

async function createFeatureFlag(
  payload: CreateFeatureFlagPayload,
): Promise<FeatureFlagDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(FEATURE_FLAGS_PATH),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<FeatureFlagDetailResponse>(response)
}

async function updateFeatureFlag(
  featureKey: string,
  payload: UpdateFeatureFlagPayload,
): Promise<FeatureFlagDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(FEATURE_FLAG_DETAIL_PATH(featureKey)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<FeatureFlagDetailResponse>(response)
}

async function archiveFeatureFlag(
  featureKey: string,
  payload: ArchiveFeatureFlagPayload,
): Promise<FeatureFlagDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(FEATURE_FLAG_ARCHIVE_PATH(featureKey)),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<FeatureFlagDetailResponse>(response)
}

async function replaceFeatureFlagTargets(
  featureKey: string,
  payload: ReplaceFeatureFlagTargetsPayload,
): Promise<FeatureFlagDetailResponse> {
  const response = await apiClient.request(
    buildApiUrl(FEATURE_FLAG_TARGETS_PATH(featureKey)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<FeatureFlagDetailResponse>(response)
}

async function evaluateFeatureFlag(
  featureKey: string,
  payload: EvaluateFeatureFlagPayload,
): Promise<FeatureFlagEvaluationResponse> {
  const response = await apiClient.request(
    buildApiUrl(FEATURE_FLAG_EVALUATE_PATH(featureKey)),
    jsonRequest('POST', payload),
  )

  return parseJsonResponse<FeatureFlagEvaluationResponse>(response)
}

async function getRelease2Settings(): Promise<Release2SettingsListResponse> {
  const response = await apiClient.request(buildApiUrl(RELEASE2_SETTINGS_PATH))

  return parseJsonResponse<Release2SettingsListResponse>(response)
}

async function getRelease2Setting(
  settingKey: string,
): Promise<Release2SettingResponse> {
  const response = await apiClient.request(
    buildApiUrl(RELEASE2_SETTING_DETAIL_PATH(settingKey)),
  )

  return parseJsonResponse<Release2SettingResponse>(response)
}

async function previewRelease2Setting(
  settingKey: string,
  value: unknown,
): Promise<Release2SettingPreviewResponse> {
  const response = await apiClient.request(
    buildApiUrl(RELEASE2_SETTING_PREVIEW_PATH(settingKey)),
    jsonRequest('POST', { value }),
  )

  return parseJsonResponse<Release2SettingPreviewResponse>(response)
}

async function updateRelease2Setting(
  settingKey: string,
  payload: UpdateRelease2SettingPayload,
): Promise<Release2SettingResponse> {
  const response = await apiClient.request(
    buildApiUrl(RELEASE2_SETTING_DETAIL_PATH(settingKey)),
    jsonRequest('PUT', payload),
  )

  return parseJsonResponse<Release2SettingResponse>(response)
}

/**
 * Client rollout readiness. Only the public and delivery routes are reachable
 * from an admin session — the customer/vendor/influencer routes need their own
 * app JWT, so the admin portal must not claim to speak for them.
 */
async function getPublicAppConfig(): Promise<AppConfigResponse> {
  const response = await apiClient.request(buildApiUrl(APP_CONFIG_PUBLIC_PATH))

  return parseJsonResponse<AppConfigResponse>(response)
}

async function getDeliveryAppConfig(): Promise<AppConfigResponse> {
  const response = await apiClient.request(buildApiUrl(APP_CONFIG_DELIVERY_PATH))

  return parseJsonResponse<AppConfigResponse>(response)
}

export const release2Service = {
  getOverview,
  getFeatureFlags,
  getFeatureFlag,
  getFeatureFlagHistory,
  createFeatureFlag,
  updateFeatureFlag,
  archiveFeatureFlag,
  replaceFeatureFlagTargets,
  evaluateFeatureFlag,
  getRelease2Settings,
  getRelease2Setting,
  previewRelease2Setting,
  updateRelease2Setting,
  getPublicAppConfig,
  getDeliveryAppConfig,
}
