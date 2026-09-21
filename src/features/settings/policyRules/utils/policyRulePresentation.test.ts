import { describe, expect, it } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import {
  buildPolicyRuleAuditPath,
  getPolicyRuleScopeLabel,
  getPolicyRuleScopeTypeLabel,
  hasPolicyRuleAction,
  humanizeCode,
  policyRuleStatusTone,
} from './policyRulePresentation'

function buildRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    policyRuleId: 'rule-1',
    family: 'PRICING_RULE',
    ruleKey: 'pricing.global.phase1',
    displayName: 'Phase 1 global pricing',
    description: null,
    status: 'ACTIVE',
    priority: 100,
    scope: { scopeType: 'GLOBAL', categoryId: null, city: null, zoneId: null, vendorId: null },
    config: {},
    metadata: {},
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    availableActions: ['EDIT', 'ARCHIVE'],
    ...overrides,
  }
}

describe('humanizeCode', () => {
  it('title-cases snake/dot/kebab-separated codes', () => {
    expect(humanizeCode('PRICING_RULE')).toBe('Pricing Rule')
    expect(humanizeCode('media.reels.global')).toBe('Media Reels Global')
  })

  it('falls back to an em dash for empty values', () => {
    expect(humanizeCode(null)).toBe('—')
    expect(humanizeCode('')).toBe('—')
  })
})

describe('policyRuleStatusTone', () => {
  it('maps ACTIVE/ARCHIVED/DRAFT to the expected badge tone', () => {
    expect(policyRuleStatusTone('ACTIVE')).toBe('success')
    expect(policyRuleStatusTone('ARCHIVED')).toBe('neutral')
    expect(policyRuleStatusTone('DRAFT')).toBe('warning')
  })
})

describe('getPolicyRuleScopeLabel / getPolicyRuleScopeTypeLabel', () => {
  it('shows the scoped id/value, or Global for global rules', () => {
    expect(getPolicyRuleScopeLabel(buildRule())).toBe('Global')
    expect(getPolicyRuleScopeTypeLabel(buildRule())).toBe('Global')

    const cityRule = buildRule({
      scope: { scopeType: 'CITY', categoryId: null, city: 'Bengaluru', zoneId: null, vendorId: null },
    })
    expect(getPolicyRuleScopeLabel(cityRule)).toBe('Bengaluru')
    expect(getPolicyRuleScopeTypeLabel(cityRule)).toBe('City')
  })
})

describe('hasPolicyRuleAction', () => {
  it('reflects the backend-supplied availableActions', () => {
    const rule = buildRule({ availableActions: ['EDIT'] })
    expect(hasPolicyRuleAction(rule, 'EDIT')).toBe(true)
    expect(hasPolicyRuleAction(rule, 'ARCHIVE')).toBe(false)
  })
})

describe('buildPolicyRuleAuditPath', () => {
  it('builds an audit query scoped to this policy rule', () => {
    const path = buildPolicyRuleAuditPath(buildRule())
    expect(path).toContain('entityType=policy_rule')
    expect(path).toContain('entityId=rule-1')
  })
})
