import { Clapperboard } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { CheckboxGroup } from '../../../../../components/ui/CheckboxGroup'
import { DualRangeSlider } from '../../../../../components/ui/DualRangeSlider'
import { InfoTooltip } from '../../../../../components/ui/InfoTooltip'
import { NumberStepper } from '../../../../../components/ui/NumberStepper'
import { SegmentedControl } from '../../../../../components/ui/SegmentedControl'
import {
  REEL_ASPECT_RATIO_OPTIONS,
  RESOLUTION_PRESETS,
  VIDEO_FORMAT_OPTIONS,
  type MediaReelPolicyFormValues,
} from '../../types/mediaReelPolicy.types'
import { fieldErrorMessage } from '../../utils/contentRulePresentation'
import { FieldError, FieldLabel, SectionCard } from '../SectionCard'

export function ReelsSection({ disabled = false }: { disabled?: boolean }) {
  const {
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<MediaReelPolicyFormValues>()

  const minWidth = watch('minReelWidth')
  const minHeight = watch('minReelHeight')
  const maxWidth = watch('maxReelWidth')
  const maxHeight = watch('maxReelHeight')

  return (
    <SectionCard icon={<Clapperboard className="size-4" />} title="Reels">
      <div>
        <FieldLabel>Reel length</FieldLabel>
        <Controller
          control={control}
          name="reelDurationSeconds"
          render={({ field }) => (
            <DualRangeSlider
              aria-label="Reel length"
              disabled={disabled}
              formatLabel={(value) => `${value} sec`}
              max={300}
              min={1}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={fieldErrorMessage(errors.reelDurationSeconds)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Maximum file size</FieldLabel>
          <Controller
            control={control}
            name="maxReelSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Maximum file size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxReelSizeMB?.message} />
        </div>
        <div>
          <FieldLabel>Daily uploads per vendor</FieldLabel>
          <Controller
            control={control}
            name="vendorDailyUploadLimit"
            render={({ field }) => (
              <NumberStepper
                aria-label="Daily uploads per vendor"
                disabled={disabled}
                min={1}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Video formats</FieldLabel>
        <Controller
          control={control}
          name="allowedVideoFormats"
          render={({ field }) => (
            <CheckboxGroup
              aria-label="Video formats"
              disabled={disabled}
              options={VIDEO_FORMAT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={fieldErrorMessage(errors.allowedVideoFormats)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Portrait format</FieldLabel>
          <Controller
            control={control}
            name="reelAspectRatio"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Portrait format"
                disabled={disabled}
                options={REEL_ASPECT_RATIO_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div>
          <FieldLabel
            tooltip={<InfoTooltip text="How much a reel's shape may drift from the portrait format above before it's rejected." />}
          >
            Aspect ratio tolerance
          </FieldLabel>
          <Controller
            control={control}
            name="aspectRatioTolerancePercent"
            render={({ field }) => (
              <NumberStepper
                aria-label="Aspect ratio tolerance"
                disabled={disabled}
                max={100}
                min={0}
                suffix="%"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Resolution presets</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {RESOLUTION_PRESETS.map((preset) => {
            const isSelected =
              minWidth === preset.minWidth &&
              minHeight === preset.minHeight &&
              maxWidth === preset.maxWidth &&
              maxHeight === preset.maxHeight

            return (
              <button
                className={
                  isSelected
                    ? 'rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary'
                    : 'rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground'
                }
                disabled={disabled}
                key={preset.label}
                type="button"
                onClick={() => {
                  setValue('minReelWidth', preset.minWidth, { shouldDirty: true, shouldValidate: true })
                  setValue('minReelHeight', preset.minHeight, { shouldDirty: true, shouldValidate: true })
                  setValue('maxReelWidth', preset.maxWidth, { shouldDirty: true, shouldValidate: true })
                  setValue('maxReelHeight', preset.maxHeight, { shouldDirty: true, shouldValidate: true })
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <FieldLabel>Min width</FieldLabel>
          <Controller
            control={control}
            name="minReelWidth"
            render={({ field }) => (
              <NumberStepper
                aria-label="Minimum width"
                disabled={disabled}
                min={1}
                suffix="px"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div>
          <FieldLabel>Min height</FieldLabel>
          <Controller
            control={control}
            name="minReelHeight"
            render={({ field }) => (
              <NumberStepper
                aria-label="Minimum height"
                disabled={disabled}
                min={1}
                suffix="px"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
        <div>
          <FieldLabel>Max width</FieldLabel>
          <Controller
            control={control}
            name="maxReelWidth"
            render={({ field }) => (
              <NumberStepper
                aria-label="Maximum width"
                disabled={disabled}
                min={1}
                suffix="px"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxReelWidth?.message} />
        </div>
        <div>
          <FieldLabel>Max height</FieldLabel>
          <Controller
            control={control}
            name="maxReelHeight"
            render={({ field }) => (
              <NumberStepper
                aria-label="Maximum height"
                disabled={disabled}
                min={1}
                suffix="px"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxReelHeight?.message} />
        </div>
      </div>
    </SectionCard>
  )
}
