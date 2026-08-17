import type { ApiErrorDetails, ApiErrorResponse } from '../../../types/api.types'
import type { StatusTone } from '../../../types/status.types'

/* ---------------------------------------------------------------- envelopes */

export interface Release2Envelope<TData> {
  success: true
  code: string
  message: string
  data: TData
}

export interface Release2Pagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface Release2ListEnvelope<TRow, TSummary = undefined>
  extends Release2Envelope<TRow[]> {
  pagination: Release2Pagination
  summary?: TSummary
}

/**
 * Backend `details.metadata` carries the live version on a conflict so the form
 * can offer a reload instead of guessing.
 */
export interface Release2ErrorDetails extends ApiErrorDetails {
  metadata?: {
    currentVersion?: number
    [key: string]: unknown
  }
}

export type Release2ErrorResponse = ApiErrorResponse<Release2ErrorDetails>

export class Release2ServiceError extends Error {
  status: number
  code: string
  response: Release2ErrorResponse | null

  constructor(
    message: string,
    status: number,
    code: string,
    response: Release2ErrorResponse | null,
  ) {
    super(message)
    this.name = 'Release2ServiceError'
    this.status = status
    this.code = code
    this.response = response
  }
}

/* ------------------------------------------------------------ feature flags */

export const FEATURE_FLAG_PHASES = [
  'PHASE_1',
  'PHASE_2',
  'PHASE_3',
  'PHASE_4',
  'PHASE_5',
] as const
export type FeatureFlagPhase = (typeof FEATURE_FLAG_PHASES)[number]

export const FEATURE_FLAG_STATUSES = ['DISABLED', 'ENABLED', 'ARCHIVED'] as const
export type FeatureFlagStatus = (typeof FEATURE_FLAG_STATUSES)[number]

export const FEATURE_FLAG_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'FINANCE'] as const
export type FeatureFlagRiskLevel = (typeof FEATURE_FLAG_RISK_LEVELS)[number]

export const FEATURE_FLAG_APP_TYPES = [
  'CUSTOMER',
  'VENDOR',
  'INFLUENCER',
  'DELIVERY',
  'ADMIN',
  'ANY',
] as const
export type FeatureFlagAppType = (typeof FEATURE_FLAG_APP_TYPES)[number]

export const FEATURE_FLAG_TARGET_EFFECTS = ['ALLOW', 'DENY'] as const
export type FeatureFlagTargetEffect = (typeof FEATURE_FLAG_TARGET_EFFECTS)[number]

export const FEATURE_FLAG_USER_SEGMENTS = [
  'NEW_CUSTOMER',
  'RETURNING_CUSTOMER',
  'APPROVED_INFLUENCER',
  'ACTIVE_VENDOR',
] as const
export type FeatureFlagUserSegment = (typeof FEATURE_FLAG_USER_SEGMENTS)[number]

