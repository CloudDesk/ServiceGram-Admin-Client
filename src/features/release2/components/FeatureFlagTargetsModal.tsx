import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { cn } from '../../../utils/cn'
import { fieldErrorMap, targetSummary } from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import {
  FEATURE_FLAG_APP_TYPES,
  FEATURE_FLAG_TARGET_EFFECTS,
  FEATURE_FLAG_USER_SEGMENTS,
  type FeatureFlagAppType,
  type FeatureFlagDetail,
  type FeatureFlagTargetEffect,
  type FeatureFlagTargetInput,
  type FeatureFlagUserSegment,
} from '../types/release2.types'
import { Release2ErrorNotice } from './Release2Feedback'
import { ReasonField } from './Release2ReasonModal'

const selectClass = 'form-select h-9 text-sm'

function emptyTarget(): FeatureFlagTargetInput {
  return {
    effect: 'ALLOW',
    priority: 100,
    appType: 'CUSTOMER',
    roleCode: '',
    city: '',
    zoneId: '',
    vendorId: '',
    influencerId: '',
    userSegment: null,
    subjectUserId: '',
    isActive: true,
  }
}

function toInput(target: FeatureFlagDetail['targets'][number]): FeatureFlagTargetInput {
  return {
    effect: target.effect,
    priority: target.priority,
    appType: target.appType,
    roleCode: target.roleCode ?? '',
    city: target.city ?? '',
    zoneId: target.zoneId ?? '',
    vendorId: target.vendorId ?? '',
    influencerId: target.influencerId ?? '',
    userSegment: target.userSegment,
    subjectUserId: target.subjectUserId ?? '',
    isActive: target.isActive,
  }
}

/** Blank text inputs must go to the API as null, not "". */
function normalize(target: FeatureFlagTargetInput): FeatureFlagTargetInput {
  const trim = (value: string | null | undefined) => value?.trim() || null

  return {
    effect: target.effect,
    priority: Number(target.priority) || 100,
    appType: target.appType,
    roleCode: trim(target.roleCode),
    city: trim(target.city),
    zoneId: trim(target.zoneId),
    vendorId: trim(target.vendorId),
    influencerId: trim(target.influencerId),
    userSegment: target.userSegment,
    subjectUserId: trim(target.subjectUserId),
    isActive: target.isActive,
  }
}

interface TargetRowProps {
  index: number
  target: FeatureFlagTargetInput
  fieldErrors: Record<string, string>
  onChange: (index: number, target: FeatureFlagTargetInput) => void
  onRemove: (index: number) => void
}

