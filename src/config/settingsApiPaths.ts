export const SETTINGS_LIST_PATH = '/admin/settings'
export const SETTINGS_DETAIL_PATH = (settingKey: string) =>
  `/admin/settings/${encodeURIComponent(settingKey)}`
export const SETTINGS_UPDATE_PATH = (settingKey: string) =>
  `/admin/settings/${encodeURIComponent(settingKey)}`
export const SETTINGS_CATEGORIES_PATH = '/admin/settings/categories'
export const SETTINGS_CATEGORY_DETAIL_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}`
export const SETTINGS_CATEGORY_UPDATE_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}`
export const SETTINGS_CATEGORY_IMAGE_UPLOAD_INTENT_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}/image/upload-intent`
export const SETTINGS_CATEGORY_IMAGE_CONFIRM_UPLOAD_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}/image/confirm`
export const SETTINGS_CATEGORY_IMAGE_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}/image`
export const SETTINGS_CATEGORY_SERVICE_TYPES_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}/service-types`
export const SETTINGS_SERVICE_TYPE_UPDATE_PATH = (serviceTypeId: string) =>
  `/admin/settings/service-types/${serviceTypeId}`
export const SETTINGS_POLICIES_PATH = '/admin/settings/policies'
export const SETTINGS_POLICY_PRICING_PREVIEW_PATH =
  '/admin/settings/policies/pricing-preview'
export const SETTINGS_ZONES_PATH = '/admin/settings/zones'
export const SETTINGS_ZONE_DETAIL_PATH = (zoneId: string) =>
  `/admin/settings/zones/${zoneId}`
export const SETTINGS_ZONE_UPDATE_PATH = (zoneId: string) =>
  `/admin/settings/zones/${zoneId}`
