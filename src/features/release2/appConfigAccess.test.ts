import { describe, expect, it } from 'vitest'
import {
  enabledFeatureKeys,
  isFeatureEnabledInConfig,
  release2ClientAccess,
} from './appConfigAccess'
import type { AppConfig, AppConfigResponse } from './types/release2.types'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    appType: 'CUSTOMER',
    available: true,
    serverTime: '2026-08-17T10:00:00.000Z',
    configVersion: 'abc123',
    features: {
      'customer.wallet': { enabled: true, reason: 'TARGET_ALLOW' },
      'customer.loyalty': { enabled: false, reason: 'FLAG_DISABLED' },
    },
    settings: {},
    localeDefault: 'en',
    supportedLocales: ['en', 'ta'],
    warnings: [],
    ...overrides,
  }
}

/** Matches the real placeholder payload from GET /app-config/delivery. */
const deliveryUnavailableResponse: AppConfigResponse = {
  success: true,
  code: 'APP_CONFIG_DELIVERY_UNAVAILABLE',
  message: 'Delivery app config is reserved for a later integration.',
  data: {
    appType: 'DELIVERY',
    available: false,
    serverTime: '2026-08-17T10:00:00.000Z',
    configVersion: 'delivery-unavailable',
    features: {},
    settings: {},
    localeDefault: 'en',
    supportedLocales: ['en', 'ta'],
    warnings: [
      'Delivery partner identity is a later integration and is not available in this backend.',
    ],
  },
}

describe('isFeatureEnabledInConfig', () => {
  it('trusts only the backend verdict for the requested key', () => {
    expect(isFeatureEnabledInConfig(config(), 'customer.wallet')).toBe(true)
    expect(isFeatureEnabledInConfig(config(), 'customer.loyalty')).toBe(false)
  })

  it('returns false for keys the config does not mention', () => {
    expect(isFeatureEnabledInConfig(config(), 'social.stories')).toBe(false)
  })

  it('returns false when there is no config yet', () => {
    expect(isFeatureEnabledInConfig(null, 'customer.wallet')).toBe(false)
    expect(isFeatureEnabledInConfig(undefined, 'customer.wallet')).toBe(false)
  })

  it('enables nothing when the config is unavailable, even if features say enabled', () => {
    const unavailable = config({
      available: false,
      features: { 'delivery.partner_app': { enabled: true, reason: 'TARGET_ALLOW' } },
    })

    expect(isFeatureEnabledInConfig(unavailable, 'delivery.partner_app')).toBe(false)
    expect(enabledFeatureKeys(unavailable)).toEqual([])
  })
})

describe('release2ClientAccess', () => {
  it('summarises an available config', () => {
    const access = release2ClientAccess({
      success: true,
      code: 'APP_CONFIG_LOADED',
      message: 'Public app config loaded successfully.',
      data: config({ appType: 'PUBLIC' }),
    })

    expect(access.available).toBe(true)
    expect(access.enabledFeatureCount).toBe(1)
    expect(access.totalFeatureCount).toBe(2)
    expect(access.configVersion).toBe('abc123')
  })

  it('reports delivery as unavailable with the backend code and warning', () => {
    const access = release2ClientAccess(deliveryUnavailableResponse)

    expect(access.available).toBe(false)
    expect(access.code).toBe('APP_CONFIG_DELIVERY_UNAVAILABLE')
    expect(access.message).toBe(
      'Delivery partner identity is a later integration and is not available in this backend.',
    )
    expect(access.enabledFeatureCount).toBe(0)
  })

  it('treats a missing response as unavailable', () => {
    const access = release2ClientAccess(null)

    expect(access.available).toBe(false)
    expect(access.code).toBeNull()
    expect(access.totalFeatureCount).toBe(0)
  })
})
