import {
  parseMoneyToPaise,
  parsePercentToBps,
  textFromPaise,
  textFromBps,
} from '../../commission/utils/commissionFormatting'

const BYTES_PER_MB = 1024 * 1024

/** The three raw backend units that are confusing enough to need conversion. */
export type ConvertibleSettingUnit = 'bps' | 'paise' | 'bytes'

export function isConvertibleUnit(unit: string | undefined): unit is ConvertibleSettingUnit {
  return unit === 'bps' || unit === 'paise' || unit === 'bytes'
}

/** What to show next to the friendly input/value for each convertible unit. */
export function friendlyUnitLabel(unit: ConvertibleSettingUnit): string {
  if (unit === 'bps') return '%'
  if (unit === 'paise') return '₹'
  return 'MB'
}

export function textFromBytes(bytes: number | null | undefined) {
  if (bytes == null) return ''
  return String(Math.round((bytes / BYTES_PER_MB) * 100) / 100)
}

export function parseMbToBytes(value: string, label: string): number {
  const trimmed = value.trim()
  if (!trimmed) return 0

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid non-negative size.`)
  }

  return Math.round(parsed * BYTES_PER_MB)
}

/** Raw backend value (bps/paise/bytes) -> text for the friendly-unit input. */
export function textFromSettingValue(
  value: number | null | undefined,
  unit: ConvertibleSettingUnit,
): string {
  if (unit === 'bps') return textFromBps(value ?? null)
  if (unit === 'paise') return textFromPaise(value ?? null)
  return textFromBytes(value ?? null)
}

/** Friendly-unit input text -> raw backend value (bps/paise/bytes). */
export function parseSettingValueText(
  text: string,
  unit: ConvertibleSettingUnit,
  label: string,
): number {
  if (unit === 'bps') return parsePercentToBps(text, label)
  if (unit === 'paise') return parseMoneyToPaise(text, label)
  return parseMbToBytes(text, label)
}
