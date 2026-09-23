import { routePaths } from '../../../../config/routes'
import type { StatusTone } from '../../../../types/status.types'
import type { PolicyRule, PolicyStatus } from '../../types/settings.types'

export function humanizeCode(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .replaceAll(/[._:-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function policyRuleStatusTone(status: PolicyStatus): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

export function getPolicyRuleScopeLabel(rule: PolicyRule) {
  const { scope } = rule
  if (scope.scopeType === 'GLOBAL') return 'Global'
  if (scope.scopeType === 'CATEGORY') return scope.categoryId ?? 'Category scope'
  if (scope.scopeType === 'CITY') return scope.city ?? 'City scope'
  if (scope.scopeType === 'ZONE') return scope.zoneId ?? 'Zone scope'
  return scope.vendorId ?? 'Vendor scope'
}

export function getPolicyRuleScopeTypeLabel(rule: PolicyRule) {
  return humanizeCode(rule.scope.scopeType)
}

export function hasPolicyRuleAction(rule: PolicyRule, action: 'EDIT' | 'ACTIVATE' | 'ARCHIVE') {
  return rule.availableActions.includes(action)
}

export function buildPolicyRuleAuditPath(rule: PolicyRule) {
  const params = new URLSearchParams({
    moduleCode: 'settings',
    entityType: 'policy_rule',
    entityId: rule.policyRuleId,
  })
  return `${routePaths.audit}?${params.toString()}`
}
