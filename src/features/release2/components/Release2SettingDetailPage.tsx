import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, RefreshCcw, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { RecordField, RecordFieldList } from '../../../components/ui/RecordPage'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import {
  errorMessage,
  fieldErrorMap,
  formatSettingValue,
  isPermissionDenied,
  riskTone,
  settingGroupLabel,
  validationHint,
  formatDateTime,
} from '../release2Presenters'
import { release2Service } from '../services/release2.service'
import type { Release2Setting } from '../types/release2.types'
import {
  Release2ErrorNotice,
  Release2Notice,
  Release2PermissionPanel,
  Release2Warnings,
} from './Release2Feedback'
import { ReasonField } from './Release2ReasonModal'

/** Editor value is kept as a string and coerced by the backend `valueType`. */
function toEditorValue(setting: Release2Setting) {
  if (setting.isValueMasked) return ''
  if (typeof setting.value === 'boolean') return setting.value ? 'true' : 'false'
  if (setting.value === null || setting.value === undefined) return ''
  if (typeof setting.value === 'object') return JSON.stringify(setting.value)

  return String(setting.value)
}

function parseEditorValue(setting: Release2Setting, raw: string): unknown {
  if (setting.valueType === 'boolean') return raw === 'true'

  if (setting.valueType === 'integer' || setting.valueType === 'number') {
    const parsed = Number(raw)

    return Number.isFinite(parsed) ? parsed : raw
  }

  return raw
}

