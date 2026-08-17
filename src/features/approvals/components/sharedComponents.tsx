import type { ReactNode } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'
import { cn } from '../../../utils/cn'
import { issueLabel, issueLocation } from '../copy'

// ─── Metric Card ─────────────────────────────────────────────────────────────

export function MetricCard({
  helper,
  icon,
  label,
  tone = 'neutral',
  value,
}: {
  helper: string
  icon: ReactNode
  label: string
  tone?: 'info' | 'neutral' | 'success' | 'warning'
  value: string
}) {
  const toneClassName = {
    info: 'bg-info/10 text-info',
    neutral: 'bg-surface-muted text-muted',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
  }[tone]

  return (
    <Card className="min-w-0 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-0.5 text-xl font-semibold leading-tight tabular-nums text-foreground">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{helper}</p>
        </div>
        <span
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-full',
            toneClassName,
          )}
        >
          {icon}
        </span>
      </div>
    </Card>
  )
}


// ─── Filter Select ────────────────────────────────────────────────────────────

export function FilterSelect({
  ariaLabel,
  children,
  onChange,
  value,
}: {
  ariaLabel: string
  children: ReactNode
  onChange: (value: string) => void
  value: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="form-input h-9 min-w-full text-sm sm:min-w-[11rem]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

export function WorkflowListSkeleton() {
  return (
    <div className="space-y-1.5 p-2">
      <Skeleton className="h-14 rounded-[0.65rem]" />
      <Skeleton className="h-14 rounded-[0.65rem]" />
      <Skeleton className="h-14 rounded-[0.65rem]" />
      <Skeleton className="h-14 rounded-[0.65rem]" />
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="p-3">
      <Skeleton className="h-20" />
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 flex-1" />
        ))}
      </div>
      <Skeleton className="mt-3 h-48" />
    </div>
  )
}

// ─── Issue List ───────────────────────────────────────────────────────────────

/**
 * Validation issues, led by a plain-language headline. The API's own message is
 * the supporting detail and the path becomes a breadcrumb back to the rule or
 * stage at fault — an admin should never have to decode `MIN_N_APPROVER_POOL_MAY_BE_TOO_SMALL`.
 */
export function IssueList({
  issues,
  title,
}: {
  issues: { code: string; message: string; path: string; severity: string }[]
  title: string
}) {
  const hasErrors = issues.some((issue) => issue.severity === 'ERROR')

  return (
    <section
      className={cn(
        'overflow-hidden rounded-surface border',
        hasErrors ? 'border-danger/30' : 'border-warning/30',
      )}
    >
      <h3
        className={cn(
          'px-3 py-2.5 text-sm font-semibold text-foreground',
          hasErrors ? 'bg-danger/8' : 'bg-warning/8',
        )}
      >
        {title}
        <span className="ml-1.5 tabular-nums text-muted">({issues.length})</span>
      </h3>
      <ul className="divide-y divide-border bg-surface">
        {issues.map((issue) => (
          <li className="flex items-start gap-2.5 px-3 py-2.5" key={`${issue.path}-${issue.code}`}>
            {issue.severity === 'ERROR' ? (
              <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{issueLabel(issue.code)}</p>
              <p className="mt-0.5 text-sm leading-6 text-muted">{issue.message}</p>
              {issue.path !== 'runtime' && (
                <p className="mt-1 text-xs text-muted">{issueLocation(issue.path)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
