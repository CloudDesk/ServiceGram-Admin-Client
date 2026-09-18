import { zodResolver } from '@hookform/resolvers/zod'
import { RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button } from '../../../../components/ui/Button'
import { Modal } from '../../../../components/ui/Modal'
import type { PolicyRule, UpsertPolicyRulePayload } from '../../types/settings.types'
import { SettingsServiceError } from '../../types/settings.types'
import {
  diffFormValues,
  formValuesToUpsertPayload,
  recordToFormValues,
  configToFormValues,
} from '../mappers/mediaReelPolicy.mappers'
import { mediaReelPolicyFormSchema, mediaReelPolicyReasonSchema } from '../schemas/mediaReelPolicy.schema'
import { DEFAULT_MEDIA_REEL_CONFIG, type MediaReelConfig, type MediaReelPolicyFormValues } from '../types/mediaReelPolicy.types'
import {
  isPolicyVersionConflict,
  mapServerFieldToFormPath,
  policyActivationConflictDetail,
  versionConflictDetail,
} from '../utils/contentRulePresentation'
import { MediaReelSaveConfirmStep } from './MediaReelSaveConfirmStep'
import { MediaReelSummaryPanel } from './MediaReelSummaryPanel'
import { ApplicabilitySection } from './sections/ApplicabilitySection'
import { DocumentsProofSection } from './sections/DocumentsProofSection'
import { MusicSection } from './sections/MusicSection'
import { ReelsSection } from './sections/ReelsSection'
import { StoriesImagesSection } from './sections/StoriesImagesSection'
import { WorkflowSection } from './sections/WorkflowSection'

export type MediaReelPolicyModalSelection =
  | { action: 'CREATE'; record?: undefined }
  | { action: 'EDIT'; record: PolicyRule }

export interface MediaReelPolicyReloadContext {
  policyRuleId: string | null
  scopeType: MediaReelPolicyFormValues['scopeType']
  categoryId: string | null
  city: string | null
  zoneId: string | null
  vendorId: string | null
}

export interface MediaReelPolicyModalProps {
  action: MediaReelPolicyModalSelection | null
  canUpdateSettings: boolean
  defaultConfigSource: MediaReelConfig | null
  error?: unknown
  isSubmitting: boolean
  onClearError?: () => void
  onClose: () => void
  onReloadLatest: (context: MediaReelPolicyReloadContext) => Promise<PolicyRule | null>
  onSubmit: (payload: UpsertPolicyRulePayload) => void
}

export function MediaReelPolicyModal({ action, ...rest }: MediaReelPolicyModalProps) {
  if (!action) return null

  const key = action.action === 'CREATE' ? 'content-rule:create' : `content-rule:${action.record.policyRuleId}`

  return <MediaReelPolicyModalContent action={action} key={key} {...rest} />
}

