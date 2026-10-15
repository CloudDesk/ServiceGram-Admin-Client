import { type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import type { PlatformSetting } from '../../settings/types/settings.types'
import {
  parseMoneyToPaise,
  parsePercentToBps,
  textFromBps,
  textFromPaise,
  type CommissionRateType,
} from '../utils/commissionFormatting'
import { CommissionRateFields } from './CommissionRateFields'

export interface InfluencerCommissionConfigValue {
  enabled: boolean
  commissionType: 'FIXED' | 'PERCENTAGE'
  commissionValue: number
  minimumCommissionPaise: number
  maximumCommissionPaise: number | null
}

interface InfluencerCommissionEditModalProps {
  setting: PlatformSetting | null
  error?: unknown
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: { value: InfluencerCommissionConfigValue; reason: string }) => void
}

function parseExistingConfig(value: unknown): InfluencerCommissionConfigValue {
  const config = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    enabled: typeof config.enabled === 'boolean' ? config.enabled : true,
    commissionType: config.commissionType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
    commissionValue:
      typeof config.commissionValue === 'number' && Number.isFinite(config.commissionValue)
        ? config.commissionValue
        : 500,
    minimumCommissionPaise:
      typeof config.minimumCommissionPaise === 'number' &&
      Number.isFinite(config.minimumCommissionPaise)
        ? config.minimumCommissionPaise
        : 0,
    maximumCommissionPaise:
      typeof config.maximumCommissionPaise === 'number' &&
      Number.isFinite(config.maximumCommissionPaise)
        ? config.maximumCommissionPaise
        : null,
  }
}

export function InfluencerCommissionEditModal({
  setting,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: InfluencerCommissionEditModalProps) {
  if (!setting) return null

  return (
    <InfluencerCommissionEditModalContent
      key={`${setting.settingKey}:${setting.updatedAt}`}
      setting={setting}
      error={error}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function InfluencerCommissionEditModalContent({
  setting,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: InfluencerCommissionEditModalProps & { setting: PlatformSetting }) {
  const initial = parseExistingConfig(setting.value)
  const [enabled, setEnabled] = useState(initial.enabled)
  const [rateType, setRateType] = useState<CommissionRateType>(initial.commissionType)
  const [percentText, setPercentText] = useState(
    initial.commissionType === 'PERCENTAGE' ? textFromBps(initial.commissionValue) : '5',
  )
  const [fixedText, setFixedText] = useState(
    initial.commissionType === 'FIXED' ? textFromPaise(initial.commissionValue) : '0',
  )
  const [minText, setMinText] = useState(textFromPaise(initial.minimumCommissionPaise))
  const [maxText, setMaxText] = useState(
    initial.maximumCommissionPaise === null ? '' : textFromPaise(initial.maximumCommissionPaise),
  )
  const [reason, setReason] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }

    try {
      const commissionValue =
        rateType === 'PERCENTAGE'
          ? parsePercentToBps(percentText, 'Commission rate')
          : parseMoneyToPaise(fixedText, 'Fixed amount')
      const minimumCommissionPaise = parseMoneyToPaise(minText, 'Minimum commission')
      const maximumCommissionPaise = maxText.trim()
        ? parseMoneyToPaise(maxText, 'Maximum commission')
        : null

      if (maximumCommissionPaise !== null && maximumCommissionPaise < minimumCommissionPaise) {
        setFormError('Maximum commission must be at least the minimum.')
        return
      }

      onSubmit({
        value: {
          enabled,
          commissionType: rateType,
          commissionValue,
          minimumCommissionPaise,
          maximumCommissionPaise,
        },
        reason: trimmedReason,
      })
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error ? caughtError.message : 'Commission policy is invalid.',
      )
    }
  }

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold tracking-normal text-foreground">
            Edit influencer commission
          </h2>
          <button
            aria-label="Close commission modal"
            className="rounded-full p-2 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-4">
              <CommissionRateFields
                rateType={rateType}
                onRateTypeChange={setRateType}
                percentText={percentText}
                onPercentTextChange={setPercentText}
                fixedText={fixedText}
                onFixedTextChange={setFixedText}
              />
              <button
                className="text-xs font-semibold text-primary"
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
              >
                {showAdvanced ? 'Hide advanced' : 'Show advanced'}
              </button>
              {showAdvanced ? (
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      checked={enabled}
                      type="checkbox"
                      onChange={(event) => setEnabled(event.target.checked)}
                    />
                    <span className="text-sm text-foreground">Commission enabled</span>
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs text-muted">Minimum commission (₹)</span>
                      <Input
                        inputMode="decimal"
                        value={minText}
                        onChange={(event) => setMinText(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-muted">
                        Maximum commission (₹, blank = no cap)
                      </span>
                      <Input
                        inputMode="decimal"
                        placeholder="No cap"
                        value={maxText}
                        onChange={(event) => setMaxText(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">
                  Reason <span className="text-danger">*</span>
                </span>
                <textarea
                  className="form-input min-h-20 resize-y"
                  placeholder="Required for audit history"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {formError || error ? (
                <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                  {formError ?? (error instanceof Error ? error.message : 'Save failed.')}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
