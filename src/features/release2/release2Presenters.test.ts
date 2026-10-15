import { describe, expect, it } from 'vitest'
import {
  conflictVersion,
  fieldErrorMap,
  formatSettingValue,
  isFinancePermissionDenied,
  isPermissionDenied,
  isRecentAuthRequired,
  isVersionConflict,
  settingGroupLabel,
  targetSummary,
  validationHint,
} from './release2Presenters'
import { Release2ServiceError } from './types/release2.types'

function serviceError(
  code: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return new Release2ServiceError('Request failed.', status, code, {
    success: false,
    code,
    message: 'Request failed.',
    details,
  })
}

describe('backend error classification', () => {
  it('detects a feature-flag version conflict and reads the live version', () => {
    const error = serviceError('FEATURE_FLAG_VERSION_CONFLICT', 409, {
      metadata: { currentVersion: 9 },
    })

    expect(isVersionConflict(error)).toBe(true)
    expect(conflictVersion(error)).toBe(9)
  })

  it('detects a setting version conflict with no version metadata', () => {
    const error = serviceError('SETTING_VERSION_CONFLICT', 409)

    expect(isVersionConflict(error)).toBe(true)
    expect(conflictVersion(error)).toBeNull()
  })

  it('separates permission denial, finance denial and recent-auth', () => {
    const permission = serviceError('AUTH_PERMISSION_DENIED', 403)
    const finance = serviceError('SETTING_FINANCE_PERMISSION_DENIED', 403)
    const reauth = serviceError('AUTH_REAUTH_REQUIRED', 401)

    expect(isPermissionDenied(permission)).toBe(true)
    expect(isFinancePermissionDenied(permission)).toBe(false)

    expect(isFinancePermissionDenied(finance)).toBe(true)
    expect(isPermissionDenied(finance)).toBe(true)

    expect(isRecentAuthRequired(reauth)).toBe(true)
    expect(isVersionConflict(reauth)).toBe(false)
  })

  it('ignores plain errors that did not come from the API', () => {
    const error = new Error('offline')

    expect(isPermissionDenied(error)).toBe(false)
    expect(isVersionConflict(error)).toBe(false)
    expect(fieldErrorMap(error)).toEqual({})
  })

  it('maps fieldErrors by field, keeping the first message per field', () => {
    const error = serviceError('FEATURE_FLAG_INVALID_TARGET', 400, {
      fieldErrors: [
        {
          field: 'targets.0.zoneId',
          code: 'FEATURE_FLAG_INVALID_TARGET',
          message: 'zoneId does not match an existing service zone.',
        },
        {
          field: 'targets.0.zoneId',
          code: 'FEATURE_FLAG_INVALID_TARGET',
          message: 'ignored duplicate',
        },
        {
          field: 'reason',
          code: 'TOO_SMALL',
          message: 'Too small: expected string to have >=3 characters',
        },
      ],
    })

    expect(fieldErrorMap(error)).toEqual({
      'targets.0.zoneId': 'zoneId does not match an existing service zone.',
      reason: 'Too small: expected string to have >=3 characters',
    })
  })
})

describe('value presentation', () => {
  it('formats paise as rupees and other units inline', () => {
    expect(formatSettingValue(5000, 'paise')).toBe('₹50')
    expect(formatSettingValue(180, 'days')).toBe('180 days')
    expect(formatSettingValue(10000)).toBe('10,000')
  })

  it('formats bps as a percentage and bytes as MB, instead of raw backend units', () => {
    expect(formatSettingValue(1500, 'bps')).toBe('15%')
    expect(formatSettingValue(25 * 1024 * 1024, 'bytes')).toBe('25 MB')
  })

  it('formats booleans and empty values for a dense table', () => {
    expect(formatSettingValue(true)).toBe('On')
    expect(formatSettingValue(false)).toBe('Off')
    expect(formatSettingValue(null)).toBe('—')
  })

  it('builds a validation hint from backend metadata only', () => {
    expect(validationHint({ min: 1, max: 3650, unit: 'days' })).toBe(
      'min 1 · max 3650 · days',
    )
    expect(validationHint({ enum: ['WEEKLY'] })).toBe('One of: WEEKLY')
    expect(validationHint({})).toBe('')
  })

  it('converts bps/paise/bytes bounds in the hint to the same friendly unit as the value', () => {
    expect(validationHint({ min: 0, max: 10000, unit: 'bps' })).toBe('min 0% · max 100%')
    expect(validationHint({ min: 0, max: 1000000, unit: 'paise' })).toBe('min ₹0 · max ₹10,000')
    expect(validationHint({ min: 1024, max: 26214400, unit: 'bytes' })).toBe(
      'min 0 MB · max 25 MB',
    )
  })

  it('labels seeded setting groups and falls back to a humanised key', () => {
    expect(settingGroupLabel('influencer_payouts')).toBe('Influencer Payouts')
    expect(settingGroupLabel('some_new_group')).toBe('Some New Group')
  })

  it('summarises a target by its set dimensions', () => {
    expect(
      targetSummary({
        appType: 'CUSTOMER',
        city: 'Bengaluru',
        userSegment: 'RETURNING_CUSTOMER',
      }),
    ).toBe('Customer · Bengaluru · Returning Customer')

    expect(targetSummary({ appType: 'ANY' })).toBe('Everyone')
  })
})