export interface FeatureFlagTarget {
  targetId: string
  effect: FeatureFlagTargetEffect
  priority: number
  appType: FeatureFlagAppType
  roleCode: string | null
  city: string | null
  zoneId: string | null
  vendorId: string | null
  influencerId: string | null
  userSegment: FeatureFlagUserSegment | null
  subjectUserId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface FeatureFlagListRow {
  featureFlagId: string
  featureKey: string
  displayName: string
  phase: FeatureFlagPhase
  status: FeatureFlagStatus
  statusTone: StatusTone
  defaultEnabled: boolean
  rolloutPercentage: number
  effectiveWindowLabel: string
  targetCount: number
  riskLevel: FeatureFlagRiskLevel
  isPublic: boolean
  version: number
  updatedAt: string
  availableActions: string[]
}

export interface FeatureFlagDetail extends FeatureFlagListRow {
  description: string | null
  effectiveFrom: string | null
  effectiveTo: string | null
  ownerTeam: string | null
  createdByAdminId: string | null
  updatedByAdminId: string | null
  createdAt: string
  targets: FeatureFlagTarget[]
  warnings: string[]
  nextRecommendedAction: string | null
}

export interface FeatureFlagsSummary {
  totalFlags: number
  enabledCount: number
  disabledCount: number
  archivedCount: number
  expiringSoonCount: number
  highRiskEnabledCount: number
}

export interface FeatureFlagsQueryParams {
  page?: number
  limit?: number
  search?: string
  phase?: FeatureFlagPhase
  status?: FeatureFlagStatus
  appType?: FeatureFlagAppType
}

export type FeatureFlagsListResponse = Release2ListEnvelope<
  FeatureFlagListRow,
  FeatureFlagsSummary
>
export type FeatureFlagDetailResponse = Release2Envelope<FeatureFlagDetail>

export interface CreateFeatureFlagPayload {
  featureKey: string
  displayName: string
  description?: string
  phase: FeatureFlagPhase
  status?: FeatureFlagStatus
  defaultEnabled?: boolean
  rolloutPercentage?: number
  effectiveFrom?: string
  effectiveTo?: string
  riskLevel?: FeatureFlagRiskLevel
  isPublic?: boolean
  ownerTeam?: string
  reason: string
}

export interface UpdateFeatureFlagPayload {
  displayName?: string
  description?: string | null
  phase?: FeatureFlagPhase
  status?: FeatureFlagStatus
  defaultEnabled?: boolean
  rolloutPercentage?: number
  effectiveFrom?: string | null
  effectiveTo?: string | null
  riskLevel?: FeatureFlagRiskLevel
  isPublic?: boolean
  ownerTeam?: string | null
  expectedVersion: number
  reason: string
}

export interface ArchiveFeatureFlagPayload {
  expectedVersion: number
  reason: string
}

export interface FeatureFlagTargetInput {
  effect: FeatureFlagTargetEffect
  priority: number
  appType: FeatureFlagAppType
  roleCode?: string | null
  city?: string | null
  zoneId?: string | null
  vendorId?: string | null
  influencerId?: string | null
  userSegment?: FeatureFlagUserSegment | null
  subjectUserId?: string | null
  isActive: boolean
}

export interface ReplaceFeatureFlagTargetsPayload {
  expectedVersion: number
  reason: string
  targets: FeatureFlagTargetInput[]
}

export interface EvaluateFeatureFlagPayload {
  appType: FeatureFlagAppType
  userId?: string
  roleCodes?: string[]
  city?: string
  zoneId?: string
  vendorId?: string
  influencerId?: string
  userSegments?: FeatureFlagUserSegment[]
}

export interface FeatureFlagEvaluation {
  featureKey: string
  enabled: boolean
  reason: string
  matchedTargetId: string | null
  rolloutBucket: number | null
}

export type FeatureFlagEvaluationResponse = Release2Envelope<FeatureFlagEvaluation>

export interface FeatureFlagHistoryEntry {
  auditLogId: string
  actor: {
    actorType: string
    actorUserId: string | null
    actorAdminId: string | null
    adminName: string | null
    email: string | null
    userType: string | null
    userStatus: string | null
  }
  moduleCode: string
  actionCode: string
  entityType: string
  entityId: string | null
  oldValue: unknown
  newValue: unknown
  reason: string | null
  requestId: string
  ipAddress: string | null
  createdAt: string
}

export type FeatureFlagHistoryResponse =
  Release2ListEnvelope<FeatureFlagHistoryEntry>

/* -------------------------------------------------------- release 2 settings */

export interface Release2SettingValidation {
  min?: number
  max?: number
  enum?: string[]
  unit?: string
  [key: string]: unknown
}

export interface Release2Setting {
  settingId: string
  settingKey: string
  category: string
  displayName: string
  description: string | null
  valueType: string
  value: unknown
  defaultValue: unknown
  isValueMasked: boolean
  isEditable: boolean
  isSensitive: boolean
  version: number
  riskLevel: FeatureFlagRiskLevel
  requiresReason: boolean
  requiresRecentAuth: boolean
  validation: Release2SettingValidation
  uiGroup: string | null
  isRelease2: boolean
  updatedByAdminId: string | null
  createdAt: string
  updatedAt: string
  warnings: string[]
  availableActions: string[]
  wouldRequireApproval: boolean
}

export interface Release2SettingGroup {
  uiGroup: string
  itemCount: number
  highRiskCount: number
  lastUpdatedAt: string | null
  items: Release2Setting[]
}

export interface Release2SettingsSummary {
  groupCount: number
  itemCount: number
  highRiskCount: number
}

export type Release2SettingsListResponse = Release2ListEnvelope<
  Release2SettingGroup,
  Release2SettingsSummary
>
export type Release2SettingResponse = Release2Envelope<Release2Setting>

export interface Release2SettingPreview {
  settingKey: string
  normalizedValue: unknown
  validationErrors: { field: string; message: string }[]
  warnings: string[]
  wouldRequireApproval: boolean
  isValid: boolean
}

export type Release2SettingPreviewResponse =
  Release2Envelope<Release2SettingPreview>

export interface UpdateRelease2SettingPayload {
  value: unknown
  reason?: string
  expectedVersion?: number
}

/* ----------------------------------------------------------------- overview */

export interface Release2Overview {
  generatedAt: string
  permissionGaps: string[]
  flags: {
    available: boolean
    summary: FeatureFlagsSummary | null
  }
  settings: {
    available: boolean
    summary: Release2SettingsSummary | null
    groups: {
      uiGroup: string
      itemCount: number
      highRiskCount: number
      lastUpdatedAt: string | null
    }[]
  }
  warnings: string[]
  nextRecommendedAction: string | null
}

export type Release2OverviewResponse = Release2Envelope<Release2Overview>

/* --------------------------------------------------------------- app config */

export type AppConfigAppType =
  | 'PUBLIC'
  | 'CUSTOMER'
  | 'VENDOR'
  | 'INFLUENCER'
  | 'DELIVERY'

export interface AppConfigFeature {
  enabled: boolean
  reason: string
}

export interface AppConfig {
  appType: AppConfigAppType
  available: boolean
  serverTime: string
  configVersion: string
  features: Record<string, AppConfigFeature>
  settings: Record<string, unknown>
  localeDefault: string
  supportedLocales: string[]
  warnings: string[]
}

export type AppConfigResponse = Release2Envelope<AppConfig>
