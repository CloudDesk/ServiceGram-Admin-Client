import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { cn } from '../../../utils/cn'
import {
  searchAdminUserIdLookupOptions,
  searchCustomerUserIdLookupOptions,
  searchInfluencerLookupOptions,
  searchInfluencerUserIdLookupOptions,
  searchVendorLookupOptions,
  searchZoneLookupOptions,
} from '../../lookups/adminLookups'
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

/** Local-only state: carries the human-readable labels LookupSelect needs alongside each id. */
interface TargetFormState extends FeatureFlagTargetInput {
  zoneLabel?: string
  vendorLabel?: string
  influencerLabel?: string
  subjectUserLabel?: string
}

/** Only these app types expose a searchable auth user id; others need the raw uuid. */
function userIdFetcherFor(appType: FeatureFlagAppType) {
  switch (appType) {
    case 'CUSTOMER':
      return searchCustomerUserIdLookupOptions
    case 'ADMIN':
      return searchAdminUserIdLookupOptions
    case 'INFLUENCER':
      return searchInfluencerUserIdLookupOptions
    default:
      return null
  }
}

function emptyTarget(): TargetFormState {
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

function toInput(target: FeatureFlagDetail['targets'][number]): TargetFormState {
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

/** Blank text inputs must go to the API as null, not "". Also strips the UI-only *Label fields. */
function normalize(target: TargetFormState): FeatureFlagTargetInput {
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
  target: TargetFormState
  fieldErrors: Record<string, string>
  onChange: (index: number, target: TargetFormState) => void
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
  const patch = (changes: Partial<TargetFormState>) =>
    onChange(index, { ...target, ...changes })

  const lookupField = (
    label: string,
    field: 'zoneId' | 'vendorId' | 'influencerId',
    labelField: 'zoneLabel' | 'vendorLabel' | 'influencerLabel',
    fetchOptions: Parameters<typeof LookupSelect>[0]['fetchOptions'],
    searchLabel: string,
  ) => (
    <div className="space-y-1">
      <LookupSelect
        fetchOptions={fetchOptions}
        label={label}
        placeholder={`Search ${searchLabel}`}
        queryKey={['lookup', field, 'target', index]}
        selectedLabel={target[labelField]}
        value={target[field] ?? ''}
        onChange={(value, option) =>
          patch({ [field]: value, [labelField]: option?.label ?? '' })
        }
      />
      {errorFor(field) ? (
        <span className="block text-[0.7rem] text-danger">{errorFor(field)}</span>
      ) : null}
    </div>
  )

  const userIdFetcher = userIdFetcherFor(target.appType)

  const userIdField = (
    <div className="space-y-1">
      {userIdFetcher ? (
        <LookupSelect
          fetchOptions={userIdFetcher}
          label="User id"
          placeholder={`Search ${target.appType.toLowerCase()}`}
          queryKey={['lookup', 'user-id', target.appType, 'target', index]}
          selectedLabel={target.subjectUserLabel}
          value={target.subjectUserId ?? ''}
          onChange={(value, option) =>
            patch({ subjectUserId: value, subjectUserLabel: option?.label ?? '' })
          }
        />
      ) : (
        <label className="block space-y-1">
          <span className="text-[0.7rem] font-medium text-muted">User id</span>
          <Input
            className="h-9 text-sm"
            hasError={Boolean(errorFor('subjectUserId'))}
            placeholder="uuid"
            value={target.subjectUserId ?? ''}
            onChange={(event) => patch({ subjectUserId: event.target.value })}
          />
        </label>
      )}
      {errorFor('subjectUserId') ? (
        <span className="block text-[0.7rem] text-danger">
          {errorFor('subjectUserId')}
        </span>
      ) : (
        <span className="block text-[0.7rem] text-muted">
          {userIdFetcher
            ? "The account's User ID (see \"User ID\" on its detail page) - not the customer or vendor record ID."
            : `No lookup for ${target.appType.toLowerCase()} accounts - paste the auth user id directly.`}
        </span>
      )}
    </div>
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

        {lookupField('Zone id', 'zoneId', 'zoneLabel', searchZoneLookupOptions, 'zone')}
        {lookupField(
          'Vendor id',
          'vendorId',
          'vendorLabel',
          searchVendorLookupOptions,
          'vendor',
        )}
        {lookupField(
          'Influencer id',
          'influencerId',
          'influencerLabel',
          searchInfluencerLookupOptions,
          'influencer',
        )}
        {userIdField}
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
  const [targets, setTargets] = useState<TargetFormState[]>(() =>
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
