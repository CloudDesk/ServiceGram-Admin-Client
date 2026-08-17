import { formatDate } from '../../utils/formatDate'
import type {
  AdminReel,
  ReelModerationStatus,
  ReelUploadStatus,
} from './types/reel.types'
import type { ReelActionKind } from './components/ReelActionModal'

export type ReelTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

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

export function getUploadStatusTone(status: ReelUploadStatus): ReelTone {
  if (status === 'READY') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PROCESSING' || status === 'UPLOADING') return 'warning'
  return 'neutral'
}

export function getModerationStatusTone(status: ReelModerationStatus): ReelTone {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED' || status === 'REMOVED') return 'danger'
  if (status === 'PENDING_REVIEW' || status === 'EDIT_REQUESTED') return 'warning'
  if (status === 'PAUSED') return 'info'
  return 'neutral'
}

/** Most-preferred first. Used to pick a fallback when the API recommends nothing. */
export const reelActionPriority: ReelActionKind[] = [
  'APPROVE',
  'REQUEST_EDIT',
  'REJECT',
  'PAUSE',
  'REMOVE',
  'SOFT_DELETE',
  'HARD_DELETE',
]

export function isDangerReelAction(kind: ReelActionKind) {
  return (
    kind === 'REJECT' ||
    kind === 'REMOVE' ||
    kind === 'SOFT_DELETE' ||
    kind === 'HARD_DELETE'
  )
}

export function reelActionLabel(kind: ReelActionKind) {
  return {
    APPROVE: 'Approve',
    REJECT: 'Reject',
    REQUEST_EDIT: 'Request edit',
    PAUSE: 'Pause',
    REMOVE: 'Remove',
    SOFT_DELETE: 'Soft delete',
    HARD_DELETE: 'Hard delete',
  }[kind]
}

export function canRunReelListAction({
  canDeleteReels,
  canModerateReels,
  kind,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  kind: ReelActionKind
}) {
  if (kind === 'SOFT_DELETE' || kind === 'HARD_DELETE') return canDeleteReels
  return canModerateReels
}

export function canOpenReelAction({
  canDeleteReels,
  canModerateReels,
  kind,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  kind: ReelActionKind
  reel: AdminReel
}) {
  return (
    reel.availableActions.includes(kind) &&
    canRunReelListAction({ canDeleteReels, canModerateReels, kind })
  )
}

/**
 * Only constructive moderation may occupy the row's primary button.
 *
 * Reels follow the same rule as vendors: `nextRecommendedAction` reports the
 * available action, so a live reel comes back recommending REMOVE or PAUSE.
 * Promoting that would put a destructive moderation action one click away on
 * every healthy reel. Approve and Request edit are the only constructive ones.
 */
export function getRowPrimaryAction({
  canDeleteReels,
  canModerateReels,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  reel: AdminReel
}): ReelActionKind | null {
  const constructive: ReelActionKind[] = ['APPROVE', 'REQUEST_EDIT']

  return (
    constructive.find((kind) =>
      canOpenReelAction({ canDeleteReels, canModerateReels, kind, reel }),
    ) ?? null
  )
}

/** Actions offered behind the overflow, in priority order. */
export function getOverflowActions({
  canDeleteReels,
  canModerateReels,
  primaryAction,
  reel,
}: {
  canDeleteReels: boolean
  canModerateReels: boolean
  primaryAction: ReelActionKind | null
  reel: AdminReel
}) {
  return reelActionPriority.filter(
    (kind) =>
      kind !== primaryAction &&
      canOpenReelAction({ canDeleteReels, canModerateReels, kind, reel }),
  )
}

/** A one-line reason this reel needs attention, or null when it is clear. */
export function reelSignal(reel: AdminReel) {
  if (reel.blockingReasons[0]) {
    return { label: humanizeCode(reel.blockingReasons[0]), tone: 'danger' as const }
  }

  if (reel.media.uploadStatus === 'FAILED') {
    return { label: 'Upload failed', tone: 'danger' as const }
  }

  if (reel.missingFields.length) {
    return {
      label: `${reel.missingFields.length} missing field${
        reel.missingFields.length === 1 ? '' : 's'
      }`,
      tone: 'warning' as const,
    }
  }

  if (reel.warnings[0]) {
    return { label: humanizeCode(reel.warnings[0]), tone: 'warning' as const }
  }

  return null
}

export function reelDuration(reel: AdminReel) {
  const seconds = reel.media.durationSeconds

  if (!seconds) return '—'

  const minutes = Math.floor(seconds / 60)
  const remainder = Math.round(seconds % 60)

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
