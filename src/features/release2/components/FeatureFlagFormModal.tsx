import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { cn } from '../../../utils/cn'
import { fieldErrorMap } from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import {
  FEATURE_FLAG_PHASES,
  FEATURE_FLAG_RISK_LEVELS,
  type FeatureFlagDetail,
  type FeatureFlagPhase,
  type FeatureFlagRiskLevel,
  type FeatureFlagStatus,
} from '../types/release2.types'
import { Release2ErrorNotice } from './Release2Feedback'
import { ReasonField } from './Release2ReasonModal'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}

function Field({ children, className, error, hint, label }: FieldProps) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return ''

  const offsetMs = parsed.getTimezoneOffset() * 60_000

  return new Date(parsed.getTime() - offsetMs).toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  if (!value) return null

  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const selectClass = 'form-select h-10'

interface FeatureFlagFormModalProps {
  mode: 'create' | 'edit'
  /** Required in edit mode — supplies current values and `expectedVersion`. */
  flag?: FeatureFlagDetail
  onClose: () => void
  onSaved: (flag: FeatureFlagDetail) => void
}

export function FeatureFlagFormModal({
  flag,
  mode,
  onClose,
  onSaved,
}: FeatureFlagFormModalProps) {
  const isEdit = mode === 'edit' && flag
  const [featureKey, setFeatureKey] = useState('')
  const [displayName, setDisplayName] = useState(flag?.displayName ?? '')
  const [description, setDescription] = useState(flag?.description ?? '')
  const [phase, setPhase] = useState<FeatureFlagPhase>(flag?.phase ?? 'PHASE_1')
  const [status, setStatus] = useState<FeatureFlagStatus>(
    flag?.status === 'ARCHIVED' ? 'DISABLED' : (flag?.status ?? 'DISABLED'),
  )
  const [defaultEnabled, setDefaultEnabled] = useState(flag?.defaultEnabled ?? false)
  const [rolloutPercentage, setRolloutPercentage] = useState(
    String(flag?.rolloutPercentage ?? 100),
  )
  const [riskLevel, setRiskLevel] = useState<FeatureFlagRiskLevel>(
    flag?.riskLevel ?? 'LOW',
  )
  const [isPublic, setPublic] = useState(flag?.isPublic ?? false)
  const [ownerTeam, setOwnerTeam] = useState(flag?.ownerTeam ?? '')
  const [effectiveFrom, setEffectiveFrom] = useState(
    toDateTimeLocal(flag?.effectiveFrom ?? null),
  )
  const [effectiveTo, setEffectiveTo] = useState(
    toDateTimeLocal(flag?.effectiveTo ?? null),
  )
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rollout = Number(rolloutPercentage)

      if (isEdit) {
        const response = await release2Service.updateFeatureFlag(flag.featureKey, {
          displayName: displayName.trim(),
          description: description.trim() || null,
          phase,
          status,
          defaultEnabled,
          rolloutPercentage: rollout,
          riskLevel,
          isPublic,
          ownerTeam: ownerTeam.trim() || null,
          effectiveFrom: fromDateTimeLocal(effectiveFrom),
          effectiveTo: fromDateTimeLocal(effectiveTo),
          expectedVersion: flag.version,
          reason: reason.trim(),
        })

        return response.data
      }

      const response = await release2Service.createFeatureFlag({
        featureKey: featureKey.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        phase,
        status,
        defaultEnabled,
        rolloutPercentage: rollout,
        riskLevel,
        isPublic,
        ownerTeam: ownerTeam.trim() || undefined,
        effectiveFrom: fromDateTimeLocal(effectiveFrom) ?? undefined,
        effectiveTo: fromDateTimeLocal(effectiveTo) ?? undefined,
        reason: reason.trim(),
      })

      return response.data
    },
    onSuccess: onSaved,
  })

  const backendFieldErrors = fieldErrorMap(saveMutation.error)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isEdit && featureKey.trim().length < 3) {
      setLocalError('Feature key must be at least 3 characters.')

      return
    }

    if (displayName.trim().length < 2) {
      setLocalError('Display name must be at least 2 characters.')

      return
    }

    if (reason.trim().length < 3) {
      setLocalError('Reason must be at least 3 characters.')

      return
    }

    setLocalError(null)
    saveMutation.mutate()
  }

  return (
    <div className="premium-overlay flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-[1rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[90vh] sm:rounded-[0.875rem]">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? 'Edit flag' : 'New feature flag'}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {isEdit ? flag.featureKey : 'Starts disabled unless you turn it on.'}
            </p>
          </div>
          <button
            aria-label="Close flag form"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={saveMutation.isPending}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
            {!isEdit ? (
              <Field
                className="sm:col-span-2"
                error={backendFieldErrors.featureKey}
                hint="Lowercase dotted key, e.g. customer.wallet"
                label="Feature key *"
              >
                <Input
                  hasError={Boolean(backendFieldErrors.featureKey)}
                  placeholder="customer.wallet"
                  value={featureKey}
                  onChange={(event) => setFeatureKey(event.target.value)}
                />
              </Field>
            ) : null}

            <Field
              className="sm:col-span-2"
              error={backendFieldErrors.displayName}
              label="Display name *"
            >
              <Input
                hasError={Boolean(backendFieldErrors.displayName)}
                placeholder="Customer Wallet"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>

            <Field
              className="sm:col-span-2"
              error={backendFieldErrors.description}
              label="Description"
            >
              <textarea
                className="form-input min-h-16 resize-y"
                placeholder="What this flag turns on."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>

            <Field error={backendFieldErrors.phase} label="Phase">
              <select
                className={selectClass}
                value={phase}
                onChange={(event) => setPhase(event.target.value as FeatureFlagPhase)}
              >
                {FEATURE_FLAG_PHASES.map((option) => (
                  <option key={option} value={option}>
                    {option.replace('PHASE_', 'Phase ')}
                  </option>
                ))}
              </select>
            </Field>

            <Field error={backendFieldErrors.riskLevel} label="Risk level">
              <select
                className={selectClass}
                value={riskLevel}
                onChange={(event) =>
                  setRiskLevel(event.target.value as FeatureFlagRiskLevel)
                }
              >
                {FEATURE_FLAG_RISK_LEVELS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field error={backendFieldErrors.status} label="Status">
              <select
                className={selectClass}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as FeatureFlagStatus)
                }
              >
                <option value="DISABLED">Disabled</option>
                <option value="ENABLED">Enabled</option>
              </select>
            </Field>

            <Field
              error={backendFieldErrors.rolloutPercentage}
              hint="0–100. Enabled with 0% reaches nobody."
              label="Rollout %"
            >
              <Input
                hasError={Boolean(backendFieldErrors.rolloutPercentage)}
                max={100}
                min={0}
                type="number"
                value={rolloutPercentage}
                onChange={(event) => setRolloutPercentage(event.target.value)}
              />
            </Field>

            <Field error={backendFieldErrors.effectiveFrom} label="Effective from">
              <Input
                hasError={Boolean(backendFieldErrors.effectiveFrom)}
                type="datetime-local"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </Field>

            <Field error={backendFieldErrors.effectiveTo} label="Effective to">
              <Input
                hasError={Boolean(backendFieldErrors.effectiveTo)}
                type="datetime-local"
                value={effectiveTo}
                onChange={(event) => setEffectiveTo(event.target.value)}
              />
            </Field>

            <Field error={backendFieldErrors.ownerTeam} label="Owner team">
              <Input
                placeholder="finance"
                value={ownerTeam}
                onChange={(event) => setOwnerTeam(event.target.value)}
              />
            </Field>

            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  checked={defaultEnabled}
                  className="size-4"
                  type="checkbox"
                  onChange={(event) => setDefaultEnabled(event.target.checked)}
                />
                Default on
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  checked={isPublic}
                  className="size-4"
                  type="checkbox"
                  onChange={(event) => setPublic(event.target.checked)}
                />
                Public config
              </label>
            </div>

            <div className="sm:col-span-2">
              <ReasonField
                disabled={saveMutation.isPending}
                error={backendFieldErrors.reason ?? null}
                value={reason}
                onChange={setReason}
              />
            </div>

            {localError ? (
              <p className="text-sm text-danger sm:col-span-2">{localError}</p>
            ) : null}

            <div className="sm:col-span-2">
              <Release2ErrorNotice error={saveMutation.error} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border p-4">
            <span className="text-xs text-muted">
              {isEdit ? `Saving against version ${flag.version}` : 'Creates an audit entry'}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={saveMutation.isPending}
                size="sm"
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                isLoading={saveMutation.isPending}
                size="sm"
                type="submit"
                variant="primary"
              >
                {isEdit ? 'Save changes' : 'Create flag'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