export function Release2SettingDetailPage() {
  const { settingKey = '' } = useParams()
  const queryClient = useQueryClient()
  const canUpdateSettings = usePermission('settings:update')
  const canUpdateFinanceSettings = usePermission('release2-finance-settings:update')

  const [valueDraft, setValueDraft] = useState<{
    settingKey: string
    version: number
    value: string
  } | null>(null)
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const settingQuery = useQuery({
    queryKey: ['release2', 'setting', settingKey],
    queryFn: () => release2Service.getRelease2Setting(settingKey),
    enabled: Boolean(settingKey),
    retry: false,
  })

  const setting = settingQuery.data?.data
  const savedValue = setting ? toEditorValue(setting) : ''

  /**
   * The draft is keyed by settingKey + version, so a reload after someone else
   * saves discards a stale edit instead of resubmitting it against a new value.
   */
  const editorValue =
    setting &&
    valueDraft &&
    valueDraft.settingKey === setting.settingKey &&
    valueDraft.version === setting.version
      ? valueDraft.value
      : savedValue

  const setEditorValue = (value: string) => {
    if (!setting) return

    setValueDraft({
      settingKey: setting.settingKey,
      version: setting.version,
      value,
    })
  }

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!setting) throw new Error('Setting not loaded.')

      const response = await release2Service.previewRelease2Setting(
        setting.settingKey,
        parseEditorValue(setting, editorValue),
      )

      return response.data
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!setting) throw new Error('Setting not loaded.')

      const response = await release2Service.updateRelease2Setting(
        setting.settingKey,
        {
          value: parseEditorValue(setting, editorValue),
          expectedVersion: setting.version,
          reason: reason.trim(),
        },
      )

      return response.data
    },
    onSuccess: (updated) => {
      setSavedAt(updated.updatedAt)
      setValueDraft(null)
      setReason('')
      previewMutation.reset()
      void queryClient.invalidateQueries({ queryKey: ['release2'] })
    },
  })

  const preview = previewMutation.data
  const backendFieldErrors = fieldErrorMap(saveMutation.error)
  const valueFieldError =
    backendFieldErrors.value ?? preview?.validationErrors[0]?.message ?? null

  if (settingQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </PageContainer>
    )
  }

  if (settingQuery.isError && isPermissionDenied(settingQuery.error)) {
    return (
      <PageContainer>
        <Release2PermissionPanel
          error={settingQuery.error}
          required={['settings:read']}
        />
      </PageContainer>
    )
  }

  if (settingQuery.isError || !setting) {
    return (
      <PageContainer>
        <ErrorState
          description={errorMessage(
            settingQuery.error,
            'Could not load this Release 2 setting.',
          )}
          title="Setting unavailable"
          onRetry={() => void settingQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const isFinance = setting.riskLevel === 'FINANCE'
  const financeBlocked = isFinance && !canUpdateFinanceSettings
  const requiresReason =
    setting.requiresReason || setting.riskLevel === 'HIGH' || isFinance
  const isDirty = editorValue !== savedValue
  const previewedCurrentValue = Boolean(preview && preview.isValid && !previewMutation.isPending)
  const canSubmit =
    canUpdateSettings &&
    !financeBlocked &&
    setting.isEditable &&
    isDirty &&
    previewedCurrentValue &&
    reason.trim().length >= 3

  const saveBlockedReason = !canUpdateSettings
    ? 'Requires settings:update'
    : financeBlocked
      ? 'Requires release2-finance-settings:update'
      : !setting.isEditable
        ? 'This setting is not editable'
        : !isDirty
          ? 'Change the value first'
          : !previewedCurrentValue
            ? 'Run Check value first'
            : reason.trim().length < 3
              ? 'Add a reason'
              : undefined

  const unit =
    typeof setting.validation.unit === 'string' ? setting.validation.unit : undefined
  const enumOptions = Array.isArray(setting.validation.enum)
    ? setting.validation.enum
    : undefined

  return (
    <PageContainer className="space-y-4">
      <DetailPageHeader
        actionNode={
          <Button
            aria-label="Reload setting"
            className="h-9 px-2.5"
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => void settingQuery.refetch()}
          >
            <RefreshCcw
              className={cn(
                'size-4',
                settingQuery.isFetching && 'animate-spin motion-reduce:animate-none',
              )}
            />
          </Button>
        }
        breadcrumbs={[
          { label: 'Release 2', href: routePaths.release2Overview },
          { label: 'Settings', href: routePaths.release2Settings },
          { label: setting.displayName },
        ]}
        listHref={routePaths.release2Settings}
        listLabel="Release 2 Settings"
        recordName={setting.displayName}
        title={setting.displayName}
        titleMetaNode={
          <>
            <Badge tone={riskTone(setting.riskLevel)}>{setting.riskLevel}</Badge>
            {setting.uiGroup ? (
              <Badge tone="neutral">{settingGroupLabel(setting.uiGroup)}</Badge>
            ) : null}
            <span className="font-mono text-xs text-muted">{setting.settingKey}</span>
          </>
        }
      />

      <Release2Warnings warnings={setting.warnings} />

      {financeBlocked ? (
        <Release2Notice
          detail="Ask a Super Admin or Finance Admin to apply this change. The backend rejects it without release2-finance-settings:update."
          title="Finance setting is read-only for your role"
          tone="warning"
        />
      ) : null}

      {savedAt ? (
        <Release2Notice
          detail={`Saved at ${formatDateTime(savedAt)}. A new version and audit entry were recorded.`}
          title="Setting updated"
          tone="info"
        />
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="space-y-3 !p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Value</h3>
            <span className="text-xs text-muted">v{setting.version}</span>
          </div>

          {setting.description ? (
            <p className="text-sm text-muted">{setting.description}</p>
          ) : null}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-foreground">
              New value {unit ? `(${unit})` : ''}
            </span>

            {setting.valueType === 'boolean' ? (
              <select
                className="form-select h-10"
                disabled={!setting.isEditable}
                value={editorValue === 'true' ? 'true' : 'false'}
                onChange={(event) => {
                  setEditorValue(event.target.value)
                  previewMutation.reset()
                }}
              >
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            ) : enumOptions ? (
              <select
                className="form-select h-10"
                disabled={!setting.isEditable}
                value={editorValue}
                onChange={(event) => {
                  setEditorValue(event.target.value)
                  previewMutation.reset()
                }}
              >
                {enumOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                disabled={!setting.isEditable}
                hasError={Boolean(valueFieldError)}
                max={typeof setting.validation.max === 'number' ? setting.validation.max : undefined}
                min={typeof setting.validation.min === 'number' ? setting.validation.min : undefined}
                type={
                  setting.valueType === 'integer' || setting.valueType === 'number'
                    ? 'number'
                    : 'text'
                }
                value={editorValue}
                onChange={(event) => {
                  setEditorValue(event.target.value)
                  previewMutation.reset()
                }}
              />
            )}

            <span
              className={cn('block text-xs', valueFieldError ? 'text-danger' : 'text-muted')}
            >
              {valueFieldError ?? validationHint(setting.validation)}
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={!isDirty || !setting.isEditable}
              isLoading={previewMutation.isPending}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => previewMutation.mutate()}
            >
              Check value
            </Button>

            {preview ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold',
                  preview.isValid ? 'text-success' : 'text-danger',
                )}
              >
                {preview.isValid ? (
                  <CircleCheck className="size-3.5" />
                ) : (
                  <ShieldAlert className="size-3.5" />
                )}
                {preview.isValid
                  ? `Valid · will save ${formatSettingValue(preview.normalizedValue, unit)}`
                  : 'Rejected by validation'}
              </span>
            ) : null}
          </div>

          <Release2ErrorNotice error={previewMutation.error} />

          {preview && preview.validationErrors.length > 1 ? (
            <ul className="space-y-1 text-xs text-danger">
              {preview.validationErrors.map((validationError) => (
                <li key={`${validationError.field}-${validationError.message}`}>
                  {validationError.field}: {validationError.message}
                </li>
              ))}
            </ul>
          ) : null}

          {preview?.warnings.length ? (
            <Release2Warnings warnings={preview.warnings} />
          ) : null}

          <ReasonField
            disabled={!setting.isEditable || saveMutation.isPending}
            error={localError ?? backendFieldErrors.reason ?? null}
            label={requiresReason ? 'Reason' : 'Reason (recorded in audit)'}
            value={reason}
            onChange={setReason}
          />

          <Release2ErrorNotice
            error={saveMutation.error}
            onReload={() => void settingQuery.refetch()}
          />

          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted">
              {setting.requiresRecentAuth
                ? 'Needs a recent login. You may be asked to re-authenticate.'
                : 'Saving records an audit entry.'}
            </span>
            <Button
              disabled={!canSubmit}
              isLoading={saveMutation.isPending}
              size="sm"
              title={saveBlockedReason}
              type="button"
              variant="primary"
              onClick={() => {
                if (reason.trim().length < 3) {
                  setLocalError('Reason must be at least 3 characters.')

                  return
                }

                setLocalError(null)
                saveMutation.mutate()
              }}
            >
              Save value
            </Button>
          </div>
        </Card>

        <Card className="!p-4">
          <h3 className="text-sm font-semibold text-foreground">Setting</h3>
          <RecordFieldList className="mt-2">
            <RecordField
              label="Current"
              value={
                setting.isValueMasked
                  ? 'Masked'
                  : formatSettingValue(setting.value, unit)
              }
            />
            <RecordField
              label="Default"
              value={
                setting.isValueMasked
                  ? 'Masked'
                  : formatSettingValue(setting.defaultValue, unit)
              }
            />
            <RecordField label="Type" value={setting.valueType} />
            <RecordField label="Category" value={setting.category} />
            <RecordField label="Editable" value={setting.isEditable ? 'Yes' : 'No'} />
            <RecordField label="Reason required" value={requiresReason ? 'Yes' : 'No'} />
            <RecordField
              label="Recent auth"
              value={setting.requiresRecentAuth ? 'Required' : 'Not required'}
            />
            <RecordField
              label="Approval"
              value={setting.wouldRequireApproval ? 'Required' : 'Not required'}
            />
            <RecordField label="Updated" value={formatDateTime(setting.updatedAt)} />
            <RecordField
              label="Actions"
              value={setting.availableActions.join(', ') || '—'}
            />
          </RecordFieldList>
        </Card>
      </div>
    </PageContainer>
  )
}
