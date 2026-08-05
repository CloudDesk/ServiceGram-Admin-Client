import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type {
  AdminInfluencer,
  InfluencerActionKind,
} from '../types/influencer.types'

export interface InfluencerActionSelection {
  kind: InfluencerActionKind
  influencer: AdminInfluencer
}

export interface InfluencerActionFormValues {
  reason?: string
}

interface InfluencerActionModalProps {
  action: InfluencerActionSelection | null
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: InfluencerActionFormValues) => void
}

function actionTitle(kind: InfluencerActionKind) {
  return {
    APPROVE: 'Approve creator',
    REJECT: 'Reject application',
    SUSPEND: 'Suspend creator',
    REACTIVATE: 'Reactivate creator',
  }[kind]
}

function actionDescription(action: InfluencerActionSelection) {
  const name = action.influencer.displayName

  if (action.kind === 'APPROVE') {
    return `${name} will receive Approved Creator access in the customer app.`
  }

  if (action.kind === 'REACTIVATE') {
    return `${name} will regain creator tools and upload access.`
  }

  if (action.kind === 'SUSPEND') {
    return `${name}'s creator tools will be paused until reactivated.`
  }

  return `${name}'s application will move to rejected with the reason visible for operations history.`
}

function submitLabel(kind: InfluencerActionKind) {
  return {
    APPROVE: 'Approve',
    REJECT: 'Reject',
    SUSPEND: 'Suspend',
    REACTIVATE: 'Reactivate',
  }[kind]
}

export function InfluencerActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: InfluencerActionModalProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  if (!action) return null

  const reasonRequired =
    action.kind === 'REJECT' || action.kind === 'SUSPEND'

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
            <p className="mt-1 text-sm leading-6 text-muted">
              {actionDescription(action)}
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
                  ? 'Add a clear operations reason'
                  : 'Optional note for the audit trail'
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
              variant={
                action.kind === 'REJECT' || action.kind === 'SUSPEND'
                  ? 'danger'
                  : 'primary'
              }
            >
              {submitLabel(action.kind)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
