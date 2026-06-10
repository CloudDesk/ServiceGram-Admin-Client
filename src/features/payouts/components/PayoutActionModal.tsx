import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { AdminPayoutDetail, AdminPayoutMethod } from '../types/payout.types'

export type PayoutActionKind =
  | 'CREATE'
  | 'APPROVE'
  | 'HOLD'
  | 'RELEASE_HOLD'
  | 'MARK_PAID'
  | 'MARK_FAILED'

export interface PayoutActionSelection {
  kind: PayoutActionKind
  payout?: AdminPayoutDetail
}

export interface PayoutActionFormValues {
  vendorId?: string
  earningIds?: string[]
  payoutMethod?: AdminPayoutMethod
  reason?: string
  processImmediately?: boolean
  utrReference?: string
  paidAt?: string
}

interface PayoutActionModalProps {
  action: PayoutActionSelection | null
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: PayoutActionFormValues) => void
}

function title(kind: PayoutActionKind) {
  return {
    CREATE: 'Create payout',
    APPROVE: 'Approve payout',
    HOLD: 'Hold payout',
    RELEASE_HOLD: 'Release payout hold',
    MARK_PAID: 'Mark payout paid',
    MARK_FAILED: 'Mark payout failed',
  }[kind]
}

export function PayoutActionModal({ action, error, isSubmitting, onClose, onSubmit }: PayoutActionModalProps) {
  const [earningIdsText, setEarningIdsText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [paidAt, setPaidAt] = useState('')
  const [payoutMethod, setPayoutMethod] = useState<AdminPayoutMethod>('MANUAL_BANK_TRANSFER')
  const [processImmediately, setProcessImmediately] = useState(false)
  const [reason, setReason] = useState('')
  const [utrReference, setUtrReference] = useState('')
  const [vendorId, setVendorId] = useState('')

  if (!action) return null

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    if (reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }
    if (action.kind === 'CREATE' && !vendorId.trim()) {
      setFormError('Vendor ID is required.')
      return
    }
    if (action.kind === 'MARK_PAID' && utrReference.trim().length < 3) {
      setFormError('UTR reference must be at least 3 characters.')
      return
    }
    onSubmit({
      vendorId: vendorId.trim() || undefined,
      earningIds: earningIdsText.split(',').map((item) => item.trim()).filter(Boolean),
      payoutMethod,
      reason: reason.trim(),
      processImmediately,
      utrReference: utrReference.trim() || undefined,
      paidAt: paidAt || undefined,
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{title(action.kind)}</h2>
            <p className="mt-1 text-sm text-muted">{action.payout?.publicPayoutId ?? 'New payout batch'}</p>
          </div>
          <button aria-label="Close action modal" className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground" disabled={isSubmitting} onClick={onClose} type="button"><X className="size-4" /></button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {action.kind === 'CREATE' ? (
            <>
              <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Vendor ID *</span><input className="form-input" value={vendorId} onChange={(event) => setVendorId(event.target.value)} /></label>
              <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Earning IDs</span><input className="form-input" placeholder="Comma separated UUIDs" value={earningIdsText} onChange={(event) => setEarningIdsText(event.target.value)} /></label>
              <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Payout method</span><select className="form-input" value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value as AdminPayoutMethod)}><option>MANUAL_BANK_TRANSFER</option><option>UPI</option><option>OTHER</option></select></label>
            </>
          ) : null}
          {action.kind === 'MARK_PAID' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">UTR reference *</span><input className="form-input" value={utrReference} onChange={(event) => setUtrReference(event.target.value)} /></label>
              <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Paid at</span><input className="form-input" type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
            </div>
          ) : null}
          {action.kind === 'APPROVE' ? <label className="flex items-center gap-2 text-sm text-foreground"><input checked={processImmediately} type="checkbox" onChange={(event) => setProcessImmediately(event.target.checked)} />Process immediately</label> : null}
          <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Reason *</span><textarea className="form-input min-h-28 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {formError || error ? <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{formError ?? error}</div> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4"><Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button isLoading={isSubmitting} size="sm" type="submit" variant={action.kind === 'MARK_FAILED' ? 'danger' : 'primary'}>Submit</Button></div>
        </form>
      </div>
    </div>
  )
}
