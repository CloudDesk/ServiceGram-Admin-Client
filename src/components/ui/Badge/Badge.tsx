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
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        statusToneClasses[tone],
      )}
    >
      {children}
    </span>
  )
}
