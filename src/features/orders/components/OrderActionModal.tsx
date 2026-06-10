import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type {
  AdminOrderDetail,
  AdminOrderStatus,
  LogisticsIssueType,
  LogisticsPackageCondition,
  OrderMediaPurpose,
  OrderProofMimeType,
} from '../types/order.types'

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
  order: AdminOrderDetail
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

function titleForAction(action: OrderActionSelection) {
  if (action.kind === 'UPDATE_STATUS') {
    return `Mark ${action.targetStatus?.replaceAll('_', ' ').toLowerCase()}`
  }

  return {
    CANCEL: 'Cancel order',
    INITIATE_REFUND: 'Initiate refund',
    GENERATE_DELIVERY_OTP: 'Generate delivery OTP',
    CONFIRM_DELIVERY_OTP: 'Confirm delivery OTP',
    ADD_NOTE: 'Add internal note',
    CREATE_PROOF_UPLOAD_INTENT: 'Create proof upload intent',
  }[action.kind]
}

export function OrderActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  order,
}: OrderActionModalProps) {
  const [amountPaise, setAmountPaise] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState('15')
  const [fileName, setFileName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [internalNote, setInternalNote] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [issueType, setIssueType] = useState('')
  const [mimeType, setMimeType] = useState<OrderProofMimeType>('image/jpeg')
  const [note, setNote] = useState('')
  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [notifyVendor, setNotifyVendor] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [packageCondition, setPackageCondition] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [proofMediaAssetId, setProofMediaAssetId] = useState('')
  const [purpose, setPurpose] = useState<OrderMediaPurpose>('DELIVERY_PROOF')
  const [reason, setReason] = useState('')
  const [sizeBytes, setSizeBytes] = useState('')

  if (!action) {
    return null
  }

  const requiresReason =
    action.kind === 'CANCEL' || action.kind === 'INITIATE_REFUND'
  const showLogisticsFields =
    action.kind === 'UPDATE_STATUS' || action.kind === 'CONFIRM_DELIVERY_OTP'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (requiresReason && reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    if (action.kind === 'CONFIRM_DELIVERY_OTP' && !/^[0-9]{6}$/.test(otpCode)) {
      setFormError('OTP must be a 6 digit code.')
      return
    }

    if (action.kind === 'ADD_NOTE' && note.trim().length < 3) {
      setFormError('Note must be at least 3 characters.')
      return
    }

    if (action.kind === 'CREATE_PROOF_UPLOAD_INTENT') {
      if (!fileName.trim() || Number(sizeBytes) <= 0) {
        setFormError('File name and size are required.')
        return
      }
    }

    onSubmit({
      targetStatus: action.targetStatus,
      eventTime: eventTime || undefined,
      internalNote: internalNote.trim() || undefined,
      proofMediaAssetId: proofMediaAssetId.trim() || undefined,
      packageCondition: packageCondition
        ? (packageCondition as LogisticsPackageCondition)
        : undefined,
      issueType: issueType ? (issueType as LogisticsIssueType) : undefined,
      notifyCustomer,
      notifyVendor,
      reason: reason.trim() || undefined,
      paymentId: paymentId.trim() || undefined,
      amountPaise: amountPaise ? Number(amountPaise) : undefined,
      expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : undefined,
      otpCode: otpCode.trim() || undefined,
      note: note.trim() || undefined,
      isPinned,
      purpose,
      fileName: fileName.trim() || undefined,
      mimeType,
      sizeBytes: sizeBytes ? Number(sizeBytes) : undefined,
    })
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
              {titleForAction(action)}
            </h2>
            <p className="text-sm text-muted">
              {order.publicOrderId} · {order.customer.fullName} · {order.vendor.shopName}
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
          {showLogisticsFields ? (
            <>
              {action.kind === 'CONFIRM_DELIVERY_OTP' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-foreground">Delivery OTP *</span>
                  <input
                    className="form-input"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                  />
                </label>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-foreground">Event time</span>
                  <input
                    className="form-input"
                    type="datetime-local"
                    value={eventTime}
                    onChange={(event) => setEventTime(event.target.value)}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-foreground">Proof media asset ID</span>
                  <input
                    className="form-input"
                    value={proofMediaAssetId}
                    onChange={(event) => setProofMediaAssetId(event.target.value)}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-foreground">Package condition</span>
                  <select
                    className="form-input"
                    value={packageCondition}
                    onChange={(event) => setPackageCondition(event.target.value)}
                  >
                    <option value="">Not specified</option>
                    {packageConditions.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                {action.kind === 'UPDATE_STATUS' ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-foreground">Issue type</span>
                    <select
                      className="form-input"
                      value={issueType}
                      onChange={(event) => setIssueType(event.target.value)}
                    >
                      <option value="">Not specified</option>
                      {issueTypes.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                ) : null}
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Internal note</span>
                <textarea
                  className="form-input min-h-24 resize-y"
                  value={internalNote}
                  onChange={(event) => setInternalNote(event.target.value)}
                />
              </label>
            </>
          ) : null}

          {requiresReason || action.kind === 'GENERATE_DELIVERY_OTP' ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Reason{requiresReason ? ' *' : ''}
              </span>
              <textarea
                className="form-input min-h-24 resize-y"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : null}

          {action.kind === 'INITIATE_REFUND' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Payment ID</span>
                <input className="form-input" value={paymentId} onChange={(event) => setPaymentId(event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Amount paise</span>
                <input className="form-input" type="number" value={amountPaise} onChange={(event) => setAmountPaise(event.target.value)} />
              </label>
            </div>
          ) : null}

          {action.kind === 'GENERATE_DELIVERY_OTP' ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Expires in minutes</span>
              <input className="form-input" type="number" value={expiresInMinutes} onChange={(event) => setExpiresInMinutes(event.target.value)} />
            </label>
          ) : null}

          {action.kind === 'ADD_NOTE' ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Internal note *</span>
                <textarea className="form-input min-h-28 resize-y" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input checked={isPinned} type="checkbox" onChange={(event) => setIsPinned(event.target.checked)} />
                Pin note
              </label>
            </>
          ) : null}

          {action.kind === 'CREATE_PROOF_UPLOAD_INTENT' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Purpose</span>
                <select className="form-input" value={purpose} onChange={(event) => setPurpose(event.target.value as OrderMediaPurpose)}>
                  {mediaPurposes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">MIME type</span>
                <select className="form-input" value={mimeType} onChange={(event) => setMimeType(event.target.value as OrderProofMimeType)}>
                  {mimeTypes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">File name *</span>
                <input className="form-input" value={fileName} onChange={(event) => setFileName(event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Size bytes *</span>
                <input className="form-input" type="number" value={sizeBytes} onChange={(event) => setSizeBytes(event.target.value)} />
              </label>
            </div>
          ) : null}

          {action.kind === 'UPDATE_STATUS' || action.kind === 'CANCEL' || action.kind === 'GENERATE_DELIVERY_OTP' ? (
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input checked={notifyCustomer} type="checkbox" onChange={(event) => setNotifyCustomer(event.target.checked)} />
                Notify customer
              </label>
              {action.kind !== 'GENERATE_DELIVERY_OTP' ? (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input checked={notifyVendor} type="checkbox" onChange={(event) => setNotifyVendor(event.target.checked)} />
                  Notify vendor
                </label>
              ) : null}
            </div>
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
            <Button isLoading={isSubmitting} size="sm" type="submit" variant={action.kind === 'CANCEL' ? 'danger' : 'primary'}>
              Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
