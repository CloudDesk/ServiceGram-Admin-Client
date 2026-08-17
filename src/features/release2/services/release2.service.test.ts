import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../services/apiClient'
import { release2Service } from './release2.service'
import { Release2ServiceError } from '../types/release2.types'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const requestSpy = vi.spyOn(apiClient, 'request')

function lastCall() {
  const call = requestSpy.mock.calls.at(-1)

  if (!call) throw new Error('apiClient.request was not called.')

  return { url: call[0], init: call[1] }
}

function bodyOf(init: RequestInit | undefined) {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
}

beforeEach(() => {
  requestSpy.mockReset()
})

describe('release2Service request mapping', () => {
  it('sends list filters as query params and returns data, pagination and summary', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({
        success: true,
        code: 'FEATURE_FLAGS_LISTED',
        message: 'Feature flags loaded successfully.',
        data: [{ featureKey: 'customer.wallet' }],
        pagination: { page: 1, limit: 50, totalItems: 1, totalPages: 1 },
        summary: { totalFlags: 1, enabledCount: 0 },
      }),
    )

    const response = await release2Service.getFeatureFlags({
      page: 2,
      limit: 25,
      search: 'wallet',
      status: 'ENABLED',
      phase: 'PHASE_1',
      appType: 'CUSTOMER',
    })

    expect(lastCall().url).toBe(
      'http://localhost:4000/api/v1/admin/feature-flags?page=2&limit=25&search=wallet&status=ENABLED&phase=PHASE_1&appType=CUSTOMER',
    )
    expect(response.data).toHaveLength(1)
    expect(response.pagination.totalItems).toBe(1)
    expect(response.summary?.totalFlags).toBe(1)
  })

  it('url-encodes dotted feature keys in the detail path', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({ success: true, code: 'FEATURE_FLAG_LOADED', data: {} }),
    )

    await release2Service.getFeatureFlag('customer.promo_codes')

    expect(lastCall().url).toBe(
      'http://localhost:4000/api/v1/admin/feature-flags/customer.promo_codes',
    )
  })

  it('puts expectedVersion and reason on the update body', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({ success: true, code: 'FEATURE_FLAG_UPDATED', data: {} }),
    )

    await release2Service.updateFeatureFlag('customer.wallet', {
      status: 'ENABLED',
      rolloutPercentage: 25,
      expectedVersion: 3,
      reason: 'Enable wallet for controlled QA rollout.',
    })

    const { init, url } = lastCall()

    expect(url).toBe('http://localhost:4000/api/v1/admin/feature-flags/customer.wallet')
    expect(init?.method).toBe('PUT')
    expect(bodyOf(init)).toMatchObject({
      status: 'ENABLED',
      rolloutPercentage: 25,
      expectedVersion: 3,
      reason: 'Enable wallet for controlled QA rollout.',
    })
  })

  it('posts archive to the archive path with the version check payload', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({ success: true, code: 'FEATURE_FLAG_ARCHIVED', data: {} }),
    )

    await release2Service.archiveFeatureFlag('social.stories', {
      expectedVersion: 2,
      reason: 'Retired after Phase 2 redesign.',
    })

    const { init, url } = lastCall()

    expect(url).toBe(
      'http://localhost:4000/api/v1/admin/feature-flags/social.stories/archive',
    )
    expect(init?.method).toBe('POST')
    expect(bodyOf(init)).toEqual({
      expectedVersion: 2,
      reason: 'Retired after Phase 2 redesign.',
    })
  })

  it('replaces targets with a PUT carrying the full rule set', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({ success: true, code: 'FEATURE_FLAG_TARGETS_REPLACED', data: {} }),
    )

    await release2Service.replaceFeatureFlagTargets('customer.wallet', {
      expectedVersion: 4,
      reason: 'Limit to Bengaluru QA.',
      targets: [
        {
          effect: 'ALLOW',
          priority: 200,
          appType: 'CUSTOMER',
          city: 'Bengaluru',
          userSegment: 'RETURNING_CUSTOMER',
          isActive: true,
        },
      ],
    })

    const { init, url } = lastCall()

    expect(url).toBe(
      'http://localhost:4000/api/v1/admin/feature-flags/customer.wallet/targets',
    )
    expect(init?.method).toBe('PUT')
    expect(bodyOf(init).targets).toEqual([
      {
        effect: 'ALLOW',
        priority: 200,
        appType: 'CUSTOMER',
        city: 'Bengaluru',
        userSegment: 'RETURNING_CUSTOMER',
        isActive: true,
      },
    ])
  })

  it('previews a setting without saving it', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({
        success: true,
        code: 'RELEASE2_SETTING_PREVIEWED',
        data: {
          settingKey: 'loyalty.earn_bps_per_rupee',
          normalizedValue: 250,
          validationErrors: [],
          warnings: [],
          wouldRequireApproval: false,
          isValid: true,
        },
      }),
    )

    const response = await release2Service.previewRelease2Setting(
      'loyalty.earn_bps_per_rupee',
      250,
    )

    const { init, url } = lastCall()

    expect(url).toBe(
      'http://localhost:4000/api/v1/admin/release2/settings/loyalty.earn_bps_per_rupee/preview',
    )
    expect(init?.method).toBe('POST')
    expect(bodyOf(init)).toEqual({ value: 250 })
    expect(response.data.isValid).toBe(true)
  })
})

