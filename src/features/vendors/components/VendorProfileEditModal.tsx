import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import {
  CalendarClock,
  History,
  MapPin,
  Save,
  ShieldCheck,
  Store,
  UserCog,
  X,
} from 'lucide-react'
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

const profileInputClassName =
  'h-10 w-full rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60'
const profileTextareaClassName =
  'min-h-28 w-full resize-y rounded-[0.75rem] border border-border bg-surface px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-primary/45 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60'

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizePhoneNumber(value: string) {
  return value.trim().replace(/\s+/g, '')
}

function isValidPhoneNumber(value: string) {
  return /^\+?[1-9]\d{7,14}$/.test(value)
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

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return 'Not available'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function latestTimelineDate(vendor: VendorDetail) {
  return vendor.reviewTimeline.reduce<string | null>((latest, event) => {
    if (!latest) {
      return event.createdAt
    }

    return Date.parse(event.createdAt) > Date.parse(latest)
      ? event.createdAt
      : latest
  }, null)
}

function summaryToneClasses(tone: 'success' | 'info' | 'warning' | 'neutral') {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function EditSummaryCard({
  icon,
  label,
  meta,
  tone = 'neutral',
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone?: 'success' | 'info' | 'warning' | 'neutral'
  value: string
}) {
  return (
    <div className="min-h-[4.35rem] rounded-[0.75rem] border border-border bg-surface p-2.5 shadow-surface">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[0.65rem] bg-surface-muted ${summaryToneClasses(tone)}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {value}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
    </div>
  )
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
  const [mobileNumber, setMobileNumber] = useState(vendor.mobileNumber)
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
      mobileNumber: normalizePhoneNumber(mobileNumber) !== vendor.mobileNumber,
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
      mobileNumber,
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
  const latestAuditAt = latestTimelineDate(vendor)
  const profileStatusLabel = vendor.verifiedAt
    ? 'Verified'
    : humanizeCode(vendor.vendorStatus)
  const profileStatusTone =
    vendor.verifiedAt || vendor.vendorStatus === 'ACTIVE'
      ? 'success'
      : vendor.vendorStatus === 'PENDING'
        ? 'warning'
        : 'neutral'
  const canEditProfile = vendor.availableActions.includes('EDIT_PROFILE')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    try {
      const trimmedShopName = shopName.trim()
      const trimmedAddressLine1 = addressLine1.trim()
      const trimmedCity = city.trim()
      const normalizedMobileNumber = normalizePhoneNumber(mobileNumber)
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

      if (!normalizedMobileNumber) {
        setFormError('Phone number is required.')
        return
      }

      if (!isValidPhoneNumber(normalizedMobileNumber)) {
        setFormError('Enter a valid phone number.')
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
      if (changedFields.mobileNumber) {
        payload.mobileNumber = normalizedMobileNumber
      }
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
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="w-full max-w-4xl space-y-3">
        <div className="overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)]">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-primary/10 text-primary">
                <Store className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground">
                  Edit vendor profile
                </h2>
                <p className="mt-1 truncate text-xs leading-5 text-muted sm:text-sm">
                  {vendor.publicVendorId} · {vendor.vendorId}
                </p>
              </div>
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

          <form onSubmit={handleSubmit}>
            <div className="space-y-5 px-4 py-4 sm:px-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Shop name <span className="text-danger">*</span>
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    maxLength={180}
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Owner name
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    maxLength={160}
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Phone number <span className="text-danger">*</span>
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    inputMode="tel"
                    maxLength={20}
                    value={mobileNumber}
                    onChange={(event) => setMobileNumber(event.target.value)}
                  />
                </label>

                <LookupSelect
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
              </div>

              <div className="flex items-center gap-3 border-b border-border pb-2 text-primary">
                <MapPin className="size-4" />
                <span className="text-xs font-semibold uppercase">
                  Location details
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-foreground">
                    Address line 1 <span className="text-danger">*</span>
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    maxLength={500}
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                  />
                </label>

                <label className="block space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-foreground">
                    Address line 2
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    maxLength={500}
                    value={addressLine2}
                    onChange={(event) => setAddressLine2(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    City <span className="text-danger">*</span>
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    maxLength={120}
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Pincode
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    inputMode="numeric"
                    maxLength={12}
                    value={pincode}
                    onChange={(event) => setPincode(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Latitude
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    inputMode="decimal"
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-semibold text-foreground">
                    Longitude
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    inputMode="decimal"
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                  />
                </label>

                <label className="block space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-foreground">
                    Referral ID
                  </span>
                  <input
                    className={profileInputClassName}
                    disabled={isSubmitting}
                    maxLength={80}
                    placeholder="Enter referral ID"
                    value={referralId}
                    onChange={(event) => setReferralId(event.target.value)}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold text-foreground">
                  Reason <span className="text-danger">*</span>
                </span>
                <textarea
                  className={profileTextareaClassName}
                  disabled={isSubmitting}
                  maxLength={500}
                  placeholder="Corrected vendor profile after business owner verification"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <span className="block text-xs text-muted">
                  Required for audit purposes before saving profile changes.
                </span>
              </label>

              {visibleError ? (
                <div className="rounded-[0.75rem] border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
                  {visibleError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
                <CalendarClock className="size-4 shrink-0" />
                <span className="truncate">
                  Last updated: {formatDateLabel(vendor.updatedAt)}
                </span>
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  disabled={isSubmitting}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!hasChanges}
                  isLoading={isSubmitting}
                  size="sm"
                  type="submit"
                >
                  <Save className="mr-2 size-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <EditSummaryCard
            icon={<ShieldCheck className="size-4" />}
            label="Profile Status"
            meta={`Onboarding: ${humanizeCode(vendor.onboardingStatus)}`}
            tone={profileStatusTone}
            value={profileStatusLabel}
          />
          <EditSummaryCard
            icon={<History className="size-4" />}
            label="Audit Logs"
            meta={
              latestAuditAt
                ? `Latest: ${formatDateLabel(latestAuditAt)}`
                : 'No review events yet'
            }
            tone={vendor.reviewTimeline.length ? 'info' : 'neutral'}
            value={`${vendor.reviewTimeline.length} event${
              vendor.reviewTimeline.length === 1 ? '' : 's'
            }`}
          />
          <EditSummaryCard
            icon={<UserCog className="size-4" />}
            label="Permissions"
            meta={`${vendor.availableActions.length} vendor actions available`}
            tone={canEditProfile ? 'info' : 'warning'}
            value={canEditProfile ? 'Profile edit allowed' : 'Limited actions'}
          />
        </div>
      </div>
    </div>
  )
}
