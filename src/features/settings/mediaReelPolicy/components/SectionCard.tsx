import type { ReactNode } from 'react'
import { cn } from '../../../../utils/cn'

export function SectionCard({
  children,
  className,
  icon,
  title,
}: {
  children: ReactNode
  className?: string
  icon: ReactNode
  title: string
}) {
  return (
    <section className={cn('rounded-[0.875rem] border border-border bg-surface p-3.5', className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[0.5rem] bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function FieldLabel({
  children,
  htmlFor,
  tooltip,
}: {
  children: ReactNode
  htmlFor?: string
  tooltip?: ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-muted" id={htmlFor}>
      {children}
      {tooltip}
    </span>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-danger">{message}</p>
}
