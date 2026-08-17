import { CornerDownRight } from 'lucide-react'
import type { ApprovalStage } from '../types/approval.types'
import { autoDecisionLabel, escalationActionLabel, approverLabel } from '../copy'
import { formatSla, stageModeHint } from './sharedUtils'
import { ApproverChip, AutoBolt, PolicyDots, SlaArc } from './Glyphs'

export function StageChain({
  autoDecision,
  stages,
}: {
  autoDecision?: null | string
  stages: ApprovalStage[]
}) {
  if (stages.length === 0) {
    const label = autoDecisionLabel(autoDecision ?? null)

    return (
      <div className="flex items-center gap-3 rounded-control border border-success/25 bg-success/5 px-3 py-3">
        <AutoBolt label={label} />
        <p className="text-sm font-semibold text-foreground">{label}</p>
      </div>
    )
  }

  const sorted = stages.slice().sort((a, b) => a.stageOrder - b.stageOrder)
  // Arcs are proportional within a chain, so stages here are comparable to each other.
  const longestMinutes = sorted.reduce((longest, stage) => Math.max(longest, stage.slaMinutes ?? 0), 0)

  return (
    <div>
      {sorted.map((stage, index) => (
        <StageNode
          isLast={index === sorted.length - 1}
          key={stage.stageId}
          longestMinutes={longestMinutes}
          stage={stage}
          stepNumber={index + 1}
        />
      ))}
    </div>
  )
}

function StageNode({
  isLast,
  longestMinutes,
  stage,
  stepNumber,
}: {
  isLast: boolean
  longestMinutes: number
  stage: ApprovalStage
  stepNumber: number
}) {
  const primaryApprovers = stage.approvers.filter((a) => a.approverKind !== 'FALLBACK')
  const fallbackApprovers = stage.approvers.filter((a) => a.approverKind === 'FALLBACK')

  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
      {/* Spine */}
      <div className="flex flex-col items-center">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold tabular-nums text-primary-foreground">
          {stepNumber}
        </span>
        {!isLast && <span className="h-full min-h-5 w-0.5 bg-border" />}
      </div>

      {/* Stage card */}
      <div className={`min-w-0 overflow-hidden rounded-control border border-border bg-surface ${isLast ? '' : 'mb-3'}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          {/* Wraps rather than truncates — a stage name an admin cannot read is
              worse than a two-line row. */}
          <p className="min-w-32 flex-1 text-sm font-semibold text-foreground">
            {stage.stageName}
          </p>
          <PolicyDots
            approverCount={stage.approvers.length}
            decisionPolicy={stage.decisionPolicy}
            minApprovals={stage.minApprovals}
          />
          <SlaArc longestMinutes={longestMinutes} minutes={stage.slaMinutes} />
        </div>

        {stage.approvers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2.5">
            {primaryApprovers.map((approver) => (
              <ApproverChip
                key={approver.approverRuleId}
                resolverConfig={approver.resolverConfig}
                resolverType={approver.resolverType}
              />
            ))}
            {fallbackApprovers.map((approver) => (
              <ApproverChip
                isFallback
                key={approver.approverRuleId}
                resolverConfig={approver.resolverConfig}
                resolverType={approver.resolverType}
              />
            ))}
          </div>
        )}

        {/* Escalations — dashed means "only if the clock runs out" */}
        {stage.escalations.map((escalation) => (
          <div
            className="flex items-center gap-2 border-t border-dashed border-warning/30 bg-warning/5 px-3 py-2"
            key={escalation.escalationRuleId}
          >
            <CornerDownRight className="size-4 shrink-0 text-warning" />
            <p className="min-w-0 text-xs text-muted">
              <span className="font-semibold text-warning">
                After {formatSla(escalation.afterMinutes)}
              </span>{' '}
              {escalationActionLabel(escalation.action).toLowerCase()}
              {escalation.targetResolverType && (
                <>
                  {' '}
                  <span className="font-medium text-foreground">
                    {approverLabel(escalation.targetResolverType, escalation.targetResolverConfig)}
                  </span>
                </>
              )}
            </p>
          </div>
        ))}

        <p className="sr-only">{stageModeHint(stage.stageMode, stage.approvers.length)}</p>
      </div>
    </div>
  )
}
