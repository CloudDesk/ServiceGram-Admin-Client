import { formatDate } from '../../utils/formatDate'
import { formatMoney } from '../../utils/formatMoney'
import type { VendorServiceModerationStatus } from './types/service.types'

export type ServiceTone = 'success' | 'warning' | 'danger' | 'neutral'

export function humanizeCode(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function formatDateSafe(value: string | null | undefined) {
  if (!value) return '—'

  try {
    return formatDate(value)
  } catch {
    return '—'
  }
}

export function formatPaise(value: number | null | undefined) {
  return formatMoney((value ?? 0) / 100)
}

export function getModerationStatusTone(
  status: VendorServiceModerationStatus,
): ServiceTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  return 'warning'
}
