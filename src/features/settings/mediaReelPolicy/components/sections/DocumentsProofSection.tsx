import { FileText } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { NumberStepper } from '../../../../../components/ui/NumberStepper'
import type { MediaReelPolicyFormValues } from '../../types/mediaReelPolicy.types'
import { FieldError, FieldLabel, SectionCard } from '../SectionCard'

export function DocumentsProofSection({ disabled = false }: { disabled?: boolean }) {
  const {
    control,
    formState: { errors },
  } = useFormContext<MediaReelPolicyFormValues>()

  return (
    <SectionCard icon={<FileText className="size-4" />} title="Documents and proof">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Document max size</FieldLabel>
          <Controller
            control={control}
            name="maxDocumentSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Document max size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxDocumentSizeMB?.message} />
        </div>
        <div>
          <FieldLabel>Proof photo max size</FieldLabel>
          <Controller
            control={control}
            name="maxProofImageSizeMB"
            render={({ field }) => (
              <NumberStepper
                aria-label="Proof photo max size"
                disabled={disabled}
                min={1}
                suffix="MB"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FieldError message={errors.maxProofImageSizeMB?.message} />
        </div>
      </div>
    </SectionCard>
  )
}
