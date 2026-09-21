import { TriangleAlert, X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../Button'

interface ReasonFieldProps {
  value: string
  onChange: (value: string) => void
  /** Backend field error for `reason`, shown under the control instead of the hint. */
  error?: string | null
  disabled?: boolean
  label?: string
  placeholder?: string
  minLength: number
}

/** The reason textarea + hint/char-counter row, reusable on its own inside a bigger form. */
export function ReasonField({
  disabled = false,
  error,
  label = 'Reason',
  minLength,
  onChange,
  placeholder = 'Why is this change being made?',
  value,
}: ReasonFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold text-foreground">{label} *</span>
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
          {error ?? `Stored in the audit trail. Minimum ${minLength} characters.`}
        </span>
        <span className="shrink-0 tabular-nums text-muted">{value.length}/500</span>
      </span>
    </label>
  )
}

function errorMessage(error: unknown): string | null {
  if (!error) return null
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  return 'Something went wrong. Please try again.'
}

interface ReasonModalProps {
  title: string
  subtitle?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Styles the confirm button as destructive (e.g. archive, suspend, reject). */
  isDestructive?: boolean
  isSubmitting?: boolean
  error?: unknown
  warnings?: string[]
  reasonLabel?: string
  reasonPlaceholder?: string
  /** Minimum reason length before Confirm is allowed. Defaults to 3. */
  minLength?: number
  /** Backend field error for `reason`, if the last submit was rejected for it. */
  reasonError?: string | null
  /** Extra controls rendered above the reason field (e.g. a record summary). */
  children?: ReactNode
  onClose: () => void
  onSubmit: (reason: string) => void
}

/**
 * The app's one reason-carrying confirm dialog — for any action that needs a
 * short audit reason before it runs (activate/deactivate, reject, archive,
 * block/unblock...). Exists so those actions use the app's own modal instead
 * of `window.prompt`/`window.confirm`, which can't be styled, don't match
 * the rest of the UI, and are increasingly blocked or flagged by browsers.
 */
export function ReasonModal({
  cancelLabel = 'Cancel',
  children,
  confirmLabel = 'Confirm',
  error,
  isDestructive = false,
  isSubmitting = false,
  minLength = 3,
  onClose,
  onSubmit,
  reasonError,
  reasonLabel,
  reasonPlaceholder,
  subtitle,
  title,
  warnings,
}: ReasonModalProps) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = reason.trim()

    if (trimmed.length < minLength) {
      setLocalError(
        minLength <= 1
          ? 'Reason is required.'
          : `Reason must be at least ${minLength} characters.`,
      )

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
          {warnings?.length ? (
            <ul className="space-y-1.5 rounded-[0.75rem] border border-warning/25 bg-warning/5 p-3 text-sm text-warning">
              {warnings.map((warning) => (
                <li className="flex items-start gap-2" key={warning}>
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span className="text-foreground/85">{warning}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {children}

          <ReasonField
            disabled={isSubmitting}
            error={localError ?? reasonError ?? null}
            label={reasonLabel}
            minLength={minLength}
            placeholder={reasonPlaceholder}
            value={reason}
            onChange={setReason}
          />

          {errorMessage(error) ? (
            <div className="rounded-[0.75rem] border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
              {errorMessage(error)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              {cancelLabel}
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
