import { Modal } from '../../../../components/ui/Modal'
import { Button } from '../../../../components/ui/Button'
import { AlertTriangle } from 'lucide-react'
import type { PolicyActivationConflictDetail } from '../utils/contentRulePresentation'
import type { MediaReelPolicyDiffEntry } from '../mappers/mediaReelPolicy.mappers'

const REASON_MAX_LENGTH = 500

export function MediaReelSaveConfirmStep({
  activationConflict,
  diff,
  error,
  isSubmitting,
  onCancel,
  onConfirm,
  onReasonChange,
  onUseSuggestedPriority,
  reason,
  reasonError,
}: {
  activationConflict?: PolicyActivationConflictDetail | null
  diff: MediaReelPolicyDiffEntry[]
  error?: string | null
  isSubmitting: boolean
  onCancel: () => void
  onConfirm: () => void
  onReasonChange: (value: string) => void
  onUseSuggestedPriority?: (priority: number) => void
  reason: string
  reasonError?: string | null
}) {
  return (
    <Modal
      closeDisabled={isSubmitting}
      description="Confirm what's changing and why before it goes live."
      footer={
        <>
          <Button disabled={isSubmitting} type="button" variant="secondary" onClick={onCancel}>
            Back
          </Button>
          <Button isLoading={isSubmitting} type="button" onClick={onConfirm}>
            Confirm and save
          </Button>
        </>
      }
      size="lg"
      title="Confirm content rule changes"
      onClose={onCancel}
    >
      <div className="space-y-4">
        {activationConflict ? (
          <div className="rounded-[0.75rem] border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">Another active rule has the same order</p>
                <p className="mt-1 text-warning/90">
                  Choose a different rule order so ServiceGram can decide which rule applies first.
                </p>
                {activationConflict.conflicts.length ? (
                  <ul className="mt-2 space-y-1">
                    {activationConflict.conflicts.map((conflict) => (
                      <li className="font-medium" key={conflict.policyRuleId}>
                        {conflict.displayName} (order {conflict.priority})
                      </li>
                    ))}
                  </ul>
                ) : null}
                {activationConflict.suggestedPriority !== null && onUseSuggestedPriority ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      onUseSuggestedPriority(activationConflict.suggestedPriority as number)
                    }
                  >
                    Use suggested order {activationConflict.suggestedPriority}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {diff.length > 0 ? (
          <div className="rounded-[0.75rem] border border-border">
            {diff.map((entry, index) => (
              <div
                className={
                  index === 0
                    ? 'flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm'
                    : 'flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm'
                }
                key={entry.field}
              >
                <span className="font-medium text-foreground">{entry.label}</span>
                <span className="text-muted">
                  {entry.before} <span aria-hidden="true">→</span> {entry.after}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[0.75rem] border border-border bg-surface-muted/40 px-3 py-2 text-sm text-muted">
            No changes detected.
          </p>
        )}

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Reason for this change</span>
          <textarea
            className="form-input min-h-20"
            maxLength={REASON_MAX_LENGTH}
            placeholder="Why this content rule is changing"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
          />
          <span className="block text-right text-xs text-muted">
            {reason.length}/{REASON_MAX_LENGTH}
          </span>
        </label>
        {reasonError ? <p className="text-xs text-danger">{reasonError}</p> : null}

        {error && !activationConflict ? (
          <div className="rounded-[0.75rem] border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
