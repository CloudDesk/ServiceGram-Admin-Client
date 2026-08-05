import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { AdminReel } from '../types/reel.types'

export type ReelActionKind =
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_EDIT'
  | 'PAUSE'
  | 'REMOVE'
  | 'SOFT_DELETE'
  | 'HARD_DELETE'

export interface ReelActionSelection {
  kind: ReelActionKind
  reel: AdminReel
}

export interface ReelActionFormValues {
  reason?: string
}

interface ReelActionModalProps {
  action: ReelActionSelection | null
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: ReelActionFormValues) => void
}

function actionTitle(kind: ReelActionKind) {
  return {
    APPROVE: 'Approve reel',
    REJECT: 'Reject reel',
    REQUEST_EDIT: 'Request edit',
    PAUSE: 'Pause reel',
    REMOVE: 'Remove reel',
    SOFT_DELETE: 'Soft delete reel',
    HARD_DELETE: 'Hard delete reel',
  }[kind]
}

function submitLabel(kind: ReelActionKind) {
  return {
    APPROVE: 'Approve',
    REJECT: 'Reject',
    REQUEST_EDIT: 'Request edit',
    PAUSE: 'Pause',
    REMOVE: 'Remove',
    SOFT_DELETE: 'Soft delete',
    HARD_DELETE: 'Hard delete',
  }[kind]
}

function isDangerAction(kind: ReelActionKind) {
  return (
    kind === 'REJECT' ||
    kind === 'REMOVE' ||
    kind === 'SOFT_DELETE' ||
    kind === 'HARD_DELETE'
  )
}

export function ReelActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: ReelActionModalProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  if (!action) return null

  const reasonRequired = action.kind !== 'APPROVE'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    if (reasonRequired && reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }
    onSubmit({ reason: reason.trim() || undefined })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-normal text-foreground">
              {actionTitle(action.kind)}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {action.reel.publicReelId} · {action.reel.vendor.shopName}
            </p>
          </div>
          <button
            aria-label="Close action modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Reason{reasonRequired ? ' *' : ''}
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              placeholder={
                reasonRequired
                  ? 'Add the reason for this decision'
                  : 'Optional note for this approval'
              }
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
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
              variant={isDangerAction(action.kind) ? 'danger' : 'primary'}
            >
              {submitLabel(action.kind)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
