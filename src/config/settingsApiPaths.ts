export const SETTINGS_LIST_PATH = '/admin/settings'
export const SETTINGS_UPDATE_PATH = (settingKey: string) =>
  `/admin/settings/${encodeURIComponent(settingKey)}`
export const SETTINGS_CATEGORIES_PATH = '/admin/settings/categories'
export const SETTINGS_CATEGORY_UPDATE_PATH = (categoryId: string) =>
  `/admin/settings/categories/${categoryId}`
export const SETTINGS_ZONES_PATH = '/admin/settings/zones'
export const SETTINGS_ZONE_UPDATE_PATH = (zoneId: string) =>
  `/admin/settings/zones/${zoneId}`