function MediaReelPolicyModalContent({
  action,
  canUpdateSettings,
  defaultConfigSource,
  error,
  isSubmitting,
  onClearError,
  onClose,
  onReloadLatest,
  onSubmit,
}: MediaReelPolicyModalProps & { action: MediaReelPolicyModalSelection }) {
  // Reassigned by "Reload latest" after a version conflict, so the confirm
  // step's diff and the next submit's `expectedVersion` use fresh server data
  // without touching (and discarding) whatever the user has typed since.
  const [baselineRecord, setBaselineRecord] = useState<PolicyRule | null>(
    action.action === 'EDIT' ? action.record : null,
  )
  const originalValues = useMemo(() => recordToFormValues(baselineRecord), [baselineRecord])
  const readOnly = !canUpdateSettings

  const form = useForm<MediaReelPolicyFormValues>({
    resolver: zodResolver(mediaReelPolicyFormSchema),
    defaultValues: originalValues,
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [isReloading, setIsReloading] = useState(false)

  const isConflict = isPolicyVersionConflict(error)
  const activationConflict = policyActivationConflictDetail(error)
  const serviceError = error instanceof SettingsServiceError ? error : null
  const fieldErrors = serviceError?.response?.details?.fieldErrors ?? []
  const unmappedErrorMessage = (() => {
    if (!error || isConflict || activationConflict) return null
    const hasMappedField = fieldErrors.some((fieldError) => mapServerFieldToFormPath(fieldError.field))
    if (hasMappedField) return null
    return error instanceof Error ? error.message : 'Request failed.'
  })()

  const scopeType = form.watch('scopeType')

  useEffect(() => {
    if (!(error instanceof SettingsServiceError) || isPolicyVersionConflict(error)) return

    const errors = error.response?.details?.fieldErrors ?? []
    let mappedAny = false
    for (const fieldError of errors) {
      const formField = mapServerFieldToFormPath(fieldError.field)
      if (!formField) continue
      mappedAny = true
      form.setError(formField as keyof MediaReelPolicyFormValues, {
        type: fieldError.code,
        message: fieldError.message,
      })
    }
    if (mappedAny) setConfirmOpen(false)
  }, [error, form])

  useEffect(() => {
    if (isConflict) setConfirmOpen(false)
  }, [isConflict])

  const openConfirmStep = form.handleSubmit(() => {
    setConfirmOpen(true)
  })

  const handleConfirm = () => {
    const reasonResult = mediaReelPolicyReasonSchema.safeParse(reason)
    if (!reasonResult.success) {
      setReasonError(reasonResult.error.issues[0]?.message ?? 'Reason is required.')
      return
    }
    setReasonError(null)
    onSubmit(formValuesToUpsertPayload(form.getValues(), baselineRecord, reasonResult.data))
  }

  const handleReloadLatest = async () => {
    const values = form.getValues()
    setIsReloading(true)
    try {
      const fresh = await onReloadLatest({
        policyRuleId: baselineRecord?.policyRuleId ?? null,
        scopeType: values.scopeType,
        categoryId: values.scopeType === 'CATEGORY' ? values.categoryId || null : null,
        city: values.scopeType === 'CITY' ? values.city.trim() || null : null,
        zoneId: values.scopeType === 'ZONE' ? values.zoneId || null : null,
        vendorId: values.scopeType === 'VENDOR' ? values.vendorId || null : null,
      })
      if (fresh) {
        setBaselineRecord(fresh)
        onClearError?.()
      }
    } finally {
      setIsReloading(false)
    }
  }

  const applyDefaults = () => {
    const source = defaultConfigSource ?? DEFAULT_MEDIA_REEL_CONFIG
    const configSlice = configToFormValues(source)
    for (const [field, value] of Object.entries(configSlice)) {
      form.setValue(field as keyof MediaReelPolicyFormValues, value as never, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

  return (
    <FormProvider {...form}>
      <Modal
        description={
          baselineRecord
            ? `Editing ${baselineRecord.displayName}`
            : 'These rules control what vendors and creators can upload.'
        }
        footer={
          <>
            <Button disabled={isSubmitting} type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={readOnly}
              title={readOnly ? 'Requires settings:update' : undefined}
              type="button"
              onClick={() => void openConfirmStep()}
            >
              Save
            </Button>
          </>
        }
        size="xl"
        className="w-full max-w-6xl"
        title={baselineRecord ? 'Edit content rule' : 'Create content rule'}
        onClose={onClose}
      >
        {!canUpdateSettings ? (
          <div className="mb-3 rounded-[0.75rem] border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            You have read-only access. Editing requires the settings:update permission.
          </div>
        ) : null}
        {isConflict ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[0.75rem] border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            <div>
              <p className="font-semibold">
                {error instanceof Error ? error.message : 'This rule changed elsewhere.'}
              </p>
              <p className="mt-0.5 text-warning/90">{versionConflictDetail(error)}</p>
              <p className="mt-1 text-xs text-warning/80">Your unsaved changes are still here.</p>
            </div>
            <Button
              disabled={isReloading}
              isLoading={isReloading}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void handleReloadLatest()}
            >
              <RefreshCcw className="mr-2 size-4" />
              Reload latest
            </Button>
          </div>
        ) : unmappedErrorMessage ? (
          <div className="mb-3 rounded-[0.75rem] border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">
            {unmappedErrorMessage}
          </div>
        ) : null}

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="space-y-4">
            <ApplicabilitySection
              disabled={readOnly}
              showStartFromDefaults={scopeType !== 'GLOBAL'}
              onStartFromDefaults={applyDefaults}
            />
            <ReelsSection disabled={readOnly} />
            <StoriesImagesSection disabled={readOnly} />
            <MusicSection disabled={readOnly} />
            <DocumentsProofSection disabled={readOnly} />
            <WorkflowSection disabled={readOnly} />
          </div>
          <div className="lg:sticky lg:top-0">
            <MediaReelSummaryPanel currentRuleId={baselineRecord?.policyRuleId ?? null} />
          </div>
        </div>
      </Modal>

      {confirmOpen ? (
        <MediaReelSaveConfirmStep
          activationConflict={activationConflict}
          diff={diffFormValues(originalValues, form.getValues())}
          error={unmappedErrorMessage}
          isSubmitting={isSubmitting}
          reason={reason}
          reasonError={reasonError}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={handleConfirm}
          onReasonChange={(value) => {
            setReason(value)
            if (reasonError) setReasonError(null)
          }}
          onUseSuggestedPriority={(priority) => {
            form.setValue('priority', priority, {
              shouldDirty: true,
              shouldValidate: true,
            })
            onClearError?.()
            setConfirmOpen(false)
          }}
        />
      ) : null}
    </FormProvider>
  )
}
