import { CalendarRange, Sparkles } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { Button } from '../../../../../components/ui/Button'
import { Input } from '../../../../../components/ui/Input'
import { InfoTooltip } from '../../../../../components/ui/InfoTooltip'
import { LookupSelect } from '../../../../../components/ui/LookupSelect'
import { NumberStepper } from '../../../../../components/ui/NumberStepper'
import { SegmentedControl } from '../../../../../components/ui/SegmentedControl'
import {
  searchCategoryLookupOptions,
  searchVendorLookupOptions,
  searchZoneLookupOptions,
} from '../../../../lookups/adminLookups'
import type { PolicyScopeType, PolicyStatus } from '../../../types/settings.types'
import type { MediaReelPolicyFormValues } from '../../types/mediaReelPolicy.types'
import { FieldError, FieldLabel, SectionCard } from '../SectionCard'

const STATUS_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const SCOPE_OPTIONS: { value: PolicyScopeType; label: string }[] = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'CITY', label: 'City' },
  { value: 'ZONE', label: 'Zone' },
  { value: 'VENDOR', label: 'Vendor' },
]

export function ApplicabilitySection({
  disabled = false,
  onStartFromDefaults,
  showStartFromDefaults,
}: {
  disabled?: boolean
  onStartFromDefaults: () => void
  showStartFromDefaults: boolean
}) {
  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<MediaReelPolicyFormValues>()

  const scopeType = watch('scopeType')

  return (
    <SectionCard icon={<CalendarRange className="size-4" />} title="Applicability">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Rule name</FieldLabel>
          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <Input
                disabled={disabled}
                hasError={Boolean(errors.displayName)}
                placeholder="Default content rules"
                {...field}
              />
            )}
          />
          <FieldError message={errors.displayName?.message} />
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Status"
                disabled={disabled}
                options={STATUS_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Notes</FieldLabel>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <textarea
              className="form-input min-h-16"
              disabled={disabled}
              placeholder="What this rule is for"
              {...field}
            />
          )}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel
            tooltip={
              <InfoTooltip text="When several rules apply to the same upload, the one with the lowest number here wins." />
            }
          >
            Rule order
          </FieldLabel>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <NumberStepper
                aria-label="Rule order"
                disabled={disabled}
                min={0}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.priority?.message} />
        </div>
        <div>
          <FieldLabel>Applies to</FieldLabel>
          <Controller
            control={control}
            name="scopeType"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Applies to"
                disabled={disabled}
                options={SCOPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      {scopeType === 'CATEGORY' ? (
        <div>
          <FieldLabel>Category</FieldLabel>
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <LookupSelect
                disabled={disabled}
                fetchOptions={searchCategoryLookupOptions}
                label="Category"
                placeholder="Search category"
                queryKey={['lookup', 'categories', 'content-rule']}
                selectedLabel={watch('categoryLabel')}
                value={field.value}
                onChange={(value, option) => {
                  field.onChange(value)
                  setValue('categoryLabel', option?.label ?? '')
                }}
              />
            )}
          />
          <FieldError message={errors.categoryId?.message} />
        </div>
      ) : null}

      {scopeType === 'CITY' ? (
        <div>
          <FieldLabel>City</FieldLabel>
          <Controller
            control={control}
            name="city"
            render={({ field }) => (
              <Input
                disabled={disabled}
                hasError={Boolean(errors.city)}
                placeholder="Bengaluru"
                {...field}
              />
            )}
          />
          <FieldError message={errors.city?.message} />
        </div>
      ) : null}

      {scopeType === 'ZONE' ? (
        <div>
          <FieldLabel>Zone</FieldLabel>
          <Controller
            control={control}
            name="zoneId"
            render={({ field }) => (
              <LookupSelect
                disabled={disabled}
                fetchOptions={searchZoneLookupOptions}
                label="Zone"
                placeholder="Search zone"
                queryKey={['lookup', 'zones', 'content-rule']}
                selectedLabel={watch('zoneLabel')}
                value={field.value}
                onChange={(value, option) => {
                  field.onChange(value)
                  setValue('zoneLabel', option?.label ?? '')
                }}
              />
            )}
          />
          <FieldError message={errors.zoneId?.message} />
        </div>
      ) : null}

      {scopeType === 'VENDOR' ? (
        <div>
          <FieldLabel>Vendor</FieldLabel>
          <Controller
            control={control}
            name="vendorId"
            render={({ field }) => (
              <LookupSelect
                disabled={disabled}
                fetchOptions={searchVendorLookupOptions}
                label="Vendor"
                placeholder="Search vendor"
                queryKey={['lookup', 'vendors', 'content-rule']}
                selectedLabel={watch('vendorLabel')}
                value={field.value}
                onChange={(value, option) => {
                  field.onChange(value)
                  setValue('vendorLabel', option?.label ?? '')
                }}
              />
            )}
          />
          <FieldError message={errors.vendorId?.message} />
        </div>
      ) : null}

      {showStartFromDefaults ? (
        <Button
          disabled={disabled}
          size="sm"
          type="button"
          variant="secondary"
          onClick={onStartFromDefaults}
        >
          <Sparkles className="mr-2 size-4" />
          Start from default rules
        </Button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Active from</FieldLabel>
          <Controller
            control={control}
            name="effectiveFrom"
            render={({ field }) => <Input disabled={disabled} type="datetime-local" {...field} />}
          />
          <FieldError message={errors.effectiveFrom?.message} />
        </div>
        <div>
          <FieldLabel>Active until</FieldLabel>
          <Controller
            control={control}
            name="effectiveTo"
            render={({ field }) => <Input disabled={disabled} type="datetime-local" {...field} />}
          />
          <FieldError message={errors.effectiveTo?.message} />
        </div>
      </div>
    </SectionCard>
  )
}
