import { X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../utils/cn'
import { Release2ErrorNotice, Release2Warnings } from './Release2Feedback'

interface ReasonFieldProps {
  value: string
  onChange: (value: string) => void
  /** Backend fieldError for `reason`, shown under the control. */
  error?: string | null
  disabled?: boolean
  label?: string
  placeholder?: string
}

/** Audit reason input. Every Release 2 mutation records one. */
export function ReasonField({
  disabled = false,
  error,
  label = 'Reason',
  onChange,
  placeholder = 'Why is this change being made?',
  value,
}: ReasonFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-foreground">{label} *</span>
      <textarea
        className={cn(
          'form-input min-h-20 resize-y',
          error && 'border-danger focus-visible:border-danger',
        )}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="flex justify-between gap-2 text-xs">
        <span className={error ? 'text-danger' : 'text-muted'}>
          {error ?? 'Stored in the audit trail. Minimum 3 characters.'}
        </span>
        <span className="shrink-0 tabular-nums text-muted">{value.length}/500</span>
      </span>
    </label>
  )
}

interface Release2ReasonModalProps {
  title: string
  subtitle?: string
  confirmLabel: string
  isDestructive?: boolean
  isSubmitting: boolean
  error?: unknown
  warnings?: string[]
  reasonError?: string | null
  /** Extra controls rendered above the reason field. */
  children?: ReactNode
  /** Offered when the backend reports a stale version, so the admin can
   *  refresh the record and retry without retyping the reason. */
  onReload?: () => void
  onClose: () => void
  onSubmit: (reason: string) => void
}

/** Confirmation dialog for reason-carrying mutations (archive, high-risk saves). */
export function Release2ReasonModal({
  children,
  confirmLabel,
  error,
  isDestructive = false,
  isSubmitting,
  onClose,
  onReload,
  onSubmit,
  reasonError,
  subtitle,
  title,
  warnings,
}: Release2ReasonModalProps) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = reason.trim()

    if (trimmed.length < 3) {
      setLocalError('Reason must be at least 3 characters.')

      return
    }

    setLocalError(null)
    onSubmit(trimmed)
  }

  return (
    <div className="premium-overlay flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-[1rem] border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-[0.875rem] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          {warnings?.length ? <Release2Warnings warnings={warnings} /> : null}
          {children}
          <ReasonField
            disabled={isSubmitting}
            error={localError ?? reasonError ?? null}
            value={reason}
            onChange={setReason}
          />
          <Release2ErrorNotice error={error} onReload={onReload} />

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              size="sm"
              type="submit"
              variant={isDestructive ? 'danger' : 'primary'}
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
