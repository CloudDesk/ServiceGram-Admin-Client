import { type FormEvent, useMemo, useState } from 'react'
import { Save, Store, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import {
  searchCategoryLookupOptions,
  searchZoneLookupOptions,
} from '../../lookups/adminLookups'
import type {
  VendorDetail,
  VendorProfileUpdatePayload,
} from '../types/vendor.types'

interface VendorProfileEditModalProps {
  error?: string | null
  isSubmitting: boolean
  vendor: VendorDetail
  onClose: () => void
  onSubmit: (values: VendorProfileUpdatePayload) => void
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function coordinateText(value: string | null) {
  return value ?? ''
}

function parseCoordinate(
  value: string,
  label: string,
  min: number,
  max: number,
) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`)
  }

  return parsed
}

export function VendorProfileEditModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  vendor,
}: VendorProfileEditModalProps) {
  const [addressLine1, setAddressLine1] = useState(vendor.address.addressLine1)
  const [addressLine2, setAddressLine2] = useState(
    vendor.address.addressLine2 ?? '',
  )
  const [categoryId, setCategoryId] = useState(
    vendor.category?.categoryId ?? '',
  )
  const [categoryLabel, setCategoryLabel] = useState(
    vendor.category
      ? `${vendor.category.name} · ${vendor.category.categoryCode}`
      : '',
  )
  const [city, setCity] = useState(vendor.address.city)
  const [formError, setFormError] = useState<string | null>(null)
  const [latitude, setLatitude] = useState(
    coordinateText(vendor.address.latitude),
  )
  const [longitude, setLongitude] = useState(
    coordinateText(vendor.address.longitude),
  )
  const [ownerName, setOwnerName] = useState(vendor.ownerName ?? '')
  const [pincode, setPincode] = useState(vendor.address.pincode ?? '')
  const [reason, setReason] = useState('')
  const [referralId, setReferralId] = useState(vendor.referralId ?? '')
  const [shopName, setShopName] = useState(vendor.shopName)
  const [zoneId, setZoneId] = useState(vendor.address.zone?.zoneId ?? '')
  const [zoneLabel, setZoneLabel] = useState(
    vendor.address.zone
      ? `${vendor.address.zone.zoneName} · ${vendor.address.zone.city}`
      : '',
  )

  const changedFields = useMemo(
    () => ({
      addressLine1: addressLine1.trim() !== vendor.address.addressLine1,
      addressLine2: nullableText(addressLine2) !== vendor.address.addressLine2,
      categoryId: categoryId !== (vendor.category?.categoryId ?? ''),
      city: city.trim() !== vendor.address.city,
      latitude: latitude.trim() !== (vendor.address.latitude ?? ''),
      longitude: longitude.trim() !== (vendor.address.longitude ?? ''),
      ownerName: nullableText(ownerName) !== vendor.ownerName,
      pincode: nullableText(pincode) !== vendor.address.pincode,
      referralId: nullableText(referralId) !== vendor.referralId,
      shopName: shopName.trim() !== vendor.shopName,
      zoneId: zoneId !== (vendor.address.zone?.zoneId ?? ''),
    }),
    [
      addressLine1,
      addressLine2,
      categoryId,
      city,
      latitude,
      longitude,
      ownerName,
      pincode,
      referralId,
      shopName,
      vendor,
      zoneId,
    ],
  )
  const hasChanges = Object.values(changedFields).some(Boolean)
  const visibleError = formError ?? error

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    try {
      const trimmedShopName = shopName.trim()
      const trimmedAddressLine1 = addressLine1.trim()
      const trimmedCity = city.trim()
      const trimmedReason = reason.trim()

      if (!hasChanges) {
        setFormError('Change at least one vendor profile field.')
        return
      }

      if (!trimmedShopName) {
        setFormError('Shop name is required.')
        return
      }

      if (changedFields.categoryId && !categoryId) {
        setFormError('Category cannot be cleared from this editor.')
        return
      }

      if (!trimmedAddressLine1) {
        setFormError('Address line 1 is required.')
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

      const payload: VendorProfileUpdatePayload = {
        reason: trimmedReason,
      }

      if (changedFields.shopName) payload.shopName = trimmedShopName
      if (changedFields.ownerName) payload.ownerName = nullableText(ownerName)
      if (changedFields.categoryId) payload.categoryId = categoryId
      if (changedFields.addressLine1) payload.addressLine1 = trimmedAddressLine1
      if (changedFields.addressLine2)
        payload.addressLine2 = nullableText(addressLine2)
      if (changedFields.city) payload.city = trimmedCity
      if (changedFields.zoneId) payload.zoneId = zoneId || null
      if (changedFields.pincode) payload.pincode = nullableText(pincode)
      if (changedFields.latitude) {
        payload.latitude = parseCoordinate(latitude, 'Latitude', -90, 90)
      }
      if (changedFields.longitude) {
        payload.longitude = parseCoordinate(longitude, 'Longitude', -180, 180)
      }
      if (changedFields.referralId)
        payload.referralId = nullableText(referralId)

      onSubmit(payload)
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Vendor profile update failed.',
      )
    }
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Store className="size-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Edit vendor profile
              </h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              {vendor.publicVendorId} · {vendor.vendorId}
            </p>
          </div>
          <button
            aria-label="Close vendor profile editor"
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
                Shop name <span className="text-danger">*</span>
              </span>
              <input
                className="form-input"
                maxLength={180}
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Owner name
              </span>
              <input
                className="form-input"
                maxLength={160}
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
              />
            </label>

            <LookupSelect
              fetchOptions={searchCategoryLookupOptions}
              label="Category"
              placeholder="Select category"
              queryKey={['lookup', 'categories', 'vendor-profile']}
              selectedLabel={categoryLabel}
              value={categoryId}
              onChange={(value, option) => {
                setCategoryId(value)
                setCategoryLabel(
                  option
                    ? `${option.label}${option.meta ? ` · ${option.meta}` : ''}`
                    : '',
                )
              }}
            />

            <LookupSelect
              fetchOptions={searchZoneLookupOptions}
              label="Zone"
              placeholder="Select zone"
              queryKey={['lookup', 'zones', 'vendor-profile']}
              selectedLabel={zoneLabel}
              value={zoneId}
              onChange={(value, option) => {
                setZoneId(value)
                setZoneLabel(
                  option
                    ? `${option.label}${option.meta ? ` · ${option.meta}` : ''}`
                    : '',
                )
              }}
            />

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Address line 1 <span className="text-danger">*</span>
              </span>
              <input
                className="form-input"
                maxLength={500}
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
              />
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Address line 2
              </span>
              <input
                className="form-input"
                maxLength={500}
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
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

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Pincode
              </span>
              <input
                className="form-input"
                inputMode="numeric"
                maxLength={12}
                value={pincode}
                onChange={(event) => setPincode(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Latitude
              </span>
              <input
                className="form-input"
                inputMode="decimal"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">
                Longitude
              </span>
              <input
                className="form-input"
                inputMode="decimal"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
              />
            </label>

            <label className="block space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">
                Referral ID
              </span>
              <input
                className="form-input"
                maxLength={80}
                value={referralId}
                onChange={(event) => setReferralId(event.target.value)}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Reason <span className="text-danger">*</span>
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              maxLength={500}
              placeholder="Corrected vendor profile after business owner verification"
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
            <Button
              disabled={!hasChanges}
              isLoading={isSubmitting}
              type="submit"
            >
              <Save className="mr-2 size-4" />
              Save profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
