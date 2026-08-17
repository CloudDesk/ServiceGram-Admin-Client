/**
 * Admin-facing copy for approval configuration.
 *
 * The API speaks in enum codes (`CLAIM_THEN_DECIDE`, `MIN_N_APPROVER_POOL_MAY_BE_TOO_SMALL`).
 * Nothing in this module should reach the screen unmapped — `humanizeCode` only
 * title-cases a code, which still leaves an operations lead reading machine words.
 * Every lookup falls back to `humanizeCode` so an unseeded code degrades instead
 * of rendering blank.
 */

import { humanizeCode } from './components/sharedUtils'

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const workflowStatusLabels: Record<string, string> = {
  ACTIVE: 'Live',
  ARCHIVED: 'Archived',
  DRAFT: 'Draft',
  INACTIVE: 'Paused',
}

const versionStatusLabels: Record<string, string> = {
  ARCHIVED: 'Archived',
  DEACTIVATED: 'Retired',
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
}

export function workflowStatusLabel(status: string) {
  return workflowStatusLabels[status] ?? humanizeCode(status)
}

export function versionStatusLabel(status: string) {
  return versionStatusLabels[status] ?? humanizeCode(status)
}

// ─── Stages and approvers ─────────────────────────────────────────────────────

const decisionPolicyLabels: Record<string, string> = {
  ALL: 'Everyone must approve',
  ANY_ONE: 'Any one approver',
  CLAIM_THEN_DECIDE: 'One approver takes ownership',
  MIN_N: 'A minimum number must approve',
}

const resolverTypeLabels: Record<string, string> = {
  CATEGORY_OWNER: 'Category owner',
  LOCATION_OWNER: 'City owner',
  PERMISSION: 'Anyone with permission',
  ROLE: 'Role',
  STATIC_FALLBACK: 'Backup approver',
  TEAM: 'Team',
  USER: 'Specific person',
}

const autoDecisionLabels: Record<string, string> = {
  APPROVE: 'Approved automatically',
  REJECT: 'Rejected automatically',
  RETURN_FOR_CORRECTION: 'Sent back automatically',
}

/**
 * Describes a decision policy in one phrase, folding the approval count in when
 * the policy is the only place it means anything.
 */
export function decisionPolicyLabel(policy: string, minApprovals = 1) {
  if (policy === 'MIN_N') return `At least ${minApprovals} must approve`
  return decisionPolicyLabels[policy] ?? humanizeCode(policy)
}

export function resolverTypeLabel(resolverType: string) {
  return resolverTypeLabels[resolverType] ?? humanizeCode(resolverType)
}

export function autoDecisionLabel(decision: null | string) {
  if (!decision) return 'Decided without review'
  return autoDecisionLabels[decision] ?? humanizeCode(decision)
}

/**
 * The approver a resolver rule points at, named the way an admin would say it —
 * "Finance admin", not "Role: Finance Admin".
 */
export function approverLabel(
  resolverType: string,
  resolverConfig: Record<string, unknown> = {},
) {
  const { adminUserId, categoryField, locationField, permissionCode, roleCode, teamCode } =
    resolverConfig

  if (typeof roleCode === 'string') return humanizeCode(roleCode)
  if (typeof teamCode === 'string') return humanizeCode(teamCode)
  // The action half of a permission code carries the meaning: `payments:refund`
  // is "whoever can refund", not "Payments".
  if (typeof permissionCode === 'string') {
    const [module, action] = permissionCode.split(':')
    return action ? `Can ${humanizeCode(action).toLowerCase()} ${humanizeCode(module).toLowerCase()}` : humanizeCode(permissionCode)
  }
  if (typeof locationField === 'string') return 'City owner'
  if (typeof categoryField === 'string') return 'Category owner'
  if (typeof adminUserId === 'string') return 'Named admin'
  return resolverTypeLabel(resolverType)
}

// ─── Escalation ───────────────────────────────────────────────────────────────

