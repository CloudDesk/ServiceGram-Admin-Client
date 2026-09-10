import { type FormEvent, type ReactNode, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import type {
  AdminOrderSummary,
  AdminOrderStatus,
  LogisticsIssueType,
  LogisticsPackageCondition,
  OrderMediaPurpose,
  OrderProofMimeType,
} from '../types/order.types'

/**
 * Mirrors the backend `refund_reason_code` enum. Approval routing reads this;
 * the free-text reason is not machine-readable.
 */
export type RefundReasonCode =
  | 'PRICE_ADJUSTMENT'
  | 'CUSTOMER_CANCELLATION'
  | 'VENDOR_CANCELLATION'
  | 'SERVICE_ISSUE'
  | 'DUPLICATE_PAYMENT'
  | 'DISPUTE'

const refundReasonCodes: RefundReasonCode[] = [
  'PRICE_ADJUSTMENT',
  'CUSTOMER_CANCELLATION',
  'VENDOR_CANCELLATION',
  'SERVICE_ISSUE',
  'DUPLICATE_PAYMENT',
  'DISPUTE',
]

/**
 * Three states, not two. "Not assessed" is the default and is sent as
 * undefined — approval rules treat it as unknown and route to manual review
 * rather than auto-approving on an assessment nobody made.
 */
const disputeStates = ['UNKNOWN', 'NO', 'YES'] as const
type DisputeState = (typeof disputeStates)[number]

const disputeLabels: Record<DisputeState, string> = {
  NO: 'No dispute',
  UNKNOWN: 'Not assessed',
  YES: 'Disputed',
}

export type OrderActionKind =
  | 'UPDATE_STATUS'
  | 'CANCEL'
  | 'INITIATE_REFUND'
  | 'GENERATE_DELIVERY_OTP'
  | 'CONFIRM_DELIVERY_OTP'
  | 'ADD_NOTE'
  | 'CREATE_PROOF_UPLOAD_INTENT'

export interface OrderActionSelection {
  kind: OrderActionKind
  targetStatus?: AdminOrderStatus
}

export interface OrderActionFormValues {
  targetStatus?: AdminOrderStatus
  eventTime?: string
  internalNote?: string
  proofMediaAssetId?: string
  packageCondition?: LogisticsPackageCondition
  issueType?: LogisticsIssueType
  notifyCustomer?: boolean
  notifyVendor?: boolean
  reason?: string
  paymentId?: string
  amountPaise?: number
  reasonCode?: RefundReasonCode
  hasDispute?: boolean
  expiresInMinutes?: number
  otpCode?: string
  note?: string
  isPinned?: boolean
  purpose?: OrderMediaPurpose
  fileName?: string
  mimeType?: OrderProofMimeType
  sizeBytes?: number
}

interface OrderActionModalProps {
  action: OrderActionSelection | null
  error?: string | null
  isSubmitting: boolean
  order: AdminOrderSummary
  onClose: () => void
  onSubmit: (values: OrderActionFormValues) => void
}

/** Shared by every action's field set — order identity never changes per action. */
interface ActionFieldsProps<TAction extends OrderActionSelection> {
  action: TAction
  order: AdminOrderSummary
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: OrderActionFormValues) => void
}

const packageConditions: LogisticsPackageCondition[] = [
  'GOOD',
  'DAMAGED',
  'OPENED',
  'MISSING_PARTS',
  'UNKNOWN',
]

const issueTypes: LogisticsIssueType[] = [
  'DAMAGED',
  'LOST',
  'WRONG_ITEM',
  'CUSTOMER_UNAVAILABLE',
  'OTHER',
]

const mediaPurposes: OrderMediaPurpose[] = [
  'PICKUP_PROOF',
  'VENDOR_HANDOVER_PROOF',
  'SERVICE_PROOF',
  'RETURN_COLLECTION_PROOF',
  'DELIVERY_PROOF',
  'ISSUE_PROOF',
]

const mimeTypes: OrderProofMimeType[] = ['image/jpeg', 'image/png', 'image/webp']

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function mimeTypeLabel(value: OrderProofMimeType) {
  return {
    'image/jpeg': 'JPEG image',
    'image/png': 'PNG image',
    'image/webp': 'WebP image',
  }[value]
}

