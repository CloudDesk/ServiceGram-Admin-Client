import type { AppConfig, AppConfigResponse } from './types/release2.types'

/**
 * An unavailable app config enables nothing, whatever `features` contains.
 * Feature hiding is presentation only — the backend still authorizes actions.
 */
export function isFeatureEnabledInConfig(
  config: AppConfig | null | undefined,
  featureKey: string,
) {
  if (!config?.available) return false

  return config.features[featureKey]?.enabled === true
}

export function enabledFeatureKeys(config: AppConfig | null | undefined) {
  if (!config?.available) return []

  return Object.entries(config.features)
    .filter(([, feature]) => feature.enabled)
    .map(([featureKey]) => featureKey)
}

export interface Release2ClientAccess {
  available: boolean
  code: string | null
  message: string | null
  enabledFeatureCount: number
  totalFeatureCount: number
  configVersion: string | null
}

/**
 * Collapses an app-config response into what the admin needs to see. Delivery
 * currently answers `APP_CONFIG_DELIVERY_UNAVAILABLE` with `available=false`,
 * which must read as "no delivery Release 2 screens" rather than as an error.
 */
export function release2ClientAccess(
  response: AppConfigResponse | null | undefined,
): Release2ClientAccess {
  const config = response?.data ?? null

  return {
    available: config?.available === true,
    code: response?.code ?? null,
    message: config?.warnings[0] ?? response?.message ?? null,
    enabledFeatureCount: enabledFeatureKeys(config).length,
    totalFeatureCount: config ? Object.keys(config.features).length : 0,
    configVersion: config?.configVersion ?? null,
  }
}
