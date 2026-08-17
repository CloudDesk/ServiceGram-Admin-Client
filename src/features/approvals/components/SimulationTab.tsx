import { useMemo, useState } from 'react'
import { CheckCircle2, CircleDashed, PlayCircle, RefreshCcw, TestTube2 } from 'lucide-react'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/Skeleton'
import { cn } from '../../../utils/cn'
import type {
  ApprovalConditionEvaluation,
  ApprovalConditionField,
  ApprovalRuleEvaluation,
  ApprovalSimulationData,
  ApprovalWorkflowDetail,
} from '../types/approval.types'
import { riskLabel } from '../copy'
import {
  IssueList,
  expandContext,
  flattenContext,
  formatUnknown,
  humanizeCode,
  readErrorMessage,
  sampleTemplatesForWorkflow,
} from './shared'
import { ContextForm, RawContextEditor } from './ContextForm'
import { RiskMeter } from './Glyphs'
import { StageChain } from './StageChain'

export function SimulationTab({
  canSimulate,
  conditionFields,
  error,
  isPending,
  onRunSimulation,
  result,
  workflow,
}: {
  canSimulate: boolean
  conditionFields: ApprovalConditionField[]
  error: unknown
  isPending: boolean
  onRunSimulation: (context: Record<string, unknown>) => void
  result: ApprovalSimulationData | null
  workflow: ApprovalWorkflowDetail
}) {
  const templates = useMemo(() => sampleTemplatesForWorkflow(workflow), [workflow])
  const fieldPaths = useMemo(
    () => conditionFields.map((field) => field.fieldPath),
    [conditionFields],
  )

  const [state, setState] = useState(() => ({
    templateLabel: templates[0]?.label ?? '',
    values: flattenContext(templates[0]?.context ?? {}, fieldPaths),
    workflowId: workflow.workflowId,
  }))

  // Reset when the operator switches workflow — the fields change entirely.
  let { templateLabel, values } = state
  if (state.workflowId !== workflow.workflowId) {
    templateLabel = templates[0]?.label ?? ''
    values = flattenContext(templates[0]?.context ?? {}, fieldPaths)
    setState({ templateLabel, values, workflowId: workflow.workflowId })
  }

  const applyTemplate = (label: string) => {
    const template = templates.find((entry) => entry.label === label)
    setState({
      templateLabel: label,
      values: flattenContext(template?.context ?? {}, fieldPaths),
      workflowId: workflow.workflowId,
    })
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(19rem,0.9fr)_minmax(0,1.1fr)]">
      <div className="space-y-3">
        {!canSimulate && (
          <InlineAlert message="You need permission to run checks before you can try a workflow." />
        )}

        <div className="rounded-surface border border-border bg-surface">
          <div className="border-b border-border px-3 py-3">
            <h3 className="text-sm font-semibold text-foreground">Start from a sample</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  aria-pressed={template.label === templateLabel}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    template.label === templateLabel
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-foreground hover:bg-surface-muted',
                  )}
                  key={template.label}
                  type="button"
                  onClick={() => applyTemplate(template.label)}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 px-3 py-3">
            <ContextForm
              fields={conditionFields}
              values={values}
              onChange={(next) =>
                setState({ templateLabel, values: next, workflowId: workflow.workflowId })
              }
              onReset={() => applyTemplate(templateLabel)}
            />

            <RawContextEditor
              error={null}
              values={values}
              onApply={(context) =>
                setState({
                  templateLabel,
                  values: flattenContext(context, fieldPaths),
                  workflowId: workflow.workflowId,
                })
              }
            />
          </div>

          <div className="border-t border-border px-3 py-3">
            <Button
              className="w-full sm:w-auto"
              disabled={!canSimulate}
              isLoading={isPending}
              type="button"
              onClick={() => onRunSimulation(expandContext(values))}
            >
              <PlayCircle className="mr-2 size-4" />
              See what happens
            </Button>
          </div>
        </div>
      </div>

      <SimulationResultPanel error={error} isPending={isPending} result={result} />
    </div>
  )
}

