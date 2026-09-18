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
})
