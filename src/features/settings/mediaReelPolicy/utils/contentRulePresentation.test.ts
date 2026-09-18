import { describe, expect, it } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { DEFAULT_MEDIA_REEL_CONFIG } from '../types/mediaReelPolicy.types'
import {
  contentRuleStatusTone,
  formatReelDurationSummary,
  formatReelResolutionSummary,
  formatReelSizeSummary,
  isAppliedFirst,
  mapServerFieldToFormPath,
  policyActivationConflictDetail,
} from './contentRulePresentation'
import { SettingsServiceError } from '../../types/settings.types'

function buildRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    policyRuleId: 'rule-1',
    family: 'MEDIA_REEL_RULE',
    ruleKey: 'media.reels.global.global',
    displayName: 'Default content rules',
    description: null,
    status: 'ACTIVE',
    priority: 100,
    scope: { scopeType: 'GLOBAL', categoryId: null, city: null, zoneId: null, vendorId: null },
    config: DEFAULT_MEDIA_REEL_CONFIG as unknown as Record<string, unknown>,
    metadata: {},
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    availableActions: ['EDIT', 'ARCHIVE'],
    ...overrides,
  }
}

describe('contentRuleStatusTone', () => {
  it('maps ACTIVE/ARCHIVED/DRAFT to the expected badge tone', () => {
    expect(contentRuleStatusTone('ACTIVE')).toBe('success')
    expect(contentRuleStatusTone('ARCHIVED')).toBe('neutral')
    expect(contentRuleStatusTone('DRAFT')).toBe('warning')
  })
})

describe('human-readable summaries', () => {
  it('formats reel duration, size, and resolution from the raw config', () => {
    const rule = buildRule()

    expect(formatReelDurationSummary(rule)).toBe('1–60 sec')
    expect(formatReelSizeSummary(rule)).toBe('Up to 100 MB')
    expect(formatReelResolutionSummary(rule)).toBe('720×1280 – 2160×3840')
  })
})

describe('isAppliedFirst', () => {
  it('marks the active rule with the lowest priority number', () => {
    const first = buildRule({ policyRuleId: 'rule-first', priority: 10, status: 'ACTIVE' })
    const second = buildRule({ policyRuleId: 'rule-second', priority: 100, status: 'ACTIVE' })
    const rules = [first, second]

    expect(isAppliedFirst(first, rules)).toBe(true)
    expect(isAppliedFirst(second, rules)).toBe(false)
  })

  it('never marks an ARCHIVED or DRAFT rule as applied first', () => {
    const archived = buildRule({ priority: 1, status: 'ARCHIVED' })

    expect(isAppliedFirst(archived, [archived])).toBe(false)
  })
})

describe('mapServerFieldToFormPath', () => {
  it('maps known backend field paths to their form field', () => {
    expect(mapServerFieldToFormPath('config.minReelDurationSeconds')).toBe('reelDurationSeconds')
    expect(mapServerFieldToFormPath('scope.categoryId')).toBe('categoryId')
    expect(mapServerFieldToFormPath('displayName')).toBe('displayName')
  })

  it('returns null for an unmapped field so callers fall back to a banner', () => {
    expect(mapServerFieldToFormPath('ruleKey')).toBeNull()
    expect(mapServerFieldToFormPath('unknown.field')).toBeNull()
  })
})

describe('policyActivationConflictDetail', () => {
  it('reads the suggested priority and conflicting rules from the API error', () => {
    const error = new SettingsServiceError('Conflict', 409, 'POLICY_RULE_ACTIVATION_CONFLICT', {
      details: {
        reason: 'The active rules overlap.',
        metadata: {
          suggestedPriority: 99,
          conflictingRules: [
            {
              policyRuleId: 'rule-2',
              ruleKey: 'media.reels.global.second',
              displayName: 'Second rule',
              priority: 100,
              scope: {
                scopeType: 'GLOBAL',
                categoryId: null,
                city: null,
                zoneId: null,
                vendorId: null,
              },
              effectiveFrom: '2026-01-01T00:00:00.000Z',
              effectiveTo: null,
            },
          ],
        },
      },
    })

    expect(policyActivationConflictDetail(error)).toMatchObject({
      reason: 'The active rules overlap.',
      suggestedPriority: 99,
      conflicts: [{ displayName: 'Second rule' }],
    })
  })
})