function orderSubtitle(order: AdminOrderSummary) {
  return `${order.publicOrderId} · ${order.customer.fullName} · ${order.vendor.shopName}`
}

/** Required-field marker, styled the same way in every modal in the app. */
function Required() {
  return <span className="text-danger"> *</span>
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null

  return (
    <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
      {message}
    </div>
  )
}

function ActionFooter({
  isSubmitting,
  onClose,
  submitLabel,
  submitVariant = 'primary',
}: {
  isSubmitting: boolean
  onClose: () => void
  submitLabel: string
  submitVariant?: 'primary' | 'danger'
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

/** Notify-customer / notify-vendor checkboxes, shared by the three actions that offer them. */
function NotifyToggles({
  notifyCustomer,
  notifyVendor,
  onNotifyCustomerChange,
  onNotifyVendorChange,
  showVendorToggle = true,
}: {
  notifyCustomer: boolean
  notifyVendor: boolean
  onNotifyCustomerChange: (value: boolean) => void
  onNotifyVendorChange: (value: boolean) => void
  showVendorToggle?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          checked={notifyCustomer}
          type="checkbox"
          onChange={(event) => onNotifyCustomerChange(event.target.checked)}
        />
        Notify customer
      </label>
      {showVendorToggle ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            checked={notifyVendor}
            type="checkbox"
            onChange={(event) => onNotifyVendorChange(event.target.checked)}
          />
          Notify vendor
        </label>
      ) : null}
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
    <form className="space-y-4" onSubmit={onSubmit}>
      {children}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">{footer}</div>
    </form>
  )
}

/** Mark a status: pickup, handover, delivered, and every other lifecycle transition. */
function UpdateStatusFields({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'UPDATE_STATUS' }>) {
  const [eventTime, setEventTime] = useState('')
  const [proofMediaAssetId, setProofMediaAssetId] = useState('')
  const [packageCondition, setPackageCondition] = useState('')
  const [issueType, setIssueType] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [notifyVendor, setNotifyVendor] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (internalNote.trim().length < 3) {
      setFormError('Internal note must be at least 3 characters for manual logistics updates.')
      return
    }

    onSubmit({
      targetStatus: action.targetStatus,
      eventTime: eventTime || undefined,
      internalNote: internalNote.trim() || undefined,
      proofMediaAssetId: proofMediaAssetId.trim() || undefined,
      packageCondition: packageCondition ? (packageCondition as LogisticsPackageCondition) : undefined,
      issueType: issueType ? (issueType as LogisticsIssueType) : undefined,
      notifyCustomer,
      notifyVendor,
    })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title={`Mark ${humanizeCode(action.targetStatus)}`}
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Mark status" onClose={onClose} />} onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Event time</span>
            <input className="form-input" type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Proof asset</span>
            <input className="form-input" value={proofMediaAssetId} onChange={(event) => setProofMediaAssetId(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Package condition</span>
            <select className="form-input" value={packageCondition} onChange={(event) => setPackageCondition(event.target.value)}>
              <option value="">Not specified</option>
              {packageConditions.map((item) => (
                <option key={item} value={item}>{humanizeCode(item)}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Issue type</span>
            <select className="form-input" value={issueType} onChange={(event) => setIssueType(event.target.value)}>
              <option value="">Not specified</option>
              {issueTypes.map((item) => (
                <option key={item} value={item}>{humanizeCode(item)}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Internal note<Required /></span>
          <textarea
            className="form-input min-h-24 resize-y"
            placeholder="Example: Pickup completed by operations runner."
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
          />
        </label>
        <NotifyToggles
          notifyCustomer={notifyCustomer}
          notifyVendor={notifyVendor}
          onNotifyCustomerChange={setNotifyCustomer}
          onNotifyVendorChange={setNotifyVendor}
        />
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function CancelFields({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'CANCEL' }>) {
  const [reason, setReason] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [notifyVendor, setNotifyVendor] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    onSubmit({ reason: reason.trim(), notifyCustomer, notifyVendor })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title="Cancel order"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Cancel order" submitVariant="danger" onClose={onClose} />} onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Reason<Required /></span>
          <textarea className="form-input min-h-24 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <NotifyToggles
          notifyCustomer={notifyCustomer}
          notifyVendor={notifyVendor}
          onNotifyCustomerChange={setNotifyCustomer}
          onNotifyVendorChange={setNotifyVendor}
        />
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function RefundFields({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'INITIATE_REFUND' }>) {
  const [reason, setReason] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [amountPaise, setAmountPaise] = useState('')
  const [reasonCode, setReasonCode] = useState<'' | RefundReasonCode>('')
  const [disputeState, setDisputeState] = useState<DisputeState>('UNKNOWN')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    onSubmit({
      reason: reason.trim(),
      paymentId: paymentId.trim() || undefined,
      amountPaise: amountPaise ? Number(amountPaise) : undefined,
      reasonCode: reasonCode || undefined,
      hasDispute: disputeState === 'UNKNOWN' ? undefined : disputeState === 'YES',
    })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title="Start refund"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Start refund" onClose={onClose} />} onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Reason<Required /></span>
          <textarea className="form-input min-h-24 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Payment reference</span>
            <input className="form-input" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Refund amount (paise)</span>
            <input className="form-input" type="number" value={amountPaise} onChange={(event) => setAmountPaise(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Reason category</span>
            <select className="form-input" value={reasonCode} onChange={(event) => setReasonCode(event.target.value as '' | RefundReasonCode)}>
              <option value="">Not set</option>
              {refundReasonCodes.map((item) => (
                <option key={item} value={item}>{humanizeCode(item)}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Dispute raised?</span>
            <select className="form-input" value={disputeState} onChange={(event) => setDisputeState(event.target.value as DisputeState)}>
              {disputeStates.map((item) => (
                <option key={item} value={item}>{disputeLabels[item]}</option>
              ))}
            </select>
          </label>
          <p className="text-xs leading-5 text-muted sm:col-span-2">
            Both fields drive approval routing. Leaving the dispute check unassessed sends the
            refund to manual review instead of auto-approving it.
          </p>
        </div>
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function GenerateOtpFields({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'GENERATE_DELIVERY_OTP' }>) {
  const [reason, setReason] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState('15')
  const [notifyCustomer, setNotifyCustomer] = useState(true)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    onSubmit({
      reason: reason.trim() || undefined,
      expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : undefined,
      notifyCustomer,
    })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title="Generate delivery OTP"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Generate OTP" onClose={onClose} />} onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Reason</span>
          <textarea className="form-input min-h-24 resize-y" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Expires in minutes</span>
          <input className="form-input" type="number" value={expiresInMinutes} onChange={(event) => setExpiresInMinutes(event.target.value)} />
        </label>
        <NotifyToggles
          notifyCustomer={notifyCustomer}
          notifyVendor={false}
          showVendorToggle={false}
          onNotifyCustomerChange={setNotifyCustomer}
          onNotifyVendorChange={() => undefined}
        />
        <FormError message={error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function ConfirmOtpFields({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'CONFIRM_DELIVERY_OTP' }>) {
  const [otpCode, setOtpCode] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [proofMediaAssetId, setProofMediaAssetId] = useState('')
  const [packageCondition, setPackageCondition] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!/^[0-9]{6}$/.test(otpCode)) {
      setFormError('OTP must be a 6 digit code.')
      return
    }

    onSubmit({
      otpCode: otpCode.trim(),
      eventTime: eventTime || undefined,
      internalNote: internalNote.trim() || undefined,
      proofMediaAssetId: proofMediaAssetId.trim() || undefined,
      packageCondition: packageCondition ? (packageCondition as LogisticsPackageCondition) : undefined,
    })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title="Confirm delivery OTP"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Confirm OTP" onClose={onClose} />} onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Delivery OTP<Required /></span>
          <input className="form-input" maxLength={6} value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Event time</span>
            <input className="form-input" type="datetime-local" value={eventTime} onChange={(event) => setEventTime(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Proof asset</span>
            <input className="form-input" value={proofMediaAssetId} onChange={(event) => setProofMediaAssetId(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Package condition</span>
            <select className="form-input" value={packageCondition} onChange={(event) => setPackageCondition(event.target.value)}>
              <option value="">Not specified</option>
              {packageConditions.map((item) => (
                <option key={item} value={item}>{humanizeCode(item)}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Internal note</span>
          <textarea className="form-input min-h-24 resize-y" value={internalNote} onChange={(event) => setInternalNote(event.target.value)} />
        </label>
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function AddNoteFields({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'ADD_NOTE' }>) {
  const [note, setNote] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (note.trim().length < 3) {
      setFormError('Note must be at least 3 characters.')
      return
    }

    onSubmit({ note: note.trim(), isPinned })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title="Add internal note"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Add note" onClose={onClose} />} onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-foreground">Internal note<Required /></span>
          <textarea className="form-input min-h-28 resize-y" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input checked={isPinned} type="checkbox" onChange={(event) => setIsPinned(event.target.checked)} />
          Pin note
        </label>
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

function ProofUploadFields({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: ActionFieldsProps<OrderActionSelection & { kind: 'CREATE_PROOF_UPLOAD_INTENT' }>) {
  const [purpose, setPurpose] = useState<OrderMediaPurpose>('DELIVERY_PROOF')
  const [mimeType, setMimeType] = useState<OrderProofMimeType>('image/jpeg')
  const [fileName, setFileName] = useState('')
  const [sizeBytes, setSizeBytes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!fileName.trim() || Number(sizeBytes) <= 0) {
      setFormError('File name and size are required.')
      return
    }

    onSubmit({
      purpose,
      mimeType,
      fileName: fileName.trim(),
      sizeBytes: Number(sizeBytes),
    })
  }

  return (
    <Modal
      description={orderSubtitle(order)}
      size="lg"
      title="Request proof upload"
      closeDisabled={isSubmitting}
      onClose={onClose}
    >
      <ModalForm footer={<ActionFooter isSubmitting={isSubmitting} submitLabel="Request upload" onClose={onClose} />} onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Purpose</span>
            <select className="form-input" value={purpose} onChange={(event) => setPurpose(event.target.value as OrderMediaPurpose)}>
              {mediaPurposes.map((item) => (
                <option key={item} value={item}>{humanizeCode(item)}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">File type</span>
            <select className="form-input" value={mimeType} onChange={(event) => setMimeType(event.target.value as OrderProofMimeType)}>
              {mimeTypes.map((item) => (
                <option key={item} value={item}>{mimeTypeLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">File name<Required /></span>
            <input className="form-input" value={fileName} onChange={(event) => setFileName(event.target.value)} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">File size (bytes)<Required /></span>
            <input className="form-input" type="number" value={sizeBytes} onChange={(event) => setSizeBytes(event.target.value)} />
          </label>
        </div>
        <FormError message={formError ?? error ?? null} />
      </ModalForm>
    </Modal>
  )
}

/**
 * Dispatches to one small, independently-testable field set per order action
 * kind, each on the shared Modal shell. External contract (props + the
 * exported types below) is unchanged — VendorDetailPage renders this same
 * component for a vendor's Orders tab, so the split stays internal.
 */
export function OrderActionModal({ action, error, isSubmitting, onClose, onSubmit, order }: OrderActionModalProps) {
  if (!action) {
    return null
  }

  switch (action.kind) {
    case 'UPDATE_STATUS':
      return (
        <UpdateStatusFields
          action={action as OrderActionSelection & { kind: 'UPDATE_STATUS' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'CANCEL':
      return (
        <CancelFields
          action={action as OrderActionSelection & { kind: 'CANCEL' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'INITIATE_REFUND':
      return (
        <RefundFields
          action={action as OrderActionSelection & { kind: 'INITIATE_REFUND' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'GENERATE_DELIVERY_OTP':
      return (
        <GenerateOtpFields
          action={action as OrderActionSelection & { kind: 'GENERATE_DELIVERY_OTP' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'CONFIRM_DELIVERY_OTP':
      return (
        <ConfirmOtpFields
          action={action as OrderActionSelection & { kind: 'CONFIRM_DELIVERY_OTP' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'ADD_NOTE':
      return (
        <AddNoteFields
          action={action as OrderActionSelection & { kind: 'ADD_NOTE' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    case 'CREATE_PROOF_UPLOAD_INTENT':
      return (
        <ProofUploadFields
          action={action as OrderActionSelection & { kind: 'CREATE_PROOF_UPLOAD_INTENT' }}
          error={error}
          isSubmitting={isSubmitting}
          order={order}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )
    default:
      return null
  }
}
