import { Music } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { CheckboxGroup } from '../../../../../components/ui/CheckboxGroup'
import { NumberStepper } from '../../../../../components/ui/NumberStepper'
import { AUDIO_FORMAT_OPTIONS, type MediaReelPolicyFormValues } from '../../types/mediaReelPolicy.types'
import { fieldErrorMessage } from '../../utils/contentRulePresentation'
import { FieldError, FieldLabel, SectionCard } from '../SectionCard'

export function MusicSection({ disabled = false }: { disabled?: boolean }) {
  const {
    control,
    formState: { errors },
  } = useFormContext<MediaReelPolicyFormValues>()

  return (
    <SectionCard icon={<Music className="size-4" />} title="Music">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Track length</FieldLabel>
          <Controller
            control={control}
            name="maxMusicTrackMinutes"
            render={({ field }) => (
              <NumberStepper
                aria-label="Track length"
                disabled={disabled}
                min={1}
                suffix="min"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxMusicTrackMinutes?.message} />
        </div>
        <div>
          <FieldLabel>Preview length</FieldLabel>
          <Controller
            control={control}
            name="maxMusicPreviewSeconds"
            render={({ field }) => (
              <NumberStepper
                aria-label="Preview length"
                disabled={disabled}
                min={1}
                suffix="sec"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxMusicPreviewSeconds?.message} />
        </div>
        <div>
          <FieldLabel>Audio file size</FieldLabel>
          <Controller
            control={control}
            name="maxMusicTrackAudioSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Audio file size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxMusicTrackAudioSizeMB?.message} />
        </div>
        <div>
          <FieldLabel>Artwork size</FieldLabel>
          <Controller
            control={control}
            name="maxMusicArtworkSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Artwork size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxMusicArtworkSizeMB?.message} />
        </div>
        <div>
          <FieldLabel>Creator upload size</FieldLabel>
          <Controller
            control={control}
            name="maxCreatorAudioSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Creator upload size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxCreatorAudioSizeMB?.message} />
        </div>
        <div>
          <FieldLabel>Max soundtrack selection</FieldLabel>
          <Controller
            control={control}
            name="maxReelMusicSelectionSeconds"
            render={({ field }) => (
              <NumberStepper
                aria-label="Max soundtrack selection"
                disabled={disabled}
                min={1}
                suffix="sec"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxReelMusicSelectionSeconds?.message} />
        </div>
      </div>

      <div>
        <FieldLabel>Audio formats</FieldLabel>
        <Controller
          control={control}
          name="allowedAudioFormats"
          render={({ field }) => (
            <CheckboxGroup
              aria-label="Audio formats"
              columns={4}
              disabled={disabled}
              options={AUDIO_FORMAT_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <FieldError message={fieldErrorMessage(errors.allowedAudioFormats)} />
      </div>
    </SectionCard>
  )
}
