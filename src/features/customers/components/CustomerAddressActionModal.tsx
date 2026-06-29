import { type FormEvent, useMemo, useState } from 'react'
import { MapPin, Save, Trash2, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { searchZoneLookupOptions } from '../../lookups/adminLookups'
import type {
  AdminCustomerAddress,
  AdminCustomerDetail,
  CustomerAddressPayload,
  CustomerAddressReasonPayload,
} from '../types/customer.types'

export type CustomerAddressActionKind =
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'SET_DEFAULT'

export interface CustomerAddressActionSelection {
  kind: CustomerAddressActionKind
  address?: AdminCustomerAddress
}

interface CustomerAddressActionModalProps {
  action: CustomerAddressActionSelection | null
  customer: AdminCustomerDetail
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CustomerAddressPayload | CustomerAddressReasonPayload) => void
}

function addressSummary(address?: AdminCustomerAddress) {
  if (!address) return 'New address'

  return [
    address.label,
    address.addressLine1,
    address.city,
    address.pincode,
  ].filter(Boolean).join(' · ')
}

function optionalText(value: string) {
  const trimmed = value.trim()
  return trimmed || undefined
}

function optionalNumber(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return undefined
  }

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function CustomerAddressActionModal({
  action,
  customer,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: CustomerAddressActionModalProps) {
  const address = action?.address
  const isFormAction = action?.kind === 'CREATE' || action?.kind === 'EDIT'
  const [addressLine1, setAddressLine1] = useState(address?.addressLine1 ?? '')
  const [addressLine2, setAddressLine2] = useState(address?.addressLine2 ?? '')
  const [city, setCity] = useState(address?.city ?? customer.city ?? '')
  const [contactMobile, setContactMobile] = useState(address?.contactMobile ?? '')
  const [contactName, setContactName] = useState(address?.contactName ?? customer.fullName)
  const [formError, setFormError] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false)
  const [label, setLabel] = useState(address?.label ?? '')
  const [landmark, setLandmark] = useState(address?.landmark ?? '')
  const [latitude, setLatitude] = useState(address?.latitude ?? '')
  const [longitude, setLongitude] = useState(address?.longitude ?? '')
  const [pincode, setPincode] = useState(address?.pincode ?? '')
  const [reason, setReason] = useState('')
  const [state, setState] = useState(address?.state ?? '')
  const [zoneId, setZoneId] = useState(address?.zone?.zoneId ?? customer.zone?.zoneId ?? '')
  const [zoneLabel, setZoneLabel] = useState(
    address?.zone
      ? `${address.zone.zoneName} · ${address.zone.city}`
      : customer.zone
        ? `${customer.zone.zoneName} · ${customer.zone.city}`
        : '',
  )

  const title = useMemo(() => {
    if (action?.kind === 'CREATE') return 'Add address'
    if (action?.kind === 'EDIT') return 'Edit address'
    if (action?.kind === 'SET_DEFAULT') return 'Set default address'
    return 'Delete address'
  }, [action?.kind])

  if (!action) {
    return null
  }

  const visibleError = formError ?? error

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setFormError('Reason is required.')
      return
    }

    if (!isFormAction) {
      onSubmit({ reason: trimmedReason })
      return
    }

    const trimmedAddressLine1 = addressLine1.trim()
    const trimmedCity = city.trim()

    if (!trimmedAddressLine1) {
      setFormError('Address line 1 is required.')
      return
    }

    if (!trimmedCity) {
      setFormError('City is required.')
      return
    }

    const payload: CustomerAddressPayload = {
      addressLine1: trimmedAddressLine1,
      addressLine2: optionalText(addressLine2),
      city: trimmedCity,
      contactMobile: optionalText(contactMobile),
      contactName: optionalText(contactName),
      isDefault,
      label: optionalText(label),
      landmark: optionalText(landmark),
      latitude: optionalNumber(latitude),
      longitude: optionalNumber(longitude),
      pincode: optionalText(pincode),
      reason: trimmedReason,
      state: optionalText(state),
      zoneId: zoneId || undefined,
    }

    onSubmit(payload)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              {addressSummary(address)}
            </p>
          </div>
          <button
            aria-label="Close address action"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {isFormAction ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Label</span>
                <input className="form-input" maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Contact name</span>
                <input className="form-input" maxLength={160} value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Contact mobile</span>
                <input className="form-input" maxLength={20} value={contactMobile} onChange={(event) => setContactMobile(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Address line 1 <span className="text-danger">*</span>
                </span>
                <input className="form-input" maxLength={500} value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Address line 2</span>
                <input className="form-input" maxLength={500} value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Landmark</span>
                <input className="form-input" maxLength={500} value={landmark} onChange={(event) => setLandmark(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  City <span className="text-danger">*</span>
                </span>
                <input className="form-input" maxLength={120} value={city} onChange={(event) => setCity(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">State</span>
                <input className="form-input" maxLength={120} value={state} onChange={(event) => setState(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Pincode</span>
                <input className="form-input" maxLength={12} value={pincode} onChange={(event) => setPincode(event.target.value)} />
              </label>

              <LookupSelect
                fetchOptions={searchZoneLookupOptions}
                label="Zone"
                placeholder="Select zone"
                queryKey={['lookup', 'zones']}
                selectedLabel={zoneLabel}
                value={zoneId}
                onChange={(value, option) => {
                  setZoneId(value)
                  setZoneLabel(
                    option ? `${option.label}${option.meta ? ` · ${option.meta}` : ''}` : '',
                  )
                }}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Latitude</span>
                <input className="form-input" inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Longitude</span>
                <input className="form-input" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <input checked={isDefault} type="checkbox" onChange={(event) => setIsDefault(event.target.checked)} />
                Default address
              </label>
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Reason <span className="text-danger">*</span>
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {visibleError ? (
            <div className="rounded-[0.75rem] border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
              {visibleError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={isSubmitting} type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              type="submit"
              variant={action.kind === 'DELETE' ? 'danger' : 'primary'}
            >
              {action.kind === 'DELETE' ? (
                <Trash2 className="mr-2 size-4" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              {action.kind === 'DELETE' ? 'Delete address' : 'Save address'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
