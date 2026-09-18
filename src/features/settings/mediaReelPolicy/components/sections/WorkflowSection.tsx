import { Workflow } from 'lucide-react'
import { Controller, useFormContext } from 'react-hook-form'
import { Switch } from '../../../../../components/ui/Switch'
import type { MediaReelPolicyFormValues } from '../../types/mediaReelPolicy.types'
import { SectionCard } from '../SectionCard'

export function WorkflowSection({ disabled = false }: { disabled?: boolean }) {
  const { control } = useFormContext<MediaReelPolicyFormValues>()

  return (
    <SectionCard icon={<Workflow className="size-4" />} title="Workflow">
      <Controller
        control={control}
        name="autoSubmitAfterUpload"
        render={({ field }) => (
          <Switch
            checked={field.value}
            description="Send new reels straight to review instead of staying as vendor drafts."
            disabled={disabled}
            label="Submit automatically after upload"
            onChange={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="autoPublishAfterApproval"
        render={({ field }) => (
          <Switch
            checked={field.value}
            description="Publish a reel the moment it's approved, with no separate publish step."
            disabled={disabled}
            label="Publish automatically after approval"
            onChange={field.onChange}
          />
        )}
      />
    </SectionCard>
  )
}
