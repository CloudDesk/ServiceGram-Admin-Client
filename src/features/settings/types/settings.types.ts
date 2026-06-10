import type { ApiErrorDetails } from '../../../types/api.types'

export type SettingsRecordType = 'settings' | 'categories' | 'zones'

export interface SettingsListQueryParams {
  page?: number
  limit?: number
  category?: string
  isEditable?: boolean
  search?: string
}

export interface SettingsCategoriesQueryParams {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
}

export interface SettingsZonesQueryParams extends SettingsCategoriesQueryParams {
  city?: string
}

export interface UpdateSettingPayload {
  value: unknown
  reason?: string
}

export interface UpdateCategoryPayload {
  name?: string
  description?: string | null
  iconAssetId?: string | null
  isActive?: boolean
  displayOrder?: number
  reason?: string
}

export interface CreateZonePayload {
  city: string
  zoneName: string
  pincodeList?: string[] | null
  isActive?: boolean
  metadata?: Record<string, unknown>
  reason?: string
}

export type UpdateZonePayload = Partial<CreateZonePayload>

export interface SettingsPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface PlatformSetting {
  settingId: string
  settingKey: string
  category: string
  displayName: string
  description: string | null
  valueType: string
  value: unknown
  defaultValue: unknown
  isValueMasked: boolean
  isEditable: boolean
  isSensitive: boolean
  updatedByAdminId: string | null
  createdAt: string
  updatedAt: string
}

export interface ServiceCategory {
  categoryId: string
  categoryCode: string
  name: string
  description: string | null
  iconAssetId: string | null
  isActive: boolean
  displayOrder: number
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export interface ServiceZone {
  zoneId: string
  city: string
  zoneName: string
  pincodeList: string[]
  isActive: boolean
  metadata: Record<string, unknown>
  warnings: string[]
  availableActions: string[]
  nextRecommendedAction: string | null
  createdAt: string
  updatedAt: string
}

export type SettingsRecord = PlatformSetting | ServiceCategory | ServiceZone

export interface SettingsApiResponse<TData> {
  success?: boolean
  code?: string
  message?: string
  data: TData
  meta?: {
    requestId?: string
    timestamp?: string
    path?: string
    method?: string
    durationMs?: number
    apiVersion?: string
  }
}

export interface PlatformSettingsListResponse extends SettingsApiResponse<PlatformSetting[]> {
  data: PlatformSetting[]
  pagination: SettingsPagination
}

export interface ServiceCategoriesListResponse extends SettingsApiResponse<ServiceCategory[]> {
  data: ServiceCategory[]
  pagination: SettingsPagination
}

export interface ServiceZonesListResponse extends SettingsApiResponse<ServiceZone[]> {
  data: ServiceZone[]
  pagination: SettingsPagination
}

export type UpdateSettingResponse = SettingsApiResponse<PlatformSetting>
export type UpdateCategoryResponse = SettingsApiResponse<ServiceCategory>
export type CreateZoneResponse = SettingsApiResponse<ServiceZone>
export type UpdateZoneResponse = SettingsApiResponse<ServiceZone>

export interface SettingsApiErrorDetails extends ApiErrorDetails {
  fieldErrors?: {
    field: string
    code: string
    message: string
  }[]
}
