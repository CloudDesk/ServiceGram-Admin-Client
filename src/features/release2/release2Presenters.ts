import type { StatusTone } from '../../types/status.types'
import {
  Release2ServiceError,
  type FeatureFlagRiskLevel,
} from './types/release2.types'

/** Backend codes the Release 2 screens react to rather than just printing. */
export const release2ErrorCodes = {
  authReauthRequired: 'AUTH_REAUTH_REQUIRED',
  featureFlagArchived: 'FEATURE_FLAG_ARCHIVED',
  featureFlagInvalidRollout: 'FEATURE_FLAG_INVALID_ROLLOUT',
  featureFlagInvalidTarget: 'FEATURE_FLAG_INVALID_TARGET',
  featureFlagNotFound: 'FEATURE_FLAG_NOT_FOUND',
  featureFlagVersionConflict: 'FEATURE_FLAG_VERSION_CONFLICT',
  settingFinancePermissionDenied: 'SETTING_FINANCE_PERMISSION_DENIED',
  settingNotEditable: 'SETTING_NOT_EDITABLE',
  settingNotFound: 'SETTING_NOT_FOUND',
  settingReasonRequired: 'SETTING_REASON_REQUIRED',
  settingValidationFailed: 'SETTING_VALIDATION_FAILED',
  settingVersionConflict: 'SETTING_VERSION_CONFLICT',
  validationFailed: 'VALIDATION_FAILED',
} as const

export function humanizeCode(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .replaceAll(/[._:-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function asRelease2Error(error: unknown) {
  return error instanceof Release2ServiceError ? error : null
}

export function errorMessage(error: unknown, fallback = 'Request failed.') {
  if (error instanceof Error && error.message) return error.message

  return fallback
}

export function isPermissionDenied(error: unknown) {
  const release2Error = asRelease2Error(error)

  return release2Error?.status === 403
}

export function isRecentAuthRequired(error: unknown) {
  const release2Error = asRelease2Error(error)

  return (
    release2Error?.code === release2ErrorCodes.authReauthRequired ||
    release2Error?.status === 401
  )
}

export function isVersionConflict(error: unknown) {
  const release2Error = asRelease2Error(error)

  return (
    release2Error?.code === release2ErrorCodes.featureFlagVersionConflict ||
    release2Error?.code === release2ErrorCodes.settingVersionConflict
  )
}

export function isFinancePermissionDenied(error: unknown) {
  return (
    asRelease2Error(error)?.code ===
    release2ErrorCodes.settingFinancePermissionDenied
  )
}

/** Live version the backend reports on a stale write, when it supplies one. */
export function conflictVersion(error: unknown) {
  const currentVersion = asRelease2Error(error)?.response?.details?.metadata
    ?.currentVersion

  return typeof currentVersion === 'number' ? currentVersion : null
}

export function fieldErrorsOf(error: unknown) {
  return asRelease2Error(error)?.response?.details?.fieldErrors ?? []
}

/** `field` -> message, so a form can put the backend text next to the input. */
export function fieldErrorMap(error: unknown) {
  return fieldErrorsOf(error).reduce<Record<string, string>>(
    (accumulator, fieldError) => {
      accumulator[fieldError.field] ??= fieldError.message

      return accumulator
    },
    {},
  )
}

export function riskTone(riskLevel: FeatureFlagRiskLevel): StatusTone {
  if (riskLevel === 'FINANCE') return 'danger'
  if (riskLevel === 'HIGH') return 'warning'
  if (riskLevel === 'MEDIUM') return 'info'

  return 'neutral'
}

export function phaseLabel(phase: string) {
  return phase.replace('PHASE_', 'P')
}

/** Group labels for the seeded Release 2 `uiGroup` values. */
const settingGroupLabels: Record<string, string> = {
  campaigns: 'Campaigns',
  delivery: 'Delivery',
  influencer_payouts: 'Influencer Payouts',
  loyalty: 'Loyalty',
  messaging: 'Messaging',
  privacy: 'Privacy',
  promotions: 'Promotions',
  referrals: 'Referrals',
  release2_platform: 'Platform',
  wallet: 'Wallet',
}

export function settingGroupLabel(uiGroup: string) {
  return settingGroupLabels[uiGroup] ?? humanizeCode(uiGroup)
}

const actionLabels: Record<string, string> = {
  ADD_ALLOW_TARGET: 'Add an ALLOW target',
  ARCHIVE: 'Archive',
  ENABLE_WHEN_READY: 'Enable when ready',
  ENABLE_SAFE_QA_FLAGS: 'Enable safe QA flags',
  EVALUATE: 'Evaluate',
  PREVIEW: 'Preview',
  REPLACE_TARGETS: 'Edit targets',
  REVIEW_EXPIRING_FLAGS: 'Review expiring flags',
  SEED_RELEASE2_SETTINGS: 'Seed Release 2 settings',
  UPDATE: 'Edit',
  VIEW_HISTORY: 'History',
}

export function actionLabel(action: string) {
  return actionLabels[action] ?? humanizeCode(action)
}

export function formatSettingValue(
  value: unknown,
  unit?: string,
): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'

  if (typeof value === 'number') {
    const formatted = new Intl.NumberFormat('en-IN').format(value)

    if (unit === 'paise') {
      return `₹${new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2,
      }).format(value / 100)}`
    }

    return unit ? `${formatted} ${unit}` : formatted
  }

  if (typeof value === 'string') return value

  return JSON.stringify(value)
}

export function validationHint(validation: {
  min?: number
  max?: number
  enum?: string[]
  unit?: string
}) {
  const parts: string[] = []

  if (validation.enum?.length) parts.push(`One of: ${validation.enum.join(', ')}`)
  if (validation.min !== undefined) parts.push(`min ${validation.min}`)
  if (validation.max !== undefined) parts.push(`max ${validation.max}`)
  if (validation.unit) parts.push(validation.unit)

  return parts.join(' · ')
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Compact target rule label, e.g. `ALLOW · Customer · Bengaluru`. */
export function targetSummary(target: {
  appType: string
  roleCode?: string | null
  city?: string | null
  zoneId?: string | null
  vendorId?: string | null
  influencerId?: string | null
  userSegment?: string | null
  subjectUserId?: string | null
}) {
  const dimensions = [
    target.appType === 'ANY' ? null : humanizeCode(target.appType),
    target.city,
    target.roleCode ? humanizeCode(target.roleCode) : null,
    target.userSegment ? humanizeCode(target.userSegment) : null,
    target.zoneId ? 'Zone' : null,
    target.vendorId ? 'Vendor' : null,
    target.influencerId ? 'Influencer' : null,
    target.subjectUserId ? 'User' : null,
  ].filter(Boolean)

  return dimensions.length ? dimensions.join(' · ') : 'Everyone'
}
