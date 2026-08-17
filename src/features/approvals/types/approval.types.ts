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

export function statusTone(status: string): StatusTone {
  if (['ACTIVE', 'PUBLISHED', 'VALID'].includes(status)) return 'success'
  if (['DRAFT', 'SIMULATION_ONLY', 'CONFIGURATION_ONLY'].includes(status)) return 'info'
  if (['INACTIVE', 'DEACTIVATED'].includes(status)) return 'warning'
  if (['ARCHIVED', 'ERROR', 'CRITICAL'].includes(status)) return 'danger'
  return 'neutral'
}