const escalationActionLabels: Record<string, string> = {
  ADD_APPROVER: 'Bring in',
  AUTO_APPROVE: 'Approve automatically',
  AUTO_REJECT: 'Reject automatically',
  ESCALATE: 'Escalate to',
  NOTIFY: 'Remind',
  REASSIGN: 'Hand over to',
}

export function escalationActionLabel(action: string) {
  return escalationActionLabels[action] ?? humanizeCode(action)
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

const riskLabels: Record<string, string> = {
  CRITICAL: 'Critical risk',
  HIGH: 'High risk',
  LOW: 'Low risk',
  MEDIUM: 'Medium risk',
}

export const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export function riskLabel(level: string) {
  return riskLabels[level] ?? humanizeCode(level)
}

/** 1–4, for the four-step risk meter. Unknown levels sit at the bottom step. */
export function riskStep(level: string) {
  const index = riskLevels.indexOf(level)
  return index === -1 ? 1 : index + 1
}

// ─── Validation issues ────────────────────────────────────────────────────────

/**
 * Plain-language rewrites of the codes emitted by `ApprovalsService.validateBundle`.
 * The API message is kept as supporting detail; this is the headline.
 */
const issueLabels: Record<string, string> = {
  APPROVAL_RUNTIME_NOT_ENABLED: 'Approvals are not enforced yet',
  APPROVER_RESOLVER_CONFIG_MISSING: 'An approver is not fully set up',
  AUTO_DECISION_RULE_HAS_STAGES: 'An automatic rule also asks for review',
  CONDITION_FIELD_INVALID: 'A condition is missing its field',
  CONDITION_NODE_INVALID: 'A condition is malformed',
  CONDITION_NODE_UNRECOGNIZED: 'A condition uses an unsupported shape',
  CONDITION_OPERATOR_INVALID: 'A condition is missing its comparison',
  CONDITION_OPERATOR_NOT_ALLOWED: 'A comparison is not allowed on that field',
  DUPLICATE_RULE_PRIORITY: 'Two rules share the same priority',
  ESCALATION_TARGET_MISSING: 'An escalation has nobody to escalate to',
  INACTIVE_CONDITION_FIELD: 'A condition uses a retired field',
  INACTIVE_FINAL_ACTION: 'A rule ends in a retired action',
  INVALID_AUTO_DECISION: 'An automatic decision is not supported',
  MANUAL_RULE_HAS_NO_STAGES: 'A rule needs review but has no stages',
  MIN_N_APPROVER_POOL_MAY_BE_TOO_SMALL: 'More approvals required than approvers configured',
  NO_RULES_CONFIGURED: 'This version has no rules',
  STAGE_HAS_NO_APPROVERS: 'A stage has no approvers',
  UNKNOWN_CONDITION_FIELD: 'A condition uses an unknown field',
  UNKNOWN_FINAL_ACTION: 'A rule ends in an unknown action',
  VERSION_IS_DRAFT: 'This version is still a draft',
}

export function issueLabel(code: string) {
  return issueLabels[code] ?? humanizeCode(code)
}

/**
 * Turns a validation path (`rules.refund.finance.standard.stages.finance_review.approvers`)
 * into a breadcrumb an admin can follow back to the node.
 */
export function issueLocation(path: string) {
  const segments = path.split('.')
  if (segments[0] !== 'rules' || segments.length < 2) return humanizeCode(path)

  const stageIndex = segments.indexOf('stages')
  const ruleKey = segments.slice(1, stageIndex === -1 ? undefined : stageIndex).join('.')
  const parts = [`Rule: ${humanizeCode(ruleKey)}`]

  if (stageIndex !== -1 && segments[stageIndex + 1]) {
    parts.push(`Stage: ${humanizeCode(segments[stageIndex + 1])}`)
  }

  return parts.join(' › ')
}

// ─── Runtime ──────────────────────────────────────────────────────────────────

export const runtimeNotice =
  'Workflows here describe how approvals should route. The engine that runs them is not built yet, so these rules do not enforce anything today.'
