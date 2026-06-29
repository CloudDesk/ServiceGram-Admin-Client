import { buildApiUrl } from '../../../config/api'
import {
  SETTINGS_CATEGORIES_PATH,
  SETTINGS_CATEGORY_SERVICE_TYPES_PATH,
  SETTINGS_CATEGORY_DETAIL_PATH,
  SETTINGS_CATEGORY_UPDATE_PATH,
  SETTINGS_DETAIL_PATH,
  SETTINGS_LIST_PATH,
  SETTINGS_POLICIES_PATH,
  SETTINGS_POLICY_PRICING_PREVIEW_PATH,
  SETTINGS_SERVICE_TYPE_UPDATE_PATH,
  SETTINGS_UPDATE_PATH,
  SETTINGS_ZONE_DETAIL_PATH,
  SETTINGS_ZONES_PATH,
  SETTINGS_ZONE_UPDATE_PATH,
} from '../../../config/settingsApiPaths'
import { apiClient } from '../../../services/apiClient'
import { buildQueryParams } from '../../../utils/buildQueryParams'
import type {
  CreateZonePayload,
  CreateZoneResponse,
  CreateServiceTypePayload,
  PolicyRuleResponse,
  PolicyRulesListResponse,
  PolicyRulesQueryParams,
  PlatformSettingResponse,
  PlatformSettingsListResponse,
  PricingPolicyPreviewPayload,
  PricingPolicyPreviewResponse,
  ServiceCategoryResponse,
  ServiceCategoriesListResponse,
  ServiceTypeResponse,
  ServiceTypesListResponse,
  ServiceZoneResponse,
  ServiceZonesListResponse,
  SettingsCategoriesQueryParams,
  SettingsApiErrorDetails,
  SettingsListQueryParams,
  SettingsServiceTypesQueryParams,
  SettingsZonesQueryParams,
  UpsertPolicyRulePayload,
  UpdateCategoryPayload,
  UpdateCategoryResponse,
  UpdateServiceTypePayload,
  UpdateSettingPayload,
  UpdateSettingResponse,
  UpdateZonePayload,
  UpdateZoneResponse,
} from '../types/settings.types'

interface ErrorEnvelope {
  message?: string
  error?: string
  code?: string
  details?: SettingsApiErrorDetails
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

async function getSettings(
  query: SettingsListQueryParams = {},
): Promise<PlatformSettingsListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(queryString ? `${SETTINGS_LIST_PATH}?${queryString}` : SETTINGS_LIST_PATH),
  )
  return parseJsonResponse<PlatformSettingsListResponse>(response)
}

async function getSetting(settingKey: string): Promise<PlatformSettingResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_DETAIL_PATH(settingKey)),
  )
  return parseJsonResponse<PlatformSettingResponse>(response)
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

async function getCategory(categoryId: string): Promise<ServiceCategoryResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_CATEGORY_DETAIL_PATH(categoryId)),
  )
  return parseJsonResponse<ServiceCategoryResponse>(response)
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

async function getServiceTypes(
  categoryId: string,
  query: SettingsServiceTypesQueryParams = {},
): Promise<ServiceTypesListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString
        ? `${SETTINGS_CATEGORY_SERVICE_TYPES_PATH(categoryId)}?${queryString}`
        : SETTINGS_CATEGORY_SERVICE_TYPES_PATH(categoryId),
    ),
  )
  return parseJsonResponse<ServiceTypesListResponse>(response)
}

async function createServiceType(
  categoryId: string,
  payload: CreateServiceTypePayload,
): Promise<ServiceTypeResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_CATEGORY_SERVICE_TYPES_PATH(categoryId)),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<ServiceTypeResponse>(response)
}

async function updateServiceType(
  serviceTypeId: string,
  payload: UpdateServiceTypePayload,
): Promise<ServiceTypeResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_SERVICE_TYPE_UPDATE_PATH(serviceTypeId)),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<ServiceTypeResponse>(response)
}

async function getPolicyRules(
  query: PolicyRulesQueryParams = {},
): Promise<PolicyRulesListResponse> {
  const queryString = buildQueryParams(query)
  const response = await apiClient.request(
    buildApiUrl(
      queryString ? `${SETTINGS_POLICIES_PATH}?${queryString}` : SETTINGS_POLICIES_PATH,
    ),
  )
  return parseJsonResponse<PolicyRulesListResponse>(response)
}

async function upsertPolicyRule(
  payload: UpsertPolicyRulePayload,
): Promise<PolicyRuleResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_POLICIES_PATH),
    jsonRequest('PUT', payload),
  )
  return parseJsonResponse<PolicyRuleResponse>(response)
}

async function previewPricingPolicy(
  payload: PricingPolicyPreviewPayload,
): Promise<PricingPolicyPreviewResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_POLICY_PRICING_PREVIEW_PATH),
    jsonRequest('POST', payload),
  )
  return parseJsonResponse<PricingPolicyPreviewResponse>(response)
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

async function getZone(zoneId: string): Promise<ServiceZoneResponse> {
  const response = await apiClient.request(
    buildApiUrl(SETTINGS_ZONE_DETAIL_PATH(zoneId)),
  )
  return parseJsonResponse<ServiceZoneResponse>(response)
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
  getSetting,
  updateSetting,
  getCategories,
  getCategory,
  updateCategory,
  getServiceTypes,
  createServiceType,
  updateServiceType,
  getPolicyRules,
  upsertPolicyRule,
  previewPricingPolicy,
  getZones,
  getZone,
  createZone,
  updateZone,
}
