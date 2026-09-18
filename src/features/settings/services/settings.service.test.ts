import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../services/apiClient'
import { SettingsServiceError } from '../types/settings.types'
import { settingsService } from './settings.service'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const requestSpy = vi.spyOn(apiClient, 'request')

beforeEach(() => {
  requestSpy.mockReset()
})

describe('settingsService.upsertPolicyRule', () => {
  it('throws a SettingsServiceError carrying the full fieldErrors array on a validation failure', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          code: 'VALIDATION_FAILED',
          message: 'Validation failed.',
          details: {
            fieldErrors: [
              { field: 'config.minReelDurationSeconds', code: 'too_small', message: 'Must be at least 1.' },
              { field: 'scope.categoryId', code: 'required', message: 'Category is required.' },
            ],
          },
        },
        422,
      ),
    )

    const call = settingsService.upsertPolicyRule({
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.global.global',
      displayName: 'Default content rules',
      reason: 'Initial rollout',
    })

    await expect(call).rejects.toBeInstanceOf(SettingsServiceError)
    await call.catch((error: unknown) => {
      const serviceError = error as SettingsServiceError
      expect(serviceError.message).toBe('Must be at least 1.')
      expect(serviceError.status).toBe(422)
      expect(serviceError.response?.details?.fieldErrors).toHaveLength(2)
    })
  })

  it('resolves with the upserted rule on success', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        code: 'POLICY_RULE_UPSERTED',
        message: 'ok',
        data: { policyRuleId: 'rule-1' },
      }),
    )

    const result = await settingsService.upsertPolicyRule({
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.global.global',
      displayName: 'Default content rules',
      reason: 'Initial rollout',
    })

    expect(result.data.policyRuleId).toBe('rule-1')
  })

  it('preserves activation-conflict guidance for the form', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          code: 'POLICY_RULE_ACTIVATION_CONFLICT',
          message: 'This policy conflicts with another active rule.',
          details: {
            reason: 'The rules overlap.',
            action: 'Choose another rule order.',
            metadata: {
              suggestedPriority: 99,
              conflictingRules: [
                {
                  policyRuleId: 'rule-existing',
                  displayName: 'Existing global rule',
                  priority: 100,
                },
              ],
            },
          },
        },
        409,
      ),
    )

    const call = settingsService.upsertPolicyRule({
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.global.second',
      displayName: 'Second global rule',
      status: 'ACTIVE',
      priority: 100,
      reason: 'Activate the second rule',
    })

    await expect(call).rejects.toMatchObject({
      code: 'POLICY_RULE_ACTIVATION_CONFLICT',
      response: {
        details: {
          metadata: {
            suggestedPriority: 99,
            conflictingRules: [
              expect.objectContaining({ displayName: 'Existing global rule' }),
            ],
          },
        },
      },
    })
  })

  it('sends expectedVersion when editing an existing rule and omits it on create', async () => {
    requestSpy.mockResolvedValue(
      jsonResponse({ success: true, code: 'POLICY_RULE_UPSERTED', message: 'ok', data: {} }),
    )

    await settingsService.upsertPolicyRule({
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.global.global',
      displayName: 'Default content rules',
      expectedVersion: 3,
      reason: 'Tweak limits',
    })
    const editBody = JSON.parse(String(requestSpy.mock.calls[0]?.[1]?.body))
    expect(editBody.expectedVersion).toBe(3)

    await settingsService.upsertPolicyRule({
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.global.new',
      displayName: 'New content rule',
      reason: 'Initial rollout',
    })
    const createBody = JSON.parse(String(requestSpy.mock.calls[1]?.[1]?.body))
    expect(createBody).not.toHaveProperty('expectedVersion')
  })

  it('surfaces a stale-version conflict with the live version', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          code: 'POLICY_RULE_VERSION_CONFLICT',
          message: 'This policy was updated by someone else.',
          details: {
            reason: 'The expectedVersion does not match the current policy version.',
            action: 'Reload the policy, review the latest changes, and try again.',
            metadata: { currentVersion: 5 },
          },
        },
        409,
      ),
    )

    const call = settingsService.upsertPolicyRule({
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.global.global',
      displayName: 'Default content rules',
      expectedVersion: 2,
      reason: 'Tweak limits',
    })

    await expect(call).rejects.toMatchObject({
      code: 'POLICY_RULE_VERSION_CONFLICT',
      status: 409,
      response: { details: { metadata: { currentVersion: 5 } } },
    })
  })
})

describe('settingsService.previewMediaPolicy', () => {
  it('posts the scope context to the media-preview endpoint and returns the effective policy', async () => {
    requestSpy.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        code: 'MEDIA_POLICY_PREVIEWED',
        message: 'ok',
        data: {
          context: { categoryId: 'cat-1', city: null, zoneId: null, vendorId: null },
          evaluatedAt: '2026-01-01T00:00:00.000Z',
          effectivePolicy: {
            ruleId: 'rule-1',
            ruleKey: 'media.reels.category.cat-1',
            displayName: 'Grooming reels',
            version: 1,
            source: 'POLICY_RULE',
            config: {},
          },
          candidates: [],
          selectionReason: 'The active applicable rule with the lowest priority number was selected.',
          warnings: [],
        },
      }),
    )

    const result = await settingsService.previewMediaPolicy({ categoryId: 'cat-1' })

    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('/admin/settings/policies/media-preview'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ categoryId: 'cat-1' }) }),
    )
    expect(result.data.effectivePolicy.displayName).toBe('Grooming reels')
  })
})
