import {
  CircleAlert,
  Info,
  Lock,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { cn } from '../../../utils/cn'
import {
  actionLabel,
  asRelease2Error,
  conflictVersion,
  errorMessage,
  fieldErrorsOf,
  isFinancePermissionDenied,
  isPermissionDenied,
  isRecentAuthRequired,
  isVersionConflict,
} from '../release2Presenters'

type NoticeTone = 'danger' | 'warning' | 'info'

const noticeToneClasses: Record<NoticeTone, string> = {
  danger: 'border-danger/25 bg-danger/5 text-danger',
  warning: 'border-warning/25 bg-warning/5 text-warning',
  info: 'border-info/25 bg-info/5 text-info',
}

const noticeIcons: Record<NoticeTone, typeof Info> = {
  danger: CircleAlert,
  warning: TriangleAlert,
  info: Info,
}

interface Release2NoticeProps {
  tone?: NoticeTone
  title: string
  detail?: string | null
  /** Rendered under the detail, one per line. Used for backend fieldErrors. */
  bullets?: string[]
  code?: string | null
  actions?: ReactNode
  className?: string
}

/** One compact block for every backend-driven message on the Release 2 screens. */
export function Release2Notice({
  actions,
  bullets,
  className,
  code,
  detail,
  title,
  tone = 'danger',
}: Release2NoticeProps) {
  const Icon = noticeIcons[tone]

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[0.75rem] border p-3 text-sm sm:flex-row sm:items-start sm:justify-between',
        noticeToneClasses[tone],
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold">{title}</p>
          {detail ? <p className="text-foreground/80">{detail}</p> : null}
          {bullets?.length ? (
            <ul className="space-y-0.5 text-foreground/80">
              {bullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          ) : null}
          {code ? (
            <p className="font-mono text-[0.68rem] uppercase tracking-wide opacity-70">
              {code}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}

interface Release2ErrorNoticeProps {
  error: unknown
  /** Reload handler offered when the backend reports a stale version. */
  onReload?: () => void
  className?: string
}

/**
 * Renders whatever the backend actually returned — message, reason, action,
 * fieldErrors and the live version on a conflict — instead of a generic error.
 */
export function Release2ErrorNotice({
  className,
  error,
  onReload,
}: Release2ErrorNoticeProps) {
  if (!error) return null

  const release2Error = asRelease2Error(error)
  const details = release2Error?.response?.details
  const fieldErrors = fieldErrorsOf(error)
  const staleVersion = conflictVersion(error)
  const conflict = isVersionConflict(error)
  const detailParts = [details?.reason, details?.action].filter(Boolean)

  if (conflict) {
    detailParts.push(
      staleVersion === null
        ? 'Reload the record and retry.'
        : `Current version is ${staleVersion}.`,
    )
  }

  if (isRecentAuthRequired(error)) {
    return (
      <Release2Notice
        className={className}
        code={release2Error?.code}
        detail="Confirm your password to continue with this admin action."
        title="Re-authentication required"
        tone="warning"
      />
    )
  }

  return (
    <Release2Notice
      actions={
        conflict && onReload ? (
          <Button size="sm" type="button" variant="secondary" onClick={onReload}>
            Reload
          </Button>
        ) : null
      }
      bullets={fieldErrors.map(
        (fieldError) => `${fieldError.field}: ${fieldError.message}`,
      )}
      className={className}
      code={release2Error?.code}
      detail={detailParts.join(' ') || null}
      title={errorMessage(error)}
      tone={
        isFinancePermissionDenied(error) || isPermissionDenied(error)
          ? 'warning'
          : 'danger'
      }
    />
  )
}

interface Release2PermissionPanelProps {
  error?: unknown
  /** Permission codes the screen needs. Shown so the admin can ask for them. */
  required?: string[]
  title?: string
}

/** Full-panel state for a screen the current admin cannot read. */
export function Release2PermissionPanel({
  error,
  required,
  title = 'You do not have access to this screen',
}: Release2PermissionPanelProps) {
  const release2Error = asRelease2Error(error)

  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="rounded-full bg-warning/10 p-3 text-warning">
        <Lock className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted">
          {release2Error?.response?.details?.reason ??
            release2Error?.message ??
            'Ask a Super Admin to grant the permissions below.'}
        </p>
      </div>
      {required?.length ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {required.map((permission) => (
            <span
              className="rounded-full bg-surface-muted px-2.5 py-1 font-mono text-xs text-muted"
              key={permission}
            >
              {permission}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

interface Release2WarningsProps {
  warnings: string[]
  className?: string
}

/** Backend `warnings`, verbatim. Never invented on the client. */
export function Release2Warnings({ className, warnings }: Release2WarningsProps) {
  if (!warnings.length) return null

  return (
    <ul
      className={cn(
        'space-y-1.5 rounded-[0.75rem] border border-warning/25 bg-warning/5 p-3 text-sm text-warning',
        className,
      )}
    >
      {warnings.map((warning) => (
        <li className="flex items-start gap-2" key={warning}>
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="text-foreground/85">{warning}</span>
        </li>
      ))}
    </ul>
  )
}

interface Release2NextActionProps {
  action: string | null
  className?: string
}

/** Backend `nextRecommendedAction`, rendered as a hint rather than a button. */
export function Release2NextAction({
  action,
  className,
}: Release2NextActionProps) {
  if (!action) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-info/10 px-2.5 py-1 text-xs font-semibold text-info',
        className,
      )}
    >
      <ShieldAlert className="size-3.5" />
      Next: {actionLabel(action)}
    </span>
  )
}