function TargetRow({
  fieldErrors,
  index,
  onChange,
  onRemove,
  target,
}: TargetRowProps) {
  const errorFor = (field: string) => fieldErrors[`targets.${index}.${field}`]
  const patch = (changes: Partial<FeatureFlagTargetInput>) =>
    onChange(index, { ...target, ...changes })

  const idField = (
    label: string,
    field: 'zoneId' | 'vendorId' | 'influencerId' | 'subjectUserId',
    apply: (value: string) => Partial<FeatureFlagTargetInput>,
  ) => (
    <label className="block space-y-1">
      <span className="text-[0.7rem] font-medium text-muted">{label}</span>
      <Input
        className="h-9 text-sm"
        hasError={Boolean(errorFor(field))}
        placeholder="uuid"
        value={target[field] ?? ''}
        onChange={(event) => patch(apply(event.target.value))}
      />
      {errorFor(field) ? (
        <span className="block text-[0.7rem] text-danger">{errorFor(field)}</span>
      ) : null}
    </label>
  )

  return (
    <div
      className={cn(
        'space-y-2 rounded-[0.75rem] border p-3',
        target.effect === 'DENY'
          ? 'border-danger/30 bg-danger/5'
          : 'border-border bg-surface',
        !target.isActive && 'opacity-70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-semibold text-foreground">
          {target.effect} · {targetSummary(normalize(target))}
        </span>
        <button
          aria-label={`Remove target ${index + 1}`}
          className="rounded-full p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
          type="button"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block space-y-1">
          <span className="text-[0.7rem] font-medium text-muted">Effect</span>
          <select
            className={selectClass}
            value={target.effect}
            onChange={(event) =>
              patch({ effect: event.target.value as FeatureFlagTargetEffect })
            }
          >
            {FEATURE_FLAG_TARGET_EFFECTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-[0.7rem] font-medium text-muted">App</span>
          <select
            className={cn(selectClass, errorFor('appType') && 'border-danger')}
            value={target.appType}
            onChange={(event) =>
              patch({ appType: event.target.value as FeatureFlagAppType })
            }
          >
            {FEATURE_FLAG_APP_TYPES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-[0.7rem] font-medium text-muted">Priority</span>
          <Input
            className="h-9 text-sm"
            max={10000}
            min={1}
            type="number"
            value={String(target.priority)}
            onChange={(event) => patch({ priority: Number(event.target.value) })}
          />
        </label>

        <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
          <input
            checked={target.isActive}
            className="size-4"
            type="checkbox"
            onChange={(event) => patch({ isActive: event.target.checked })}
          />
          Active
        </label>

        <label className="block space-y-1">
          <span className="text-[0.7rem] font-medium text-muted">City</span>
          <Input
            className="h-9 text-sm"
            hasError={Boolean(errorFor('city'))}
            placeholder="Bengaluru"
            value={target.city ?? ''}
            onChange={(event) => patch({ city: event.target.value })}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-[0.7rem] font-medium text-muted">Role code</span>
          <Input
            className="h-9 text-sm"
            placeholder="SUPER_ADMIN"
            value={target.roleCode ?? ''}
            onChange={(event) => patch({ roleCode: event.target.value })}
          />
        </label>

        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[0.7rem] font-medium text-muted">User segment</span>
          <select
            className={selectClass}
            value={target.userSegment ?? ''}
            onChange={(event) =>
              patch({
                userSegment: (event.target.value || null) as FeatureFlagUserSegment | null,
              })
            }
          >
            <option value="">Any segment</option>
            {FEATURE_FLAG_USER_SEGMENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {idField('Zone id', 'zoneId', (value) => ({ zoneId: value }))}
        {idField('Vendor id', 'vendorId', (value) => ({ vendorId: value }))}
        {idField('Influencer id', 'influencerId', (value) => ({ influencerId: value }))}
        {idField('User id', 'subjectUserId', (value) => ({ subjectUserId: value }))}
      </div>

      {errorFor('appType') ? (
        <p className="text-[0.7rem] text-danger">{errorFor('appType')}</p>
      ) : null}
    </div>
  )
}

interface FeatureFlagTargetsModalProps {
  flag: FeatureFlagDetail
  onClose: () => void
  onSaved: (flag: FeatureFlagDetail) => void
}

/** Replaces the whole target set — the backend has no per-target endpoint. */
export function FeatureFlagTargetsModal({
  flag,
  onClose,
  onSaved,
}: FeatureFlagTargetsModalProps) {
  const [targets, setTargets] = useState<FeatureFlagTargetInput[]>(() =>
    flag.targets.map(toInput),
  )
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await release2Service.replaceFeatureFlagTargets(
        flag.featureKey,
        {
          expectedVersion: flag.version,
          reason: reason.trim(),
          targets: targets.map(normalize),
        },
      )

      return response.data
    },
    onSuccess: onSaved,
  })

  const backendFieldErrors = fieldErrorMap(saveMutation.error)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (reason.trim().length < 3) {
      setLocalError('Reason must be at least 3 characters.')

      return
    }

    setLocalError(null)
    saveMutation.mutate()
  }

  return (
    <div className="premium-overlay flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col rounded-t-[1rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[90vh] sm:rounded-[0.875rem]">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Target rules</h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {flag.featureKey} · saving replaces all {flag.targets.length} rules
            </p>
          </div>
          <button
            aria-label="Close target editor"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={saveMutation.isPending}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <p className="text-xs text-muted">
              DENY wins over ALLOW at equal priority. A rule with app{' '}
              <span className="font-mono">ANY</span> must set at least one other
              dimension.
            </p>

            {targets.length === 0 ? (
              <p className="rounded-[0.75rem] border border-dashed border-border p-4 text-center text-sm text-muted">
                No target rules. The flag falls back to its default and rollout
                percentage.
              </p>
            ) : (
              targets.map((target, index) => (
                <TargetRow
                  fieldErrors={backendFieldErrors}
                  index={index}
                  key={index}
                  target={target}
                  onChange={(targetIndex, nextTarget) =>
                    setTargets((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === targetIndex ? nextTarget : item,
                      ),
                    )
                  }
                  onRemove={(targetIndex) =>
                    setTargets((current) =>
                      current.filter((_item, itemIndex) => itemIndex !== targetIndex),
                    )
                  }
                />
              ))
            )}

            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setTargets((current) => [...current, emptyTarget()])}
            >
              <Plus className="mr-1.5 size-4" />
              Add rule
            </Button>

            <ReasonField
              disabled={saveMutation.isPending}
              error={localError ?? backendFieldErrors.reason ?? null}
              value={reason}
              onChange={setReason}
            />

            <Release2ErrorNotice error={saveMutation.error} />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border p-4">
            <span className="text-xs text-muted">
              {targets.length} rule{targets.length === 1 ? '' : 's'} · version{' '}
              {flag.version}
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
                Replace targets
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
