export const RELEASE2_OVERVIEW_PATH = '/admin/release2/overview'

export const FEATURE_FLAGS_PATH = '/admin/feature-flags'
export const FEATURE_FLAG_DETAIL_PATH = (featureKey: string) =>
  `/admin/feature-flags/${encodeURIComponent(featureKey)}`
export const FEATURE_FLAG_HISTORY_PATH = (featureKey: string) =>
  `/admin/feature-flags/${encodeURIComponent(featureKey)}/history`
export const FEATURE_FLAG_ARCHIVE_PATH = (featureKey: string) =>
  `/admin/feature-flags/${encodeURIComponent(featureKey)}/archive`
export const FEATURE_FLAG_TARGETS_PATH = (featureKey: string) =>
  `/admin/feature-flags/${encodeURIComponent(featureKey)}/targets`
export const FEATURE_FLAG_EVALUATE_PATH = (featureKey: string) =>
  `/admin/feature-flags/${encodeURIComponent(featureKey)}/evaluate`

export const RELEASE2_SETTINGS_PATH = '/admin/release2/settings'
export const RELEASE2_SETTING_DETAIL_PATH = (settingKey: string) =>
  `/admin/release2/settings/${encodeURIComponent(settingKey)}`
export const RELEASE2_SETTING_PREVIEW_PATH = (settingKey: string) =>
  `/admin/release2/settings/${encodeURIComponent(settingKey)}/preview`

export const APP_CONFIG_PUBLIC_PATH = '/app-config/public'
export const APP_CONFIG_CUSTOMER_PATH = '/app-config/customer'
export const APP_CONFIG_VENDOR_PATH = '/app-config/vendor'
export const APP_CONFIG_INFLUENCER_PATH = '/app-config/influencer'
export const APP_CONFIG_DELIVERY_PATH = '/app-config/delivery'
