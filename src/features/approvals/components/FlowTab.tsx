import { ArrowRight, Zap } from 'lucide-react'
import { cn } from '../../../utils/cn'
import type {
  ApprovalActionTemplate,
  ApprovalConditionField,
  ApprovalRule,
  ApprovalWorkflowDetail,
  ApprovalWorkflowVersionDetail,
} from '../types/approval.types'
import { autoDecisionLabel } from '../copy'
import { collectConditionLeaves, conditionJoiner, humanizeCode, sortRules } from './shared'
import { AutoBolt, GlyphLegend, RiskMeter } from './Glyphs'
import { StageChain } from './StageChain'

/**
 * Rules render in evaluation order down a numbered rail, so "first match wins"
 * is a spatial fact rather than a priority number the reader has to decode.
 */
export function FlowTab({
  actionTemplates,
  conditionFields,
  selectedVersion,
  workflow,
}: {
  actionTemplates: ApprovalActionTemplate[]
  conditionFields: ApprovalConditionField[]
  selectedVersion: ApprovalWorkflowVersionDetail
  workflow: ApprovalWorkflowDetail
}) {
  const rules = sortRules(selectedVersion.rules)
  const actionByCode = new Map(
    actionTemplates.map((template) => [template.actionCode, template]),
  )

  return (
    <div className="space-y-4">
      {/* Trigger — the one entry point every rule below is racing to match */}
      <div className="flex items-center gap-3 rounded-surface border border-border bg-surface-muted/40 px-3 py-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Zap className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {humanizeCode(workflow.triggerEvent)}
          </p>
          <p className="truncate text-xs text-muted">
            Checked against {rules.length} {rules.length === 1 ? 'rule' : 'rules'}, top first
          </p>
        </div>
      </div>

      <div>
        {rules.map((rule, index) => (
          <RuleNode
            actionTemplate={actionByCode.get(rule.finalActionCode) ?? null}
            conditionFields={conditionFields}
            isLast={index === rules.length - 1}
            key={rule.ruleId}
            rule={rule}
            stepNumber={index + 1}
          />
        ))}
      </div>

      <GlyphLegend />
    </div>
  )
}

function RuleNode({
  actionTemplate,
  conditionFields,
  isLast,
  rule,
  stepNumber,
}: {
  actionTemplate: ApprovalActionTemplate | null
  conditionFields: ApprovalConditionField[]
  isLast: boolean
  rule: ApprovalRule
  stepNumber: number
}) {
  const leaves = collectConditionLeaves(rule.conditionJson, conditionFields)
  const joiner = conditionJoiner(rule.conditionJson)
  const isAuto = Boolean(rule.autoDecision)
  const approverCount = rule.stages.reduce((total, stage) => total + stage.approvers.length, 0)

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      {/* Evaluation-order rail */}
      <div className="flex flex-col items-center">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface text-sm font-semibold tabular-nums text-muted">
          {stepNumber}
        </span>
        {!isLast && <span className="h-full min-h-5 w-0.5 bg-border" />}
      </div>

      <section
        className={cn(
          'min-w-0 overflow-hidden rounded-surface border',
          isAuto ? 'border-success/30 bg-success/5' : 'border-border bg-surface',
          isLast ? 'mb-0' : 'mb-3',
        )}
      >
        {/* Header carries identity only — the stage cards and the outcome row
            below already carry the policy and risk marks. */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          {isAuto && <AutoBolt label={autoDecisionLabel(rule.autoDecision)} />}
          <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {rule.displayName}
          </h3>
          {approverCount > 0 && (
            <span className="shrink-0 text-xs text-muted">
              {approverCount} {approverCount === 1 ? 'approver' : 'approvers'}
            </span>
          )}
        </div>

        {/*
          When → who → then. Stacked on narrow screens, three columns from xl up.
          The wide layout is what stops a 1,500px-wide panel from holding three
          small chips per row and scrolling for a screen and a half.
        */}
        <div className="grid border-t border-border/70 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)_minmax(0,0.7fr)]">
          <div className="min-w-0 border-b border-border/70 px-3 py-2.5 xl:border-b-0 xl:border-r">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">When</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {leaves.length > 0 ? (
                leaves.map((leaf, index) => (
                  <span className="contents" key={`${leaf.field}-${leaf.op}-${index}`}>
                    {index > 0 && <span className="text-xs font-medium text-muted">{joiner}</span>}
                    <span className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs font-medium text-foreground">
                      {leaf.label}
                    </span>
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-border bg-surface-muted/60 px-2.5 py-1 text-xs font-medium text-muted">
                  Anything that reaches here
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 border-b border-border/70 px-3 py-2.5 xl:border-b-0 xl:border-r">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              Who approves
            </p>
            <StageChain autoDecision={rule.autoDecision} stages={rule.stages} />
          </div>

          <div className="min-w-0 bg-surface-muted/25 px-3 py-2.5">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Then</p>
            {actionTemplate ? (
              <div className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted" />
                <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {actionTemplate.displayName}
                </p>
                <RiskMeter level={actionTemplate.riskLevel} />
              </div>
            ) : (
              <p className="text-sm text-muted">Not registered</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
