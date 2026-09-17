import type { PropsWithChildren } from 'react'
import { statusToneClasses } from '../../../constants/statuses'
import { cn } from '../../../utils/cn'
import type { StatusTone } from '../../../types/status.types'

interface BadgeProps extends PropsWithChildren {
  tone?: StatusTone
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        statusToneClasses[tone],
      )}
      title={typeof children === 'string' ? children : undefined}
    >
      {/*
       * `text-overflow: ellipsis` only ever applies to a direct text node,
       * not to a styled child element -- so the parent used to rely on an
       * ancestor's `overflow-hidden` to hard-clip the whole pill instead,
       * with no ellipsis and the rounded end cut off. Truncating this inner
       * span (rather than the pill itself) keeps the pill's shape intact
       * and shows "..." when a status label doesn't fit its column.
       */}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}
