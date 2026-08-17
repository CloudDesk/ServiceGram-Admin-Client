/**
 * What a rule in this module is allowed to look at, and what it is allowed to do.
 *
 * Replaces the old "Builder map", which showed seven static status chips
 * describing configuration that was already visible elsewhere — one of them
 * permanently reading "Pending API". These two registries are the part of that
 * tab that carried real information.
 */

import { Skeleton } from '../../../components/ui/Skeleton'
import type { ApprovalActionTemplate, ApprovalConditionField } from '../types/approval.types'
import { riskLabel } from '../copy'
import { allowedValues, humanizeCode, operatorLabel } from './shared'
import { RiskMeter } from './Glyphs'

export function RegistryTab({
  actionTemplates,
  conditionFields,
  isActionTemplatesLoading,
  isConditionFieldsLoading,
}: {
  actionTemplates: ApprovalActionTemplate[]
  conditionFields: ApprovalConditionField[]
  isActionTemplatesLoading: boolean
  isConditionFieldsLoading: boolean
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ConditionFieldsPanel fields={conditionFields} isLoading={isConditionFieldsLoading} />
      <ActionTemplatesPanel actionTemplates={actionTemplates} isLoading={isActionTemplatesLoading} />
    </div>
  )
}

function ConditionFieldsPanel({
  fields,
  isLoading,
}: {
  fields: ApprovalConditionField[]
  isLoading: boolean
}) {
  return (
    <section className="overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">What rules can check</h3>
          <p className="text-xs text-muted">Fields available to this trigger</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
          {fields.length}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 p-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {!isLoading && fields.length === 0 && (
          <p className="p-4 text-sm text-muted">No fields are registered for this trigger.</p>
        )}
        {!isLoading && fields.length > 0 && (
          <ul className="divide-y divide-border">
            {fields.map((field) => {
              const values = allowedValues(field.allowedValuesSource)

              return (
                <li className="px-3 py-2.5" key={field.fieldId}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-foreground">{field.label}</p>
                    {field.isSensitive && (
                      <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                        Sensitive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Can be compared with{' '}
                    {field.allowedOperators.map((op) => operatorLabel(op)).join(', ')}
                  </p>
                  {values.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {values.map((value) => (
                        <span
                          className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
                          key={value}
                        >
                          {humanizeCode(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

function ActionTemplatesPanel({
  actionTemplates,
  isLoading,
}: {
  actionTemplates: ApprovalActionTemplate[]
  isLoading: boolean
}) {
  return (
    <section className="overflow-hidden rounded-surface border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">What can happen at the end</h3>
          <p className="text-xs text-muted">Actions a rule is allowed to trigger</p>
        </div>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted">
          {actionTemplates.length}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading && (
          <div className="space-y-2 p-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {!isLoading && actionTemplates.length === 0 && (
          <p className="p-4 text-sm text-muted">No actions are registered for this module.</p>
        )}
        {!isLoading && actionTemplates.length > 0 && (
          <ul className="divide-y divide-border">
            {actionTemplates.map((template) => (
              <li
                className="flex items-start justify-between gap-3 px-3 py-2.5"
                key={template.actionTemplateId}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{template.displayName}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">{template.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <RiskMeter level={template.riskLevel} />
                  <span className="text-xs text-muted">{riskLabel(template.riskLevel)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
