import { type FormEvent, type ReactNode, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { featureFlags } from '../../../config/featureFlags'
import { formatMoney } from '../../../utils/formatMoney'
import type {
  AdminCustomerDetail,
  AdminCustomerListItem,
} from '../types/customer.types'

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
  customer: AdminCustomerDetail | AdminCustomerListItem
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CustomerActionFormValues) => void
}

type Customer = AdminCustomerDetail | AdminCustomerListItem

interface ActionFieldsProps {
  customer: Customer
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CustomerActionFormValues) => void
}

function CustomerSummary({ customer, wallet }: { customer: Customer; wallet?: boolean }) {
  return (
    <div className="mt-4 rounded-[1rem] border border-border bg-surface-muted/50 p-3 text-sm">
      <p className="font-semibold text-foreground">{customer.fullName}</p>
      <p className="mt-1 text-muted">
        {customer.mobileNumber ?? 'Mobile not available'} ·{' '}
        {customer.email ?? 'Email not available'}
      </p>
      {wallet ? (
        <p className="mt-2 text-muted">
          Current wallet balance:{' '}
          <span className="text-foreground">
            {formatMoney(customer.walletSummary.creditBalancePaise / 100)}
          </span>
        </p>
      ) : null}
    </div>
  )
}

function ActionFooter({
  isSubmitting,
  onClose,
  submitLabel,
  submitVariant = 'secondary',
}: {
  isSubmitting: boolean
  onClose: () => void
  submitLabel: string
  submitVariant?: 'primary' | 'secondary' | 'danger'
}) {
  return (
    <>
      <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button isLoading={isSubmitting} size="sm" type="submit" variant={submitVariant}>
        {submitLabel}
      </Button>
    </>
  )
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
      {message}
    </div>
  )
}

/**
 * The footer buttons must be inside this `<form>`, not a sibling of it — a
 * `type="submit"` button outside its form fires nothing on click.
 */
function ModalForm({
  children,
  footer,
  onSubmit,
}: {
  children: ReactNode
  footer: ReactNode
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="mt-5 space-y-4" onSubmit={onSubmit}>
      {children}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">{footer}</div>
    </form>
  )
}

function AddNoteFields({ customer, error, isSubmitting, onClose, onSubmit }: ActionFieldsProps) {
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedNote = note.trim()

    if (!trimmedNote) {
      setFormError('Internal note is required.')
      return
    }

    onSubmit({ note: trimmedNote })
  }

  return (
    <Modal
      description="Add an internal note for this customer account."
      title="Add internal note"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <CustomerSummary customer={customer} />
      <ModalForm
        footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Add note" onClose={onClose} />}
        onSubmit={handleSubmit}
      >
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
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function BlockUnblockFields({
  customer,
  error,
  isBlock,
  isSubmitting,
  onClose,
  onSubmit,
}: ActionFieldsProps & { isBlock: boolean }) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setFormError('Reason is required.')
      return
    }

    onSubmit({ reason: trimmedReason })
  }

  return (
    <Modal
      description={
        isBlock
          ? 'Block this customer account and record the reason.'
          : 'Restore access for this customer and record the reason.'
      }
      title={isBlock ? 'Block customer' : 'Unblock customer'}
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <CustomerSummary customer={customer} />
      <ModalForm
        footer={
          <ActionFooter
            isSubmitting={isSubmitting}
            submitLabel={isBlock ? 'Block customer' : 'Unblock customer'}
            submitVariant={isBlock ? 'danger' : 'secondary'}
            onClose={onClose}
          />
        }
        onSubmit={handleSubmit}
      >
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
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function WalletCreditFields({ customer, error, isSubmitting, onClose, onSubmit }: ActionFieldsProps) {
  const [amountText, setAmountText] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [reason, setReason] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (!featureFlags.customerWallet) {
    return null
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()
    const trimmedCurrency = currency.trim().toUpperCase()
    const trimmedReferenceId = referenceId.trim()
    const amountPaise = amountText ? Number(amountText) : undefined

    if (!trimmedReason) {
      setFormError('Reason is required.')
      return
    }

    if (!amountPaise || !Number.isInteger(amountPaise) || amountPaise <= 0) {
      setFormError('Wallet credit amount in paise must be a positive whole number.')
      return
    }

    if (!trimmedCurrency || trimmedCurrency.length !== 3) {
      setFormError('Currency must be a 3-letter code.')
      return
    }

    onSubmit({
      reason: trimmedReason,
      amountPaise,
      currency: trimmedCurrency,
      referenceId: trimmedReferenceId || undefined,
    })
  }

  return (
    <Modal
      description="Apply an internal wallet credit with an audit reason."
      title="Apply wallet credit"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <CustomerSummary customer={customer} wallet />
      <ModalForm
        footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Apply credit" onClose={onClose} />}
        onSubmit={handleSubmit}
      >
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
            <span className="text-sm font-semibold text-foreground">Currency</span>
            <input
              className="form-input"
              maxLength={3}
              onChange={(event) => setCurrency(event.target.value)}
              placeholder="INR"
              value={currency}
            />
          </label>
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm font-semibold text-foreground">Reference ID</span>
            <input
              className="form-input"
              onChange={(event) => setReferenceId(event.target.value)}
              placeholder="SUPPORT-TICKET-2026-101"
              value={referenceId}
            />
          </label>
        </div>
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

/**
 * Dispatches to one field set per action kind, each on the shared Modal
 * shell. External contract is unchanged — CustomersPage and
 * CustomerDetailPage both render this same component.
 */
export function CustomerActionModal({
  action,
  customer,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: CustomerActionModalProps) {
  if (!action) {
    return null
  }

  switch (action.kind) {
    case 'ADD_NOTE':
      return (
        <AddNoteFields
          customer={customer}
          error={error}
          isSubmitting={isSubmitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'BLOCK':
      return (
        <BlockUnblockFields
          customer={customer}
          error={error}
          isBlock
          isSubmitting={isSubmitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'UNBLOCK':
      return (
        <BlockUnblockFields
          customer={customer}
          error={error}
          isBlock={false}
          isSubmitting={isSubmitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'WALLET_CREDIT':
      return (
        <WalletCreditFields
          customer={customer}
          error={error}
          isSubmitting={isSubmitting}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    default:
      return null
  }
}
