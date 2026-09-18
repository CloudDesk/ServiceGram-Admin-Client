import { routePaths } from '../../../../config/routes'
import type { StatusTone } from '../../../../types/status.types'
import { SettingsServiceError, type PolicyRule } from '../../types/settings.types'
import type { PolicyRuleConflict } from '../../types/settings.types'
import { bytesToMb } from '../mappers/mediaReelPolicy.mappers'
import type { MediaReelConfig } from '../types/mediaReelPolicy.types'

const POLICY_RULE_VERSION_REQUIRED = 'POLICY_RULE_VERSION_REQUIRED'
const POLICY_RULE_VERSION_CONFLICT = 'POLICY_RULE_VERSION_CONFLICT'
const POLICY_RULE_ACTIVATION_CONFLICT = 'POLICY_RULE_ACTIVATION_CONFLICT'

export function asSettingsServiceError(error: unknown) {
  return error instanceof SettingsServiceError ? error : null
}

/**
 * True when the backend rejected a policy-rule write because `expectedVersion`
 * was missing (`POLICY_RULE_VERSION_REQUIRED`) or stale
 * (`POLICY_RULE_VERSION_CONFLICT`) -- in both cases the fix is the same:
 * reload the rule's latest version and retry.
 */
export function isPolicyVersionConflict(error: unknown) {
  const code = asSettingsServiceError(error)?.code
  return code === POLICY_RULE_VERSION_REQUIRED || code === POLICY_RULE_VERSION_CONFLICT
}

/** The live version the backend reports on a conflict, when it supplies one. */
export function conflictVersion(error: unknown) {
  const currentVersion = asSettingsServiceError(error)?.response?.details?.metadata
    ?.currentVersion
  return typeof currentVersion === 'number' ? currentVersion : null
}

/** Combines the backend's reason/action and live version into one sentence. */
export function versionConflictDetail(error: unknown) {
  const details = asSettingsServiceError(error)?.response?.details
  const parts = [details?.reason, details?.action].filter(
    (part): part is string => Boolean(part),
  )
  const version = conflictVersion(error)
  parts.push(version === null ? 'Reload the rule and retry.' : `Current version is ${version}.`)
  return parts.join(' ')
}

export interface PolicyActivationConflictDetail {
  action: string | null
  conflicts: PolicyRuleConflict[]
  reason: string | null
  suggestedPriority: number | null
}

export function policyActivationConflictDetail(
  error: unknown,
): PolicyActivationConflictDetail | null {
  const serviceError = asSettingsServiceError(error)
  if (serviceError?.code !== POLICY_RULE_ACTIVATION_CONFLICT) return null

  const details = serviceError.response?.details
  const metadata = details?.metadata
  return {
    action: details?.action ?? null,
    conflicts: Array.isArray(metadata?.conflictingRules)
      ? metadata.conflictingRules
      : [],
    reason: details?.reason ?? null,
    suggestedPriority:
      typeof metadata?.suggestedPriority === 'number'
        ? metadata.suggestedPriority
        : null,
  }
}

