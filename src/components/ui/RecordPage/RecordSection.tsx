import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

interface RecordSectionProps {
  title: string
  id?: string
  description?: string
  icon?: ReactNode
  actionNode?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * The icon/title/description header over a bordered card, used by every
 * detail page's sub-panels (Account, Role, Lifecycle, Guardrails, Related
 * records...). This exact shell was being re-typed per page — three copies
 * existed before this one.
 */
export function RecordSection({
  actionNode,
  children,
  className,
  description,
  icon,
  id,
  title,
}: RecordSectionProps) {
  return (
    <section
      className={cn('scroll-mt-24 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface', className)}
      id={id}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}
