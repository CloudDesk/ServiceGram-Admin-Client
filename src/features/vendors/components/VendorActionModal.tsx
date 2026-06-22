import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { VendorBankAccount, VendorDetail, VendorDocument } from '../types/vendor.types'

export type VendorActionKind =
  | 'APPROVE'
  | 'REJECT'
  | 'REQUEST_DOCUMENTS'
  | 'SUSPEND'
  | 'REACTIVATE'
  | 'ADD_NOTE'
  | 'VERIFY_DOCUMENT'
  | 'REJECT_DOCUMENT'
  | 'VERIFY_BANK_ACCOUNT'
  | 'REJECT_BANK_ACCOUNT'

export interface VendorActionSelection {
  kind: VendorActionKind
  document?: VendorDocument
  bankAccount?: VendorBankAccount
}

export interface VendorActionFormValues {
  reason?: string
  note?: string
  requestedDocumentTypes?: string[]
}

interface VendorActionModalProps {
  action: VendorActionSelection | null
  error?: string | null
  isSubmitting: boolean
  vendor: VendorDetail
  onClose: () => void
  onSubmit: (values: VendorActionFormValues) => void
}

interface ActionContent {
  title: string
  description: string
  submitLabel: string
  submitVariant?: 'primary' | 'secondary' | 'danger'
  reasonLabel?: string
  reasonRequired?: boolean
  noteRequired?: boolean
}

const actionContent: Record<VendorActionKind, ActionContent> = {
  APPROVE: {
    title: 'Approve vendor',
    description: 'Approve this vendor and move them forward in onboarding.',
    submitLabel: 'Approve vendor',
    reasonLabel: 'Approval reason',
  },
  REJECT: {
    title: 'Reject vendor',
    description: 'Reject this vendor onboarding request with a clear reason.',
    submitLabel: 'Reject vendor',
    submitVariant: 'danger',
    reasonLabel: 'Rejection reason',
    reasonRequired: true,
  },
  REQUEST_DOCUMENTS: {
    title: 'Request documents',
    description: 'Ask this vendor to provide or correct specific documents.',
    submitLabel: 'Request documents',
    submitVariant: 'secondary',
    reasonLabel: 'Request reason',
    reasonRequired: true,
  },
  SUSPEND: {
    title: 'Suspend vendor',
    description: 'Suspend this vendor account and record the reason.',
    submitLabel: 'Suspend vendor',
    submitVariant: 'danger',
    reasonLabel: 'Suspension reason',
    reasonRequired: true,
  },
  REACTIVATE: {
    title: 'Reactivate vendor',
    description: 'Reactivate this vendor account and record the reason.',
    submitLabel: 'Reactivate vendor',
    submitVariant: 'secondary',
    reasonLabel: 'Reactivation reason',
    reasonRequired: true,
  },
  ADD_NOTE: {
    title: 'Add internal note',
    description: 'Add an internal review note for this vendor.',
    submitLabel: 'Add note',
    submitVariant: 'secondary',
    noteRequired: true,
  },
  VERIFY_DOCUMENT: {
    title: 'Verify document',
    description: 'Mark this vendor document as verified.',
    submitLabel: 'Verify document',
    reasonLabel: 'Verification reason',
    submitVariant: 'secondary',
  },
  REJECT_DOCUMENT: {
    title: 'Request document resubmission',
    description: 'Ask the vendor to upload this document again with a clear reason.',
    submitLabel: 'Request resubmission',
    reasonLabel: 'Resubmission reason',
    reasonRequired: true,
    submitVariant: 'secondary',
  },
  VERIFY_BANK_ACCOUNT: {
    title: 'Verify bank account',
    description: 'Mark this payout bank account as verified for settlement use.',
    submitLabel: 'Verify account',
    reasonLabel: 'Verification note',
    submitVariant: 'secondary',
  },
  REJECT_BANK_ACCOUNT: {
    title: 'Reject bank account',
    description: 'Reject this payout bank account and ask the vendor to correct it.',
    submitLabel: 'Reject account',
    reasonLabel: 'Rejection reason',
    reasonRequired: true,
    submitVariant: 'danger',
  },
}

function parseDocumentTypes(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function VendorActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  vendor,
}: VendorActionModalProps) {
  const [documentTypesText, setDocumentTypesText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')

  if (!action) {
    return null
  }

  const content = actionContent[action.kind]
  const showReason = Boolean(content.reasonLabel)
  const showDocumentTypes = action.kind === 'REQUEST_DOCUMENTS'
  const showNote = action.kind === 'ADD_NOTE'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()
    const trimmedNote = note.trim()
    const requestedDocumentTypes = parseDocumentTypes(documentTypesText)

    if (content.reasonRequired && !trimmedReason) {
      setFormError(`${content.reasonLabel} is required.`)
      return
    }

    if (content.noteRequired && !trimmedNote) {
      setFormError('Internal note is required.')
      return
    }

    onSubmit({
      reason: trimmedReason || undefined,
      note: trimmedNote || undefined,
      requestedDocumentTypes: requestedDocumentTypes.length
        ? requestedDocumentTypes
        : undefined,
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
          <p className="font-semibold text-foreground">{vendor.shopName}</p>
          <p className="mt-1 text-muted">
            {vendor.publicVendorId} · {vendor.ownerName ?? 'Owner not available'}
          </p>
          {action.document ? (
            <p className="mt-2 text-muted">
              Document: <span className="text-foreground">{action.document.documentType}</span>
            </p>
          ) : null}
          {action.bankAccount ? (
            <p className="mt-2 text-muted">
              Bank account:{' '}
              <span className="text-foreground">
                {action.bankAccount.bankName} · {action.bankAccount.accountNumberMasked}
              </span>
            </p>
          ) : null}
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {showReason ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                {content.reasonLabel}
                {content.reasonRequired ? <span className="text-danger"> *</span> : null}
              </span>
              <textarea
                className="form-input min-h-28 resize-y"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Enter reason"
                value={reason}
              />
            </label>
          ) : null}

          {showDocumentTypes ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Requested document types
              </span>
              <input
                className="form-input"
                onChange={(event) => setDocumentTypesText(event.target.value)}
                placeholder="PAN, GST, FSSAI"
                value={documentTypesText}
              />
              <span className="block text-xs text-muted">
                Separate multiple document types with commas.
              </span>
            </label>
          ) : null}

          {showNote ? (
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
