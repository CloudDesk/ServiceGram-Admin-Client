/**
 * Builds the simulation context from the condition-field registry.
 *
 * The registry already declares every field an admin may test, its data type,
 * and — for string fields — the exact values it accepts. That is enough to
 * render a real form, so nobody has to hand-author JSON to answer "what happens
 * to a ₹7,500 disputed refund?". The raw editor stays as an escape hatch for
 * engineers testing paths the registry does not cover.
 */

import { useState } from 'react'
import { Code2, RotateCcw } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../utils/cn'
import type { ApprovalConditionField } from '../types/approval.types'
import {
  allowedValues,
  expandContext,
  formatJson,
  groupFieldsByEntity,
  humanizeCode,
  parseContextDraft,
} from './shared'

export function ContextForm({
  fields,
  onChange,
  onReset,
  values,
}: {
  fields: ApprovalConditionField[]
  onChange: (values: Record<string, unknown>) => void
  onReset: () => void
  values: Record<string, unknown>
}) {
  const groups = groupFieldsByEntity(fields)

  const setValue = (fieldPath: string, value: unknown) => {
    onChange({ ...values, [fieldPath]: value })
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-control border border-dashed border-border p-4 text-sm text-muted">
        No testable fields are registered for this trigger. Use the raw editor below.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map(([entity, entityFields]) => (
        <fieldset className="min-w-0" key={entity}>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            {humanizeCode(entity)}
          </legend>
          <div className="space-y-3">
            {entityFields.map((field) => (
              <FieldControl
                field={field}
                key={field.fieldId}
                value={values[field.fieldPath]}
                onChange={(value) => setValue(field.fieldPath, value)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <Button size="sm" type="button" variant="ghost" onClick={onReset}>
        <RotateCcw className="mr-1.5 size-4" />
        Reset to sample
      </Button>
    </div>
  )
}

function FieldControl({
  field,
  onChange,
  value,
}: {
  field: ApprovalConditionField
  onChange: (value: unknown) => void
  value: unknown
}) {
  const controlId = `ctx-${field.fieldId}`
  const options = allowedValues(field.allowedValuesSource)

  if (field.dataType === 'boolean') {
    const checked = value === true

    return (
      <div className="flex min-h-11 items-center justify-between gap-3">
        <label className="min-w-0 text-sm font-medium text-foreground" htmlFor={controlId}>
          {field.label}
        </label>
        <button
          aria-checked={checked}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            checked ? 'bg-primary' : 'bg-border',
          )}
          id={controlId}
          role="switch"
          type="button"
          onClick={() => onChange(!checked)}
        >
          <span
            className={cn(
              'inline-block size-5 rounded-full bg-surface shadow-sm transition-transform',
              checked ? 'translate-x-6' : 'translate-x-1',
            )}
          />
        </button>
      </div>
    )
  }

  if (field.dataType === 'money_paise') {
    // The API stores paise; admins think in rupees. Convert at the boundary.
    const rupees = typeof value === 'number' ? String(value / 100) : ''

    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground" htmlFor={controlId}>
          {field.label}
        </label>
        <div className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
          <span className="text-sm text-muted">₹</span>
          <input
            className="min-h-11 w-full bg-transparent text-sm tabular-nums text-foreground focus:outline-none"
            id={controlId}
            inputMode="decimal"
            type="number"
            value={rupees}
            onChange={(event) => {
              const next = event.target.value
              onChange(next === '' ? undefined : Math.round(Number(next) * 100))
            }}
          />
        </div>
      </div>
    )
  }

  if (options.length > 0) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground" htmlFor={controlId}>
          {field.label}
        </label>
        <select
          className="form-input min-h-11 w-full text-sm"
          id={controlId}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || undefined)}
        >
          <option value="">Not set</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {humanizeCode(option)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground" htmlFor={controlId}>
        {field.label}
      </label>
      <input
        className="form-input min-h-11 w-full text-sm"
        id={controlId}
        inputMode={field.dataType === 'number' ? 'numeric' : 'text'}
        type={field.dataType === 'number' ? 'number' : 'text'}
        value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        onChange={(event) => {
          const next = event.target.value
          if (next === '') return onChange(undefined)
          onChange(field.dataType === 'number' ? Number(next) : next)
        }}
      />
    </div>
  )
}

/**
 * The escape hatch. Engineers testing a context the registry does not describe
 * can still hand-write it; everyone else never opens this.
 */
export function RawContextEditor({
  error,
  onApply,
  values,
}: {
  error: null | string
  onApply: (context: Record<string, unknown>) => void
  values: Record<string, unknown>
}) {
  const [draft, setDraft] = useState(() => formatJson(expandContext(values)))
  const [parseError, setParseError] = useState<null | string>(null)

  return (
    <details className="group rounded-control border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-muted hover:text-foreground">
        <Code2 className="size-4" />
        Edit as JSON
      </summary>
      <div className="space-y-2 border-t border-border p-3">
        <textarea
          aria-label="Simulation context as JSON"
          className={cn(
            'form-input min-h-40 w-full resize-y font-mono text-sm leading-6',
            (parseError ?? error) && 'border-danger focus-visible:border-danger',
          )}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setParseError(null)
          }}
        />
        {(parseError ?? error) && (
          <p className="text-sm font-medium text-danger">{parseError ?? error}</p>
        )}
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => {
            const parsed = parseContextDraft(draft)
            if (!parsed.ok) {
              setParseError(parsed.error)
              return
            }
            setParseError(null)
            onApply(parsed.context)
          }}
        >
          Apply
        </Button>
      </div>
    </details>
  )
}
