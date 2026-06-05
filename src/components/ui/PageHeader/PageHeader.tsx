import type { ReactNode } from 'react'
import { Button } from '../Button'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  actionNode?: ReactNode
}

export function PageHeader({
  actionLabel,
  actionNode,
  description,
  eyebrow,
  onAction,
  title,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {eyebrow}
          </p>
        ) : null}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
      </div>
      {actionNode ?? (actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null)}
    </div>
  )
}
