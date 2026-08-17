import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

interface RecordFieldProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  className?: string
}

/**
 * A definition-list row, not a card.
 *
 * Boxing each field costs ~56px per value and pushes a handful of contact
 * details past 800px. As rows the same fields read faster, because the labels
 * form a single scannable column.
 */
export function RecordField({ className, icon, label, value }: RecordFieldProps) {
  const hasValue =
    value !== null && value !== undefined && value !== '' && value !== false

  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-border/55 py-1.5 last:border-b-0',
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {label}
      </span>
      <span
        className={cn(
          'min-w-0 break-words text-right text-sm',
          hasValue ? 'font-medium text-foreground' : 'text-muted',
        )}
        title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
      >
        {hasValue ? value : '—'}
      </span>
    </div>
  )
}

/** Stacks RecordFields so their labels align into one column. */
export function RecordFieldList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('flex flex-col', className)}>{children}</div>
}
