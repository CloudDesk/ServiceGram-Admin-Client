import { type FormEvent, useMemo, useState } from 'react'
import { Save, UserRound, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { searchZoneLookupOptions } from '../../lookups/adminLookups'
import type {
  AdminCustomerDetail,
  CustomerProfileUpdatePayload,
} from '../types/customer.types'

interface CustomerProfileEditModalProps {
  customer: AdminCustomerDetail
  error?: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: CustomerProfileUpdatePayload) => void
}

export function CustomerProfileEditModal({
  customer,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: CustomerProfileEditModalProps) {
  const [city, setCity] = useState(customer.city ?? '')
  const [email, setEmail] = useState(customer.email ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [fullName, setFullName] = useState(customer.fullName)
  const [reason, setReason] = useState('')
  const [zoneId, setZoneId] = useState(customer.zone?.zoneId ?? '')
  const [zoneLabel, setZoneLabel] = useState(
    customer.zone ? `${customer.zone.zoneName} · ${customer.zone.city}` : '',
  )

  const changedFields = useMemo(() => {
    const changes = {
      city: city.trim() !== (customer.city ?? ''),
      email: email.trim().toLowerCase() !== (customer.email ?? ''),
      fullName: fullName.trim() !== customer.fullName,
      zoneId: zoneId !== (customer.zone?.zoneId ?? ''),
    }

    return changes
  }, [city, customer, email, fullName, zoneId])

  const hasChanges = Object.values(changedFields).some(Boolean)
  const visibleError = formError ?? error

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedCity = city.trim()
    const trimmedReason = reason.trim()

    if (!hasChanges) {
      setFormError('Change at least one customer profile field.')
      return
    }

    if (!trimmedName) {
      setFormError('Full name is required.')
      return
    }

    if (changedFields.email && !trimmedEmail) {
      setFormError('Email cannot be cleared in this update.')
      return
    }

    if (!trimmedCity) {
      setFormError('City is required.')
      return
    }

    if (!trimmedReason) {
      setFormError('Reason is required.')
      return
    }

    const payload: CustomerProfileUpdatePayload = {
      reason: trimmedReason,
    }

    if (changedFields.fullName) payload.fullName = trimmedName
    if (changedFields.email) payload.email = trimmedEmail
    if (changedFields.city) payload.city = trimmedCity
    if (changedFields.zoneId) payload.zoneId = zoneId || null

    onSubmit(payload)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Edit customer profile
              </h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              {customer.customerId}
            </p>
          </div>
          <button
            aria-label="Close profile editor"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Full name <span className="text-danger">*</span>
              </span>
              <input
                className="form-input"
                maxLength={160}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Email
              </span>
              <input
                className="form-input"
                inputMode="email"
                maxLength={255}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                City <span className="text-danger">*</span>
              </span>
              <input
                className="form-input"
                maxLength={120}
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
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
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Reason <span className="text-danger">*</span>
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              maxLength={500}
              placeholder="Corrected customer profile after support verification"
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
            <Button
              disabled={isSubmitting}
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button disabled={!hasChanges} isLoading={isSubmitting} type="submit">
              <Save className="mr-2 size-4" />
              Save profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