function SimulationResultPanel({
  error,
  isPending,
  result,
}: {
  error: unknown
  isPending: boolean
  result: ApprovalSimulationData | null
}) {
  if (isPending) {
    return (
      <div className="rounded-surface border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <RefreshCcw className="size-4 animate-spin" />
          Working it out…
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-surface border border-border bg-surface p-3">
        <InlineAlert message={readErrorMessage(error)} />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-surface border border-dashed border-border p-5 text-center">
        <div className="max-w-xs space-y-2">
          <TestTube2 className="mx-auto size-8 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Nothing tried yet</h3>
          <p className="text-sm leading-6 text-muted">
            Pick a sample, adjust the values, and see which rule catches it and who would approve.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex items-start gap-3 rounded-surface border p-4',
          result.matched ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5',
        )}
      >
        {result.matched ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <CircleDashed className="mt-0.5 size-5 shrink-0 text-warning" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {result.matched ? 'One rule caught it' : 'No rule caught it'}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {result.matched
              ? result.matchedRule?.displayName
              : 'Nothing would happen. Adjust the values, or add a catch-all rule.'}
          </p>
        </div>
      </div>

      {result.validation.errors.length > 0 && (
        <IssueList issues={result.validation.errors} title="Problems to fix" />
      )}

      {result.actionPreview && (
        <div className="overflow-hidden rounded-surface border border-border bg-surface">
          <div className="flex items-start gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {result.actionPreview.displayName}
              </p>
              <p className="mt-0.5 text-sm text-muted">{result.actionPreview.description}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <RiskMeter level={result.actionPreview.riskLevel} />
              <span className="text-xs text-muted">{riskLabel(result.actionPreview.riskLevel)}</span>
            </div>
          </div>
        </div>
      )}

      {result.stagePreview.length > 0 && (
        <div className="overflow-hidden rounded-surface border border-border bg-surface">
          <h3 className="border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground">
            Who would approve
          </h3>
          <div className="px-3 py-3">
            <StageChain stages={result.stagePreview} />
          </div>
        </div>
      )}

      {result.ruleEvaluations.length > 0 && (
        <RuleEvaluationList evaluations={result.ruleEvaluations} />
      )}
    </div>
  )
}

/** Why each rule did or did not catch the context — the debugging view. */
function RuleEvaluationList({ evaluations }: { evaluations: ApprovalRuleEvaluation[] }) {
  return (
    <section className="overflow-hidden rounded-surface border border-border bg-surface">
      <h3 className="border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground">
        Every rule, in order
      </h3>
      <div className="divide-y divide-border">
        {evaluations.map((evaluation) => (
          <details className="group" key={evaluation.ruleId}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-surface-muted/40">
              <span
                aria-hidden="true"
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  evaluation.matched ? 'bg-success' : 'border border-border bg-transparent',
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {evaluation.displayName}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {evaluation.matched ? 'Caught it' : 'Passed over'}
              </span>
            </summary>
            <div className="border-t border-border bg-surface-muted/25 px-3 py-2.5">
              <ConditionEvaluationTree evaluation={evaluation.evaluation} />
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function ConditionEvaluationTree({ evaluation }: { evaluation: ApprovalConditionEvaluation }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 rounded-control bg-surface px-3 py-2">
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {evaluation.field
            ? `${humanizeCode(evaluation.field)} ${evaluation.op ?? ''}`
            : humanizeCode(evaluation.reason ?? 'condition')}
        </span>
        <span
          className={cn(
            'shrink-0 text-xs font-semibold',
            evaluation.matched ? 'text-success' : 'text-muted',
          )}
        >
          {evaluation.matched ? 'Yes' : 'No'}
        </span>
      </div>
      {evaluation.field && (
        <p className="px-3 text-xs text-muted">
          Got {formatUnknown(evaluation.actual)} · wanted {formatUnknown(evaluation.expected)}
        </p>
      )}
      {evaluation.children?.length ? (
        <div className="ml-3 border-l border-border pl-3">
          {evaluation.children.map((child, index) => (
            <ConditionEvaluationTree
              evaluation={child}
              // biome-ignore lint/suspicious/noArrayIndexKey: tree path sufficient for stable key
              key={`${child.path ?? 'c'}-${index}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
