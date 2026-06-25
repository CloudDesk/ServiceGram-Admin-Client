import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type {
  AdminPaymentDetail,
  AdminPaymentSummary,
  AdminRefundCore,
} from '../types/payment.types'

export type PaymentActionSelection =
  | { kind: 'RECONCILE_PAYMENT'; payment: AdminPaymentDetail | AdminPaymentSummary }
  | { kind: 'APPROVE_REFUND'; refund: AdminRefundCore }
  | { kind: 'REJECT_REFUND'; refund: AdminRefundCore }

export interface PaymentActionFormValues {
  reason?: string
  processImmediately?: boolean
}

interface PaymentActionModalProps {
  action: PaymentActionSelection | null
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: PaymentActionFormValues) => void
}

function actionTitle(action: PaymentActionSelection) {
  if (action.kind === 'RECONCILE_PAYMENT') return 'Reconcile payment'
  if (action.kind === 'APPROVE_REFUND') return 'Approve refund'
  return 'Reject refund'
}

export function PaymentActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: PaymentActionModalProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [processImmediately, setProcessImmediately] = useState(false)
  const [reason, setReason] = useState('')

  if (!action) return null

  const requiresReason = action.kind !== 'RECONCILE_PAYMENT'
  const recordLabel =
    action.kind === 'RECONCILE_PAYMENT'
      ? action.payment.publicPaymentId
      : `${action.refund.publicPaymentId} · ${action.refund.refundId}`

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (requiresReason && reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    onSubmit({
      reason: reason.trim() || undefined,
      processImmediately,
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {actionTitle(action)}
            </h2>
            <p className="mt-1 text-sm text-muted">{recordLabel}</p>
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
              Reason{requiresReason ? ' *' : ''}
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {action.kind === 'APPROVE_REFUND' ? (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                checked={processImmediately}
                type="checkbox"
                onChange={(event) => setProcessImmediately(event.target.checked)}
              />
              Process immediately
            </label>
          ) : null}
          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit" variant={action.kind === 'REJECT_REFUND' ? 'danger' : 'primary'}>
              Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
