import { formatDate } from '../../utils/formatDate'
import type { ContentPage, ContentPageStatus } from './types/content.types'

export type ContentTone = 'success' | 'warning' | 'danger' | 'neutral'

export function humanizeCode(value: string | null | undefined) {
  if (!value) return '—'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** Null renders as an em-dash, never as a sentence. */
export function formatDateSafe(value: string | null | undefined, withTime = false) {
  if (!value) return '—'

  try {
    return formatDate(value, withTime)
  } catch {
    return '—'
  }
}

export function contentStatusTone(status: ContentPageStatus): ContentTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

/** True when the draft has moved ahead of what customers can see. */
export function hasDraftDrift(page: ContentPage) {
  return (
    page.status === 'PUBLISHED' &&
    page.publishedVersion !== null &&
    page.version > page.publishedVersion
  )
}

/** A one-line reason this page needs attention, or null when it is clear. */
export function contentSignal(page: ContentPage) {
  if (page.blockingReasons[0]) {
    return { label: humanizeCode(page.blockingReasons[0]), tone: 'danger' as const }
  }

  if (hasDraftDrift(page)) {
    return { label: 'Unpublished draft', tone: 'warning' as const }
  }

  if (page.warnings[0]) {
    return { label: humanizeCode(page.warnings[0]), tone: 'warning' as const }
  }

  return null
}

/**
 * Publish is constructive and may occupy the row's primary button; Archive
 * removes a page from customers, so it stays behind the overflow. Same rule as
 * vendorPresenters.getRowPrimaryAction.
 */
export function canPublish(page: ContentPage) {
  return page.availableActions.includes('PUBLISH')
}

export function canArchive(page: ContentPage) {
  return page.availableActions.includes('ARCHIVE')
}
