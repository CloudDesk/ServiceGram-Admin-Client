import { bpsToPercent, percentToBps } from '../../settings/mediaReelPolicy/mappers/mediaReelPolicy.mappers'

export type CommissionRateType = 'PERCENTAGE' | 'FIXED'

export interface CommissionRuleConfig {
  commissionRateBps?: number
  fixedCommissionPaise?: number
  logisticsDeductionPaise?: number
  payoutHoldDays?: number
}

const COMMISSION_RULE_CONFIG_KEYS = [
  'commissionRateBps',
  'fixedCommissionPaise',
  'logisticsDeductionPaise',
  'payoutHoldDays',
] as const

/**
 * True when the structured Percentage/Fixed toggle UI can losslessly
 * represent this config: an empty config (the CREATE case), or one made up
 * only of the known commission fields (each a finite non-negative number)
 * where `commissionRateBps` and `fixedCommissionPaise` are not BOTH set —
 * the backend sums the two, which the toggle can't express. False for
 * anything else — a legacy hand-edited row with extra/unknown keys, bad
 * types, or a deliberate rate+fixed combo — so callers can fall back to raw
 * JSON editing rather than silently rewriting a shape they don't understand.
 */
export function isWellFormedCommissionConfig(config: unknown): boolean {
  if (config === null || config === undefined) return true
  if (typeof config !== 'object' || Array.isArray(config)) return false

  const record = config as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length === 0) return true

  const isValidShape = keys.every((key) => {
    if (!(COMMISSION_RULE_CONFIG_KEYS as readonly string[]).includes(key)) return false
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
  })
  if (!isValidShape) return false

  const hasRate = typeof record.commissionRateBps === 'number' && record.commissionRateBps > 0
  const hasFixed = typeof record.fixedCommissionPaise === 'number' && record.fixedCommissionPaise > 0
  return !(hasRate && hasFixed)
}

export function textFromPaise(value: number | null | undefined) {
  if (value == null) return ''
  return String(value / 100)
}

export function parseMoneyToPaise(value: string, label: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid non-negative amount.`)
  }

  return Math.round(parsed * 100)
}

export function textFromBps(bps: number | null | undefined) {
  if (bps == null) return ''
  return String(bpsToPercent(bps))
}

export function parsePercentToBps(value: string, label: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label} must be between 0 and 100.`)
  }

  return percentToBps(parsed)
}

export function parseBoundedInt(
  value: string,
  label: string,
  max?: number,
): number {
  const trimmed = value.trim()
  if (!trimmed) return 0

  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 0 || (max !== undefined && parsed > max)) {
    throw new Error(
      max !== undefined
        ? `${label} must be a whole number between 0 and ${max}.`
        : `${label} must be a non-negative whole number.`,
    )
  }

  return parsed
}
