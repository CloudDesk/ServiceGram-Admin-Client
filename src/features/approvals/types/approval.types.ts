import type { ApiErrorDetails, ApiErrorResponse } from '../../../types/api.types'
import type { StatusTone } from '../../../types/status.types'

export type ApprovalWorkflowStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type ApprovalWorkflowVersionStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'DEACTIVATED'
  | 'ARCHIVED'
export type ApprovalRuntimeMode = 'CONFIGURATION_ONLY' | 'SIMULATION_ONLY'
export type ApprovalIssueSeverity = 'ERROR' | 'WARNING'

export interface ApprovalPaginationMeta {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ApprovalLifecycle {
  createdAt: string | null
  updatedAt: string | null
}

export interface ApprovalWorkflowVersionSummary {
  versionId: string
  versionNumber: number
  status: ApprovalWorkflowVersionStatus
  definitionHash: string
  effectiveFrom: string | null
  effectiveTo: string | null
  publishedAt: string | null
  deactivatedAt: string | null
  lifecycle: ApprovalLifecycle
}

export interface ApprovalWorkflowListItem {
  workflowId: string
  workflowCode: string
  moduleCode: string
  triggerEvent: string
  displayName: string
  description: string
  status: ApprovalWorkflowStatus
  latestPublishedVersion: ApprovalWorkflowVersionSummary | null
  counts: {
    rules: number
    stages: number
  }
  /** False means this trigger is configured but dormant — no context builder is wired, so it never evaluates. */
  isTriggerRoutable: boolean
  runtimeMode: ApprovalRuntimeMode
  metadata: Record<string, unknown>
  lifecycle: ApprovalLifecycle
  warnings: string[]
  blockingReasons: string[]
  availableActions: string[]
  nextRecommendedAction: string
}

export interface ApprovalWorkflowListSummary {
  totalMatching: number
  visibleWorkflows: number
  runtimeMode: ApprovalRuntimeMode
  filtersApplied: {
    status: ApprovalWorkflowStatus | null
    moduleCode: string | null
    triggerEvent: string | null
    search: string | null
  }
}

export interface ApprovalWorkflowsListResponse {
  code: string
  message: string
  data: ApprovalWorkflowListItem[]
  pagination: ApprovalPaginationMeta
  summary: ApprovalWorkflowListSummary
}

export interface ApprovalApproverRule {
  approverRuleId: string
  resolverType: string
  resolverConfig: Record<string, unknown>
  approverKind: string
  fallbackOrder: number | null
  excludeInitiator: boolean
  requireRecentAuth: boolean
  metadata: Record<string, unknown>
}

export interface ApprovalEscalationRule {
  escalationRuleId: string
  trigger: string
  afterMinutes: number
  action: string
  targetResolverType: string | null
  targetResolverConfig: Record<string, unknown>
  maxEscalations: number | null
  metadata: Record<string, unknown>
}

export interface ApprovalStage {
  stageId: string
  stageKey: string
  stageOrder: number
  stageName: string
  stageMode: string
  decisionPolicy: string
  minApprovals: number
  slaMinutes: number | null
  allowReturnForCorrection: boolean
  metadata: Record<string, unknown>
  approvers: ApprovalApproverRule[]
  escalations: ApprovalEscalationRule[]
}

export interface ApprovalRule {
  ruleId: string
  ruleKey: string
  displayName: string
  description: string
  priority: number
  matchMode: string
  conditionJson: Record<string, unknown>
  finalActionCode: string
  autoDecision: string | null
  metadata: Record<string, unknown>
  stages: ApprovalStage[]
}

export interface ApprovalWorkflowVersionDetail extends ApprovalWorkflowVersionSummary {
  counts: {
    rules: number
    stages: number
  }
  rules: ApprovalRule[]
  availableActions: string[]
  nextRecommendedAction: string
}

export interface ApprovalWorkflowDetail {
  workflowId: string
  workflowCode: string
  moduleCode: string
  triggerEvent: string
  displayName: string
  description: string
  status: ApprovalWorkflowStatus
  latestPublishedVersionId: string | null
  /** False means this trigger is configured but dormant — no context builder is wired, so it never evaluates. */
  isTriggerRoutable: boolean
  runtimeMode: ApprovalRuntimeMode
  metadata: Record<string, unknown>
  versions: ApprovalWorkflowVersionDetail[]
  lifecycle: ApprovalLifecycle
  warnings: string[]
  blockingReasons: string[]
  availableActions: string[]
  nextRecommendedAction: string
}

export interface ApprovalWorkflowDetailResponse {
  code: string
  message: string
  data: ApprovalWorkflowDetail
}

export interface ApprovalConditionField {
  fieldId: string
  moduleCode: string
  triggerEvent: string
  fieldPath: string
  label: string
  dataType: string
  allowedOperators: string[]
  allowedValuesSource: Record<string, unknown>
  isSensitive: boolean
  isActive: boolean
  metadata: Record<string, unknown>
}

export interface ApprovalActionTemplate {
  actionTemplateId: string
  actionCode: string
  moduleCode: string
  entityType: string
  displayName: string
  description: string
  serviceAdapterKey: string
  requiredPermissionCode: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string
  finalState: string
  isActive: boolean
  metadata: Record<string, unknown>
  availableActions: string[]
}

export interface ApprovalRegistrySummary {
  totalMatching: number
  runtimeMode: ApprovalRuntimeMode
  modules: string[]
  triggers?: string[]
  riskLevels?: string[]
  visibleFields?: number
  visibleTemplates?: number
}

export interface ApprovalConditionFieldsResponse {
  code: string
  message: string
  data: ApprovalConditionField[]
  pagination: ApprovalPaginationMeta
  summary: ApprovalRegistrySummary
}

export interface ApprovalActionTemplatesResponse {
  code: string
  message: string
  data: ApprovalActionTemplate[]
  pagination: ApprovalPaginationMeta
  summary: ApprovalRegistrySummary
}

export interface ApprovalVersionValidationIssue {
  code: string
  message: string
  path: string
  severity: ApprovalIssueSeverity
}

export interface ApprovalValidationSummary {
  valid: boolean
  errors: ApprovalVersionValidationIssue[]
  warnings: ApprovalVersionValidationIssue[]
  blockingReasons: string[]
}

export interface ApprovalValidationData extends ApprovalValidationSummary {
  workflow: Pick<
    ApprovalWorkflowListItem,
    'workflowId' | 'workflowCode' | 'moduleCode' | 'triggerEvent' | 'displayName' | 'status'
  >
  version: ApprovalWorkflowVersionSummary
  runtimeMode: ApprovalRuntimeMode
  counts: {
    rules: number
    stages: number
    approverRules: number
    escalationRules: number
  }
  availableActions: string[]
  nextRecommendedAction: string
  checkedAt: string
}

export interface ApprovalValidationResponse {
  code: string
  message: string
  data: ApprovalValidationData
}

export interface ApprovalConditionEvaluation {
  matched: boolean
  path?: string
  reason?: string
  field?: string
  op?: string
  expected?: unknown
  actual?: unknown
  children?: ApprovalConditionEvaluation[]
}

export interface ApprovalRuleEvaluation {
  ruleId: string
  ruleKey: string
  displayName: string
  priority: number
  matched: boolean
  evaluation: ApprovalConditionEvaluation
}

export interface ApprovalSimulationData {
  workflow: ApprovalValidationData['workflow']
  version: ApprovalWorkflowVersionSummary
  runtimeMode: ApprovalRuntimeMode
  matched: boolean
  matchedRule: ApprovalRule | null
  actionPreview: ApprovalActionTemplate | null
  stagePreview: ApprovalStage[]
  ruleEvaluations: ApprovalRuleEvaluation[]
  validation: ApprovalValidationSummary
  warnings: string[]
  blockingReasons: string[]
  availableActions: string[]
  nextRecommendedAction: string
  checkedAt: string
}

export interface ApprovalSimulationResponse {
  code: string
  message: string
  data: ApprovalSimulationData
}

export interface ApprovalWorkflowsQueryParams {
  page?: number
  limit?: number
  status?: ApprovalWorkflowStatus
  moduleCode?: string
  triggerEvent?: string
  search?: string
}

export interface ApprovalRegistryQueryParams {
  page?: number
  limit?: number
  moduleCode?: string
  triggerEvent?: string
  isActive?: boolean
  search?: string
}

export interface ApprovalSimulationPayload {
  context: Record<string, unknown>
}

// ─── Definition write API ───────────────────────────────────────────────────

/** Matches the operator set ApprovalsService.evaluateLeaf implements backend-side. */
export const approvalConditionOperators = [
  'eq',
  'neq',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'is_true',
  'is_false',
  'is_empty',
  'is_not_empty',
  'contains',
] as const
export type ApprovalConditionOperator = (typeof approvalConditionOperators)[number]

export const approvalRuleMatchModes = ['FIRST_MATCH', 'MOST_RESTRICTIVE'] as const
export const approvalStageModes = ['SEQUENTIAL', 'PARALLEL'] as const
export const approvalDecisionPolicies = [
  'ANY_ONE',
  'ALL',
  'MIN_N',
  'CLAIM_THEN_DECIDE',
] as const
export const approvalResolverTypes = [
  'USER',
  'ROLE',
  'PERMISSION',
  'TEAM',
  'LOCATION_OWNER',
  'CATEGORY_OWNER',
  'STATIC_FALLBACK',
] as const
/** The runtime resolver only ever checks approverKind === 'FALLBACK'; nothing else is meaningful. */
export const approvalApproverKinds = ['PRIMARY', 'FALLBACK'] as const

export interface ApprovalConditionLeafInput {
  field: string
  op: ApprovalConditionOperator
  value: unknown
}

export interface ApprovalApproverRuleInput {
  resolverType: (typeof approvalResolverTypes)[number]
  resolverConfig: Record<string, unknown>
  approverKind: (typeof approvalApproverKinds)[number]
  fallbackOrder: number
  excludeInitiator: boolean
  requireRecentAuth: boolean
}

export interface ApprovalEscalationRuleInput {
  trigger: string
  afterMinutes: number
  action: string
  targetResolverType?: (typeof approvalResolverTypes)[number]
  targetResolverConfig: Record<string, unknown>
  maxEscalations: number
}

export interface ApprovalStageInput {
  stageKey: string
  stageOrder: number
  stageName: string
  stageMode: (typeof approvalStageModes)[number]
  decisionPolicy: (typeof approvalDecisionPolicies)[number]
  minApprovals: number
  slaMinutes?: number
  allowReturnForCorrection: boolean
  approverRules: ApprovalApproverRuleInput[]
  escalationRules: ApprovalEscalationRuleInput[]
}

export interface ApprovalRuleInput {
  ruleKey: string
  displayName: string
  description?: string
  priority: number
  conditionJson: { all: ApprovalConditionLeafInput[] }
  matchMode: (typeof approvalRuleMatchModes)[number]
  finalActionCode: string
  autoDecision?: string
  stages: ApprovalStageInput[]
}

export interface CreateApprovalWorkflowPayload {
  workflowCode: string
  moduleCode: string
  triggerEvent: string
  displayName: string
  description?: string
}

export interface UpdateApprovalWorkflowMetaPayload {
  displayName?: string
  description?: string
}

export interface CreateApprovalWorkflowVersionDraftPayload {
  cloneFromVersionId?: string
}

export interface ReplaceApprovalWorkflowVersionDefinitionPayload {
  rules: ApprovalRuleInput[]
  reason: string
  expectedDefinitionHash: string
}

export interface PublishApprovalWorkflowVersionPayload {
  reason: string
}

export interface DeactivateApprovalWorkflowVersionPayload {
  reason: string
}

export interface DeleteApprovalWorkflowPayload {
  reason: string
}

export interface ApprovalWorkflowDeleteResponse {
  code: string
  message: string
  data: {
    workflowId: string
    workflowCode: string
  }
}

export interface ApprovalErrorDetails extends ApiErrorDetails {
  metadata?: {
    currentStatus?: ApprovalWorkflowVersionStatus
    errors?: ApprovalVersionValidationIssue[]
    [key: string]: unknown
  }
}

export type ApprovalErrorResponse = ApiErrorResponse<ApprovalErrorDetails>

/**
 * Carries the structured backend envelope (code, field errors, conflict
 * metadata) instead of collapsing straight to a message string, so the
 * write-flow UI (409 version conflicts, 422 publish-blocked-by-validation)
 * can react to `.code`/`.response.details` instead of parsing prose.
 */
export class ApprovalServiceError extends Error {
  status: number
  code: string
  response: ApprovalErrorResponse | null

  constructor(
    message: string,
    status: number,
    code: string,
    response: ApprovalErrorResponse | null,
  ) {
    super(message)
    this.name = 'ApprovalServiceError'
    this.status = status
    this.code = code
    this.response = response
  }
}

export function statusTone(status: string): StatusTone {
  if (['ACTIVE', 'PUBLISHED', 'VALID'].includes(status)) return 'success'
  if (['DRAFT', 'SIMULATION_ONLY', 'CONFIGURATION_ONLY'].includes(status)) return 'info'
  if (['INACTIVE', 'DEACTIVATED'].includes(status)) return 'warning'
  if (['ARCHIVED', 'ERROR', 'CRITICAL'].includes(status)) return 'danger'
  return 'neutral'
}
