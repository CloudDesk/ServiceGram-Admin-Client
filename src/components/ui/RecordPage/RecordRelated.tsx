import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Badge } from '../Badge'
import { Button } from '../Button'
import type { StatusTone } from '../../../types/status.types'

interface RelatedRecordRowProps {
  label: string
  value: string
  meta: string
  icon: ReactNode
  canOpen: boolean
  actionLabel?: string
  onOpen?: () => void
}

/**
 * One row in a "related records" panel — a cross-module shortcut (its role,
 * its audit trail, its account) rather than a field on this record. Was
 * re-typed identically in every detail page that links out to other modules.
 */
export function RelatedRecordRow({
  actionLabel = 'Open',
  canOpen,
  icon,
  label,
  meta,
  onOpen,
  value,
}: RelatedRecordRowProps) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">{label}</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
          <p className="mt-1 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
      {canOpen && onOpen ? (
        <Button className="shrink-0" size="sm" type="button" variant="secondary" onClick={onOpen}>
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

interface RecordBadgeGroupProps {
  items: string[]
  emptyLabel: string
  tone: StatusTone
  /** Formats a raw item code for display — defaults to a plain pass-through. */
  formatItem?: (item: string) => string
}

/** A row of status/warning badges, or a single reassuring badge when there's nothing to flag. */
export function RecordBadgeGroup({
  emptyLabel,
  formatItem = (item) => item,
  items,
  tone,
}: RecordBadgeGroupProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <Badge key={item} tone={tone}>
            {formatItem(item)}
          </Badge>
        ))
      ) : (
        <Badge tone="success">{emptyLabel}</Badge>
      )}
    </div>
  )
}
