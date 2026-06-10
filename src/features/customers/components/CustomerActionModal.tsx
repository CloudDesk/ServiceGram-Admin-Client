import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { formatMoney } from '../../../utils/formatMoney'
import type { AdminCustomerDetail } from '../types/customer.types'

export type CustomerActionKind =
  | 'ADD_NOTE'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'WALLET_CREDIT'

export interface CustomerActionSelection {
  kind: CustomerActionKind
}

export interface CustomerActionFormValues {
  note?: string
  reason?: string
  amountPaise?: number
  currency?: string
  referenceId?: string
}

interface CustomerActionModalProps {
  action: CustomerActionSelection | null
  customer: AdminCustomerDetail
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CustomerActionFormValues) => void
}

interface ActionContent {
  title: string
  description: string
  submitLabel: string
  submitVariant?: 'primary' | 'secondary' | 'danger'
  showReason?: boolean
  showNote?: boolean
  showWalletFields?: boolean
}

const actionContent: Record<CustomerActionKind, ActionContent> = {
  ADD_NOTE: {
    title: 'Add internal note',
    description: 'Add an internal note for this customer account.',
    submitLabel: 'Add note',
    submitVariant: 'secondary',
    showNote: true,
  },
  BLOCK: {
    title: 'Block customer',
    description: 'Block this customer account and record the reason.',
    submitLabel: 'Block customer',
    submitVariant: 'danger',
    showReason: true,
  },
  UNBLOCK: {
    title: 'Unblock customer',
    description: 'Restore access for this customer and record the reason.',
    submitLabel: 'Unblock customer',
    submitVariant: 'secondary',
    showReason: true,
  },
  WALLET_CREDIT: {
    title: 'Apply wallet credit',
    description: 'Apply an internal wallet credit with an audit reason.',
    submitLabel: 'Apply credit',
    submitVariant: 'secondary',
    showReason: true,
    showWalletFields: true,
  },
}

export function CustomerActionModal({
  action,
  customer,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: CustomerActionModalProps) {
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [formError, setFormError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [referenceId, setReferenceId] = useState('')

  if (!action) {
    return null
  }

  const content = actionContent[action.kind]

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedNote = note.trim()
    const trimmedReason = reason.trim()
    const trimmedCurrency = currency.trim().toUpperCase()
    const trimmedReferenceId = referenceId.trim()
    const amountPaise = amountText ? Number(amountText) : undefined

    if (content.showNote && !trimmedNote) {
      setFormError('Internal note is required.')
      return
    }

    if (content.showReason && !trimmedReason) {
      setFormError('Reason is required.')
      return
    }

    if (content.showWalletFields) {
      if (!amountPaise || !Number.isInteger(amountPaise) || amountPaise <= 0) {
        setFormError('Wallet credit amount in paise must be a positive whole number.')
        return
      }

      if (!trimmedCurrency || trimmedCurrency.length !== 3) {
        setFormError('Currency must be a 3-letter code.')
        return
      }
    }

    onSubmit({
      note: trimmedNote || undefined,
      reason: trimmedReason || undefined,
      amountPaise,
      currency: trimmedCurrency || undefined,
      referenceId: trimmedReferenceId || undefined,
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {content.title}
            </h2>
            <p className="text-sm leading-6 text-muted">{content.description}</p>
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

        <div className="mt-4 rounded-[1rem] border border-border bg-surface-muted/50 p-3 text-sm">
          <p className="font-semibold text-foreground">{customer.fullName}</p>
          <p className="mt-1 text-muted">
            {customer.mobileNumber ?? 'Mobile not available'} ·{' '}
            {customer.email ?? 'Email not available'}
          </p>
          {content.showWalletFields ? (
            <p className="mt-2 text-muted">
              Current wallet balance:{' '}
              <span className="text-foreground">
                {formatMoney(customer.walletSummary.creditBalancePaise / 100)}
              </span>
            </p>
          ) : null}
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {content.showNote ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Internal note <span className="text-danger">*</span>
              </span>
              <textarea
                className="form-input min-h-32 resize-y"
                onChange={(event) => setNote(event.target.value)}
                placeholder="Enter internal note"
                value={note}
              />
            </label>
          ) : null}

          {content.showReason ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Reason <span className="text-danger">*</span>
              </span>
              <textarea
                className="form-input min-h-28 resize-y"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter reason"
                value={reason}
              />
            </label>
          ) : null}

          {content.showWalletFields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Amount (paise) <span className="text-danger">*</span>
                </span>
                <input
                  className="form-input"
                  inputMode="numeric"
                  onChange={(event) => setAmountText(event.target.value)}
                  placeholder="5000"
                  value={amountText}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Currency
                </span>
                <input
                  className="form-input"
                  maxLength={3}
                  onChange={(event) => setCurrency(event.target.value)}
                  placeholder="INR"
                  value={currency}
                />
              </label>
              <label className="block space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-foreground">
                  Reference ID
                </span>
                <input
                  className="form-input"
                  onChange={(event) => setReferenceId(event.target.value)}
                  placeholder="SUPPORT-TICKET-2026-101"
                  value={referenceId}
                />
              </label>
            </div>
          ) : null}

          {formError || error ? (
            <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
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
              variant={content.submitVariant}
            >
              {content.submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
