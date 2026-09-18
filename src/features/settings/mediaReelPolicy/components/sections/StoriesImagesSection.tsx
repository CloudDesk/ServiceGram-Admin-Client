import { Image as ImageIcon } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { CheckboxGroup } from '../../../../../components/ui/CheckboxGroup'
import { NumberStepper } from '../../../../../components/ui/NumberStepper'
import { IMAGE_FORMAT_OPTIONS, type MediaReelPolicyFormValues } from '../../types/mediaReelPolicy.types'
import { fieldErrorMessage } from '../../utils/contentRulePresentation'
import { FieldError, FieldLabel, SectionCard } from '../SectionCard'

export function StoriesImagesSection({ disabled = false }: { disabled?: boolean }) {
  const {
    control,
    formState: { errors },
  } = useFormContext<MediaReelPolicyFormValues>()

  return (
    <SectionCard icon={<ImageIcon className="size-4" />} title="Stories and images">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Photo max size</FieldLabel>
          <Controller
            control={control}
            name="maxImageSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Photo max size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxImageSizeMB?.message} />
        </div>
        <div>
          <FieldLabel>Story max size</FieldLabel>
          <Controller
            control={control}
            name="maxStoryImageSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Story max size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxStoryImageSizeMB?.message} />
        </div>
      </div>

      <div>
        <FieldLabel>Photo formats</FieldLabel>
        <Controller
          control={control}
          name="allowedImageFormats"
          render={({ field }) => (
            <CheckboxGroup
              aria-label="Photo formats"
              disabled={disabled}
              options={IMAGE_FORMAT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={fieldErrorMessage(errors.allowedImageFormats)} />
      </div>

      <div>
        <FieldLabel>Story formats</FieldLabel>
        <Controller
          control={control}
          name="allowedStoryImageFormats"
          render={({ field }) => (
            <CheckboxGroup
              aria-label="Story formats"
              disabled={disabled}
              options={IMAGE_FORMAT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={fieldErrorMessage(errors.allowedStoryImageFormats)} />
      </div>
    </SectionCard>
  )
}
