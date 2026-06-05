import type { PropsWithChildren } from 'react'
import { cn } from '../../../utils/cn'

interface CardProps extends PropsWithChildren {
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <section className={cn('glass-surface rounded-surface', className)}>
      {children}
    </section>
  )
}
