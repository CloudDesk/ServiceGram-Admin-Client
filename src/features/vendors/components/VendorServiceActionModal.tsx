import { type FormEvent, useMemo, useState } from 'react'
import { Plus, Save, Settings2, Tags, Trash2, X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type {
  VendorDetail,
  VendorRequiredReasonPayload,
  VendorServiceCatalogItem,
  VendorServiceCatalogItemPayload,
  VendorServiceCatalogPayload,
  VendorServicePayload,
  VendorServicePriceType,
  VendorServicePricingUnit,
  VendorServiceRecord,
} from '../types/vendor.types'

export type VendorServiceActionKind = 'CREATE' | 'EDIT' | 'DISABLE' | 'CATALOG'

export interface VendorServiceActionSelection {
  kind: VendorServiceActionKind
  service?: VendorServiceRecord
}

export interface VendorServiceActionFormValues {
  service?: VendorServicePayload
  catalog?: VendorServiceCatalogPayload
  reason?: VendorRequiredReasonPayload
}

interface VendorServiceActionModalProps {
  action: VendorServiceActionSelection | null
  error?: string | null
  isSubmitting: boolean
  vendor: VendorDetail
  onClose: () => void
  onSubmit: (values: VendorServiceActionFormValues) => void
}

type CatalogItemDraft = VendorServiceCatalogItemPayload & {
  localId: string
}

const priceTypes: VendorServicePriceType[] = [
  'FIXED',
  'STARTING_FROM',
  'RANGE',
  'INSPECTION_REQUIRED',
]

const pricingUnits: VendorServicePricingUnit[] = [
  'KG',
  'PIECE',
  'BAG',
  'LOT',
  'SQFT',
  'PAIR',
  'HOUR',
  'VISIT',
  'DEVICE',
]

function textFromPaise(value: number | null | undefined) {
  if (value == null) {
    return ''
  }

  return String(value / 100)
}

function nullableText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseMoneyToPaise(value: string, label: string, required: true): number
function parseMoneyToPaise(
  value: string,
  label: string,
  required?: false,
): number | null
function parseMoneyToPaise(value: string, label: string, required = false) {
  const trimmed = value.trim()

  if (!trimmed) {
    if (required) {
      throw new Error(`${label} is required.`)
    }

    return null
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a valid non-negative amount.`)
  }

  return Math.round(parsed * 100)
}

function parseQuantity(value: number, label: string) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new Error(`${label} must be between 1 and 999.`)
  }

  return value
}

function toCatalogDraft(
  item: VendorServiceCatalogItem,
  index: number,
): CatalogItemDraft {
  return {
    displayOrder: item.displayOrder ?? index + 1,
    isActive: item.isActive !== false,
    isPopular: Boolean(item.isPopular),
    itemCode: item.itemCode ?? '',
    itemName: item.itemName,
    localId: item.catalogItemId ?? `${item.itemName}-${index}`,
    maxQuantity: item.maxQuantity ?? 99,
    metadata: item.metadata ?? {},
    minQuantity: item.minQuantity ?? 1,
    pricingUnit: item.pricingUnit,
    unitPricePaise: item.unitPricePaise,
  }
}

function newCatalogDraft(index: number): CatalogItemDraft {
  return {
    displayOrder: index + 1,
    isActive: true,
    isPopular: false,
    itemCode: '',
    itemName: '',
    localId: `new-${Date.now()}-${index}`,
    maxQuantity: 99,
    metadata: {},
    minQuantity: 1,
    pricingUnit: 'PIECE',
    unitPricePaise: 0,
  }
}

function serviceActionTitle(action: VendorServiceActionSelection) {
  if (action.kind === 'CREATE') return 'Add service'
  if (action.kind === 'EDIT') return 'Edit service'
  if (action.kind === 'DISABLE') return 'Disable service'
  return 'Edit service catalog'
}

function serviceActionDescription(
  vendor: VendorDetail,
  action: VendorServiceActionSelection,
) {
  if (action.kind === 'CREATE') {
    return `${vendor.shopName} - ${vendor.category?.name ?? 'No category'}`
  }

  return action.service
    ? `${action.service.serviceName} - ${vendor.publicVendorId}`
    : vendor.publicVendorId
}

export function VendorServiceActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  vendor,
}: VendorServiceActionModalProps) {
  const service = action?.service
  const [basePrice, setBasePrice] = useState(
    textFromPaise(service?.pricing.basePricePaise),
  )
  const [catalogItems, setCatalogItems] = useState<CatalogItemDraft[]>(() =>
    service
      ? service.pricing.catalog.items.map((item, index) =>
          toCatalogDraft(item, index),
        )
      : [],
  )
  const [description, setDescription] = useState(service?.description ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(service?.isActive ?? true)
  const [maxPrice, setMaxPrice] = useState(
    textFromPaise(service?.pricing.maxPricePaise),
  )
  const [minPrice, setMinPrice] = useState(
    textFromPaise(service?.pricing.minPricePaise),
  )
  const [priceType, setPriceType] = useState<VendorServicePriceType>(
    service?.pricing.priceType ?? 'FIXED',
  )
  const [reason, setReason] = useState('')
  const [serviceName, setServiceName] = useState(service?.serviceName ?? '')

  const visibleError = formError ?? error
  const isServiceForm = action?.kind === 'CREATE' || action?.kind === 'EDIT'
  const isCatalogForm = action?.kind === 'CATALOG'
  const isDisableForm = action?.kind === 'DISABLE'
  const categoryLabel = vendor.category
    ? `${vendor.category.name} (${vendor.category.categoryCode})`
    : 'No category assigned'
  const submitLabel = useMemo(() => {
    if (!action) return 'Submit'
    if (action.kind === 'CREATE') return 'Add service'
    if (action.kind === 'EDIT') return 'Save service'
    if (action.kind === 'DISABLE') return 'Disable service'
    return 'Save catalog'
  }, [action])

  if (!action) {
    return null
  }

  const updateCatalogItem = (
    localId: string,
    patch: Partial<CatalogItemDraft>,
  ) => {
    setCatalogItems((items) =>
      items.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item,
      ),
    )
  }

  const removeCatalogItem = (localId: string) => {
    setCatalogItems((items) => items.filter((item) => item.localId !== localId))
  }

  const addCatalogItem = () => {
    setCatalogItems((items) => [...items, newCatalogDraft(items.length)])
  }

  const handleServiceSubmit = (trimmedReason: string) => {
    const trimmedServiceName = serviceName.trim()

    if (!vendor.category?.categoryId && action.kind === 'CREATE') {
      setFormError('Assign a vendor category before adding services.')
      return
    }

    if (!trimmedServiceName) {
      setFormError('Service name is required.')
      return
    }

    const basePricePaise = parseMoneyToPaise(basePrice, 'Base price', true)
    const minPricePaise = parseMoneyToPaise(minPrice, 'Minimum price')
    const maxPricePaise = parseMoneyToPaise(maxPrice, 'Maximum price')

    if (
      minPricePaise != null &&
      maxPricePaise != null &&
      minPricePaise > maxPricePaise
    ) {
      setFormError('Minimum price must be less than or equal to maximum price.')
      return
    }

    const payload: VendorServicePayload = {
      basePricePaise,
      description: nullableText(description),
      isActive,
      maxPricePaise,
      minPricePaise,
      priceType,
      reason: trimmedReason,
      serviceName: trimmedServiceName,
    }

    if (action.kind === 'CREATE' && vendor.category?.categoryId) {
      payload.categoryId = vendor.category.categoryId
    }

    onSubmit({ service: payload })
  }

  const handleCatalogSubmit = (trimmedReason: string) => {
    const seenCodes = new Set<string>()
    const items = catalogItems.map((item, index) => {
      const itemName = item.itemName.trim()
      const itemCode = item.itemCode?.trim() ?? ''
      const unitPricePaise = Number(item.unitPricePaise)

      if (!itemName) {
        throw new Error(`Catalog item ${index + 1} needs an item name.`)
      }

      if (!Number.isInteger(unitPricePaise) || unitPricePaise < 0) {
        throw new Error(`Catalog item ${index + 1} needs a valid unit price.`)
      }

      if (itemCode) {
        const normalizedCode = itemCode.toLowerCase()

        if (seenCodes.has(normalizedCode)) {
          throw new Error(`Catalog item code ${itemCode} is duplicated.`)
        }

        seenCodes.add(normalizedCode)
      }

      return {
        displayOrder: Number.isInteger(item.displayOrder)
          ? item.displayOrder
          : index + 1,
        isActive: item.isActive,
        isPopular: item.isPopular,
        itemCode: itemCode || undefined,
        itemName,
        maxQuantity: parseQuantity(item.maxQuantity, 'Maximum quantity'),
        metadata: item.metadata ?? {},
        minQuantity: parseQuantity(item.minQuantity, 'Minimum quantity'),
        pricingUnit: item.pricingUnit,
        unitPricePaise,
      }
    })

    for (const item of items) {
      if (item.minQuantity > item.maxQuantity) {
        throw new Error(
          `${item.itemName} minimum quantity must be less than or equal to maximum quantity.`,
        )
      }
    }

    onSubmit({
      catalog: {
        items,
        reason: trimmedReason,
      },
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()

    if (!trimmedReason) {
      setFormError('Reason is required.')
      return
    }

    try {
      if (isDisableForm) {
        onSubmit({ reason: { reason: trimmedReason } })
        return
      }

      if (isCatalogForm) {
        handleCatalogSubmit(trimmedReason)
        return
      }

      handleServiceSubmit(trimmedReason)
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Vendor service action failed.',
      )
    }
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isCatalogForm ? (
                <Tags className="size-4 text-primary" />
              ) : (
                <Settings2 className="size-4 text-primary" />
              )}
              <h2 className="text-lg font-semibold text-foreground">
                {serviceActionTitle(action)}
              </h2>
            </div>
            <p className="text-sm leading-6 text-muted">
              {serviceActionDescription(vendor, action)}
            </p>
          </div>
          <button
            aria-label="Close service action modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {isServiceForm ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Service name <span className="text-danger">*</span>
                </span>
                <input
                  className="form-input"
                  maxLength={180}
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Category
                </span>
                <input
                  className="form-input"
                  disabled
                  value={categoryLabel}
                  readOnly
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Base price INR <span className="text-danger">*</span>
                </span>
                <input
                  className="form-input"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Price type
                </span>
                <select
                  className="form-select"
                  value={priceType}
                  onChange={(event) =>
                    setPriceType(event.target.value as VendorServicePriceType)
                  }
                >
                  {priceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Minimum price INR
                </span>
                <input
                  className="form-input"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Maximum price INR
                </span>
                <input
                  className="form-input"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  type="number"
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                />
              </label>

              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">
                  Description
                </span>
                <textarea
                  className="form-input min-h-24 resize-y"
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <input
                  checked={isActive}
                  className="size-4 accent-[var(--color-primary)]"
                  type="checkbox"
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Service is active
              </label>
            </div>
          ) : null}

          {isCatalogForm ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Catalog items
                  </p>
                  <p className="text-xs text-muted">
                    Saving replaces the full item list for this service.
                  </p>
                </div>
                <Button
                  disabled={isSubmitting}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={addCatalogItem}
                >
                  <Plus className="mr-2 size-4" />
                  Add item
                </Button>
              </div>

              {catalogItems.length ? (
                <div className="space-y-3">
                  {catalogItems.map((item, index) => (
                    <div
                      className="rounded-[0.85rem] border border-border bg-surface-muted/40 p-3"
                      key={item.localId}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          Item {index + 1}
                        </p>
                        <Button
                          disabled={isSubmitting}
                          size="sm"
                          type="button"
                          variant="ghost"
                          onClick={() => removeCatalogItem(item.localId)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Item name
                          </span>
                          <input
                            className="form-input"
                            maxLength={180}
                            value={item.itemName}
                            onChange={(event) =>
                              updateCatalogItem(item.localId, {
                                itemName: event.target.value,
                              })
                            }
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Item code
                          </span>
                          <input
                            className="form-input"
                            maxLength={80}
                            value={item.itemCode ?? ''}
                            onChange={(event) =>
                              updateCatalogItem(item.localId, {
                                itemCode: event.target.value,
                              })
                            }
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Unit
                          </span>
                          <select
                            className="form-select"
                            value={item.pricingUnit}
                            onChange={(event) =>
                              updateCatalogItem(item.localId, {
                                pricingUnit: event.target
                                  .value as VendorServicePricingUnit,
                              })
                            }
                          >
                            {pricingUnits.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Unit price INR
                          </span>
                          <input
                            className="form-input"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            type="number"
                            value={textFromPaise(item.unitPricePaise)}
                            onChange={(event) => {
                              const parsed = Number(event.target.value)

                              if (!Number.isFinite(parsed) || parsed < 0) {
                                return
                              }

                              updateCatalogItem(item.localId, {
                                unitPricePaise: Math.round(parsed * 100),
                              })
                            }}
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Min qty
                          </span>
                          <input
                            className="form-input"
                            inputMode="numeric"
                            min="1"
                            type="number"
                            value={item.minQuantity}
                            onChange={(event) =>
                              updateCatalogItem(item.localId, {
                                minQuantity: Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Max qty
                          </span>
                          <input
                            className="form-input"
                            inputMode="numeric"
                            min="1"
                            type="number"
                            value={item.maxQuantity}
                            onChange={(event) =>
                              updateCatalogItem(item.localId, {
                                maxQuantity: Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted">
                            Display order
                          </span>
                          <input
                            className="form-input"
                            inputMode="numeric"
                            min="0"
                            type="number"
                            value={item.displayOrder}
                            onChange={(event) =>
                              updateCatalogItem(item.localId, {
                                displayOrder: Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <div className="flex items-end gap-4 pb-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <input
                              checked={item.isPopular}
                              className="size-4 accent-[var(--color-primary)]"
                              type="checkbox"
                              onChange={(event) =>
                                updateCatalogItem(item.localId, {
                                  isPopular: event.target.checked,
                                })
                              }
                            />
                            Popular
                          </label>

                          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <input
                              checked={item.isActive}
                              className="size-4 accent-[var(--color-primary)]"
                              type="checkbox"
                              onChange={(event) =>
                                updateCatalogItem(item.localId, {
                                  isActive: event.target.checked,
                                })
                              }
                            />
                            Active
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[0.85rem] border border-dashed border-border p-4 text-sm text-muted">
                  No catalog items are configured. Add at least one item if this
                  service needs itemized pricing.
                </div>
              )}
            </div>
          ) : null}

          {isDisableForm ? (
            <div className="rounded-[0.85rem] border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
              This will make the service unavailable for new customer bookings.
              Existing historical orders remain unchanged.
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Reason <span className="text-danger">*</span>
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              maxLength={500}
              placeholder="Recorded for admin audit history"
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
              isLoading={isSubmitting}
              type="submit"
              variant={isDisableForm ? 'danger' : 'primary'}
            >
              <Save className="mr-2 size-4" />
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
