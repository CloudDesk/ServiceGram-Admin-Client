import { buildApiUrl } from '../../../config/api'
import {
  SETTINGS_CATEGORIES_PATH,
  SETTINGS_CATEGORY_UPDATE_PATH,
  SETTINGS_LIST_PATH,
  SETTINGS_UPDATE_PATH,
  SETTINGS_ZONES_PATH,
  SETTINGS_ZONE_UPDATE_PATH,
} from '../../../config/settingsApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  CreateZonePayload,
  CreateZoneResponse,
  PlatformSettingsListResponse,
  ServiceCategoriesListResponse,
  ServiceZonesListResponse,
  SettingsCategoriesQueryParams,
  SettingsListQueryParams,
  SettingsZonesQueryParams,
  UpdateCategoryPayload,
  UpdateCategoryResponse,
  UpdateSettingPayload,
  UpdateSettingResponse,
  UpdateZonePayload,
  UpdateZoneResponse,
} from '../types/settings.types'

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

function jsonRequest<TPayload>(method: 'POST' | 'PUT', payload: TPayload) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }
}

async function getSettings(
  query: SettingsListQueryParams = {},
): Promise<PlatformSettingsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${SETTINGS_LIST_PATH}?${queryString}` : SETTINGS_LIST_PATH),
  )
  return parseJsonResponse<PlatformSettingsListResponse>(response)
}

async function updateSetting(
  settingKey: string,
  payload: UpdateSettingPayload,
): Promise<UpdateSettingResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_UPDATE_PATH(settingKey)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<UpdateSettingResponse>(response)
}

async function getCategories(
  query: SettingsCategoriesQueryParams = {},
): Promise<ServiceCategoriesListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${SETTINGS_CATEGORIES_PATH}?${queryString}` : SETTINGS_CATEGORIES_PATH),
  )
  return parseJsonResponse<ServiceCategoriesListResponse>(response)
}

async function updateCategory(
  categoryId: string,
  payload: UpdateCategoryPayload,
): Promise<UpdateCategoryResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_CATEGORY_UPDATE_PATH(categoryId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<UpdateCategoryResponse>(response)
}

async function getZones(
  query: SettingsZonesQueryParams = {},
): Promise<ServiceZonesListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${SETTINGS_ZONES_PATH}?${queryString}` : SETTINGS_ZONES_PATH),
  )
  return parseJsonResponse<ServiceZonesListResponse>(response)
}

async function createZone(payload: CreateZonePayload): Promise<CreateZoneResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_ZONES_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<CreateZoneResponse>(response)
}

async function updateZone(
  zoneId: string,
  payload: UpdateZonePayload,
): Promise<UpdateZoneResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_ZONE_UPDATE_PATH(zoneId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<UpdateZoneResponse>(response)
}

export const settingsService = {
  getSettings,
  updateSetting,
  getCategories,
  updateCategory,
  getZones,
  createZone,
  updateZone,
}