describe('release2Service error mapping', () => {
  it('preserves the backend code, status, details and fieldErrors', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          code: 'SETTING_VALIDATION_FAILED',
          message: 'The setting value failed validation.',
          details: {
            reason: 'Value must be at least 1.',
            action: 'Correct the value using the returned validation metadata.',
            fieldErrors: [
              {
                field: 'value',
                code: 'SETTING_VALIDATION_FAILED',
                message: 'Value must be at least 1.',
              },
            ],
          },
        },
        400,
      ),
    )

    const error = await release2Service
      .updateRelease2Setting('loyalty.redemption_bps', {
        value: 0,
        reason: 'Testing validation.',
        expectedVersion: 1,
      })
      .catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(Release2ServiceError)

    const serviceError = error as Release2ServiceError

    expect(serviceError.status).toBe(400)
    expect(serviceError.code).toBe('SETTING_VALIDATION_FAILED')
    // The most specific fieldError becomes the surfaced message.
    expect(serviceError.message).toBe('Value must be at least 1.')
    expect(serviceError.response?.details?.fieldErrors?.[0]?.field).toBe('value')
  })

  it('keeps the current version metadata from a stale-version conflict', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse(
        {
          success: false,
          code: 'FEATURE_FLAG_VERSION_CONFLICT',
          message: 'This feature flag was updated by someone else.',
          details: {
            reason: 'The expectedVersion does not match the current flag version.',
            action: 'Reload the flag and retry with the latest version.',
            metadata: { currentVersion: 7 },
          },
        },
        409,
      ),
    )

    const error = (await release2Service
      .updateFeatureFlag('customer.wallet', {
        expectedVersion: 3,
        reason: 'Stale write.',
      })
      .catch((thrown: unknown) => thrown)) as Release2ServiceError

    expect(error.status).toBe(409)
    expect(error.code).toBe('FEATURE_FLAG_VERSION_CONFLICT')
    expect(error.response?.details?.metadata?.currentVersion).toBe(7)
  })

  it('falls back to a status message when the body is empty', async () => {
    requestSpy.mockResolvedValue(new Response('', { status: 502 }))

    const error = (await release2Service
      .getOverview()
      .catch((thrown: unknown) => thrown)) as Release2ServiceError

    expect(error.code).toBe('REQUEST_FAILED')
    expect(error.message).toBe('Request failed with status 502.')
  })
})