export function contentRuleStatusTone(status: PolicyRule['status']): StatusTone {
  if (status === 'ACTIVE') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

const SCOPE_TYPE_LABELS: Record<PolicyRule['scope']['scopeType'], string> = {
  GLOBAL: 'Global',
  CATEGORY: 'Category',
  CITY: 'City',
  ZONE: 'Zone',
  VENDOR: 'Vendor',
}

export function contentRuleScopeLabel(rule: PolicyRule) {
  const { scope } = rule
  if (scope.scopeType === 'GLOBAL') return 'Global'
  if (scope.scopeType === 'CITY') return scope.city ?? 'City scope'
  if (scope.scopeType === 'CATEGORY') return scope.categoryId ? 'Category' : 'Category scope'
  if (scope.scopeType === 'ZONE') return scope.zoneId ? 'Zone' : 'Zone scope'
  return scope.vendorId ? 'Vendor' : 'Vendor scope'
}

export function contentRuleScopeTypeLabel(rule: PolicyRule) {
  return SCOPE_TYPE_LABELS[rule.scope.scopeType]
}

export function buildContentRuleAuditPath(rule: PolicyRule) {
  const params = new URLSearchParams({
    moduleCode: 'settings',
    entityType: 'policy_rule',
    entityId: rule.policyRuleId,
  })
  return `${routePaths.audit}?${params.toString()}`
}

/** The lowest-priority ACTIVE rule is the one the reel-upload flow applies first. */
export function isAppliedFirst(rule: PolicyRule, allRules: PolicyRule[]) {
  if (rule.status !== 'ACTIVE') return false
  const activeRules = allRules.filter((item) => item.status === 'ACTIVE')
  if (activeRules.length === 0) return false
  const minPriority = Math.min(...activeRules.map((item) => item.priority))
  return rule.priority === minPriority
}

function asConfig(rule: PolicyRule): Partial<MediaReelConfig> {
  return (rule.config ?? {}) as Partial<MediaReelConfig>
}

export function formatReelDurationSummary(rule: PolicyRule) {
  const config = asConfig(rule)
  if (
    typeof config.minReelDurationSeconds !== 'number' ||
    typeof config.maxReelDurationSeconds !== 'number'
  ) {
    return 'Not set'
  }
  return `${config.minReelDurationSeconds}–${config.maxReelDurationSeconds} sec`
}

export function formatReelSizeSummary(rule: PolicyRule) {
  const config = asConfig(rule)
  if (typeof config.maxReelSizeBytes !== 'number') return 'Not set'
  return `Up to ${bytesToMb(config.maxReelSizeBytes)} MB`
}

export function formatReelResolutionSummary(rule: PolicyRule) {
  const config = asConfig(rule)
  if (
    typeof config.minReelWidth !== 'number' ||
    typeof config.minReelHeight !== 'number' ||
    typeof config.maxReelWidth !== 'number' ||
    typeof config.maxReelHeight !== 'number'
  ) {
    return 'Not set'
  }
  return `${config.minReelWidth}×${config.minReelHeight} – ${config.maxReelWidth}×${config.maxReelHeight}`
}

export function formatDailyUploadLimitSummary(rule: PolicyRule) {
  const config = asConfig(rule)
  if (typeof config.vendorDailyUploadLimit !== 'number') return 'Not set'
  return `${config.vendorDailyUploadLimit}/vendor/day`
}

/**
 * Translates a backend `fieldErrors[].field` path (e.g. `config.minReelDurationSeconds`,
 * `scope.categoryId`) onto the matching visible form field, so field-level errors can be
 * mapped with RHF's `setError` instead of collapsing into one banner.
 */
const SERVER_FIELD_TO_FORM_FIELD: Record<string, string> = {
  displayName: 'displayName',
  description: 'description',
  status: 'status',
  priority: 'priority',
  scopeType: 'scopeType',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  'scope.categoryId': 'categoryId',
  'scope.city': 'city',
  'scope.zoneId': 'zoneId',
  'scope.vendorId': 'vendorId',
  'config.minReelDurationSeconds': 'reelDurationSeconds',
  'config.maxReelDurationSeconds': 'reelDurationSeconds',
  'config.maxReelSizeBytes': 'maxReelSizeMB',
  'config.allowedVideoMimeTypes': 'allowedVideoFormats',
  'config.requiredReelAspectRatio': 'reelAspectRatio',
  'config.reelAspectRatioToleranceBps': 'aspectRatioTolerancePercent',
  'config.minReelWidth': 'minReelWidth',
  'config.minReelHeight': 'minReelHeight',
  'config.maxReelWidth': 'maxReelWidth',
  'config.maxReelHeight': 'maxReelHeight',
  'config.vendorDailyUploadLimit': 'vendorDailyUploadLimit',
  'config.maxImageSizeBytes': 'maxImageSizeMB',
  'config.allowedImageMimeTypes': 'allowedImageFormats',
  'config.maxStoryImageSizeBytes': 'maxStoryImageSizeMB',
  'config.allowedStoryImageMimeTypes': 'allowedStoryImageFormats',
  'config.maxMusicTrackDurationMs': 'maxMusicTrackMinutes',
  'config.maxMusicPreviewDurationMs': 'maxMusicPreviewSeconds',
  'config.maxMusicTrackAudioSizeBytes': 'maxMusicTrackAudioSizeMB',
  'config.maxMusicArtworkSizeBytes': 'maxMusicArtworkSizeMB',
  'config.maxCreatorAudioSizeBytes': 'maxCreatorAudioSizeMB',
  'config.maxReelMusicSelectionDurationMs': 'maxReelMusicSelectionSeconds',
  'config.allowedAudioMimeTypes': 'allowedAudioFormats',
  'config.maxDocumentSizeBytes': 'maxDocumentSizeMB',
  'config.maxProofImageSizeBytes': 'maxProofImageSizeMB',
  'config.autoSubmitAfterUpload': 'autoSubmitAfterUpload',
  'config.autoPublishAfterApproval': 'autoPublishAfterApproval',
}

export function mapServerFieldToFormPath(field: string): string | null {
  return SERVER_FIELD_TO_FORM_FIELD[field] ?? null
}

/**
 * RHF nests a zod issue raised at an array/tuple field's own path (rather than
 * one of its items) under `.root` for that field, while a scalar field's error
 * sits directly at `.message` -- this reads whichever one is populated.
 */
export function fieldErrorMessage(
  error: { message?: string; root?: { message?: string } } | undefined,
): string | undefined {
  return error?.message ?? error?.root?.message
}
