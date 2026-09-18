import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../../hooks/useToast'
import { cn } from '../../../utils/cn'
import { release2Service } from '../services/release2.service'
import type { FeatureFlagListRow } from '../types/release2.types'
import { Release2ReasonModal } from './Release2ReasonModal'

interface FeatureFlagQuickToggleProps {
  row: FeatureFlagListRow
  field: 'status' | 'defaultEnabled'
  canUpdate: boolean
}

const HIGH_RISK_LEVELS = new Set(['HIGH', 'FINANCE'])

/**
 * Inline on/off switch for the feature-flags list. Every write still goes
 * through the same audited `updateFeatureFlag` call the full edit form uses
 * (expectedVersion + a required reason) — this only skips opening that form
 * for the common case of flipping one field. A stray Enter/Space or click
 * inside the confirm dialog must not bubble to the row's own onClick
 * (DataList navigates to the detail page on row click), so the dialog is
 * wrapped to stop propagation.
 */
export function FeatureFlagQuickToggle({ canUpdate, field, row }: FeatureFlagQuickToggleProps) {
  const queryClient = useQueryClient()
  const { pushToast } = useToast()
  const [isOpen, setOpen] = useState(false)

  const isArchived = row.status === 'ARCHIVED'
  const checked = field === 'status' ? row.status === 'ENABLED' : row.defaultEnabled
  const nextValue = !checked
  const canToggle = canUpdate && !isArchived

  const disabledTitle = !canUpdate
    ? 'Requires feature-flags:update'
    : isArchived
      ? 'Archived flags cannot be changed'
      : undefined

  const warnings: string[] = []
  if (field === 'status' && checked && row.rolloutPercentage > 0) {
    warnings.push(
      `Currently rolled out to ${row.rolloutPercentage}% of traffic — turning it off takes effect immediately.`,
    )
  }
  if (field === 'status' && !checked && HIGH_RISK_LEVELS.has(row.riskLevel)) {
    warnings.push(`This flag is marked ${row.riskLevel.toLowerCase()} risk.`)
  }

  const mutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await release2Service.updateFeatureFlag(row.featureKey, {
        ...(field === 'status'
          ? { status: nextValue ? ('ENABLED' as const) : ('DISABLED' as const) }
          : { defaultEnabled: nextValue }),
        expectedVersion: row.version,
        reason,
      })

      return response.data
    },
    onSuccess: (flag) => {
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['release2', 'feature-flags'] })
      pushToast({
        tone: 'success',
        title:
          field === 'status'
            ? `${flag.displayName} turned ${nextValue ? 'on' : 'off'}`
            : `${flag.displayName} default set to ${nextValue ? 'on' : 'off'}`,
      })
    },
  })

  return (
    <div className="flex items-center gap-2">
      <button
        aria-checked={checked}
        aria-label={`Turn ${field === 'status' ? 'status' : 'default'} ${nextValue ? 'on' : 'off'} for ${row.displayName}`}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          checked ? 'bg-success' : 'bg-border',
          canToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
        )}
        disabled={!canToggle}
        role="switch"
        title={disabledTitle}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-3.5 translate-x-[3px] transform rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-[18px]',
          )}
        />
      </button>
      <span className={cn('text-xs', checked ? 'text-foreground' : 'text-muted')}>
        {checked ? 'On' : 'Off'}
      </span>

      {isOpen ? (
        <div
          className="whitespace-normal"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Release2ReasonModal
            confirmLabel={nextValue ? 'Turn on' : 'Turn off'}
            error={mutation.error}
            isSubmitting={mutation.isPending}
            subtitle={row.featureKey}
            title={
              field === 'status'
                ? `Turn ${nextValue ? 'on' : 'off'} "${row.displayName}"?`
                : `Set default ${nextValue ? 'on' : 'off'} for "${row.displayName}"?`
            }
            warnings={warnings}
            onClose={() => {
              mutation.reset()
              setOpen(false)
            }}
            onReload={() => {
              mutation.reset()
              void queryClient.invalidateQueries({ queryKey: ['release2', 'feature-flags'] })
            }}
            onSubmit={(reason) => mutation.mutate(reason)}
          />
        </div>
      ) : null}
    </div>
  )
}
