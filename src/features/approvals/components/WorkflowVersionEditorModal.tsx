import { useMutation } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { ReasonField } from '../../../components/ui/ReasonModal/ReasonModal'
import { cn } from '../../../utils/cn'
import { approvalService } from '../services/approval.service'
import {
  approvalConditionOperators,
  approvalDecisionPolicies,
  approvalResolverTypes,
  approvalRuleMatchModes,
  approvalStageModes,
} from '../types/approval.types'
import type {
  ApprovalActionTemplate,
  ApprovalApproverRuleInput,
  ApprovalConditionField,
  ApprovalConditionLeafInput,
  ApprovalEscalationRuleInput,
  ApprovalRule,
  ApprovalRuleInput,
  ApprovalStage,
  ApprovalStageInput,
  ApprovalWorkflowDetail,
  ApprovalWorkflowVersionDetail,
} from '../types/approval.types'

const selectClass = 'form-select h-9 text-sm'

function emptyLeaf(): ApprovalConditionLeafInput {
  return { field: '', op: 'eq', value: '' }
}

function emptyApprover(): ApprovalApproverRuleInput {
  return {
    resolverType: 'ROLE',
    resolverConfig: {},
    approverKind: 'PRIMARY',
    fallbackOrder: 1,
    excludeInitiator: true,
    requireRecentAuth: true,
  }
}

function emptyEscalation(): ApprovalEscalationRuleInput {
  return {
    trigger: 'TIMEOUT',
    afterMinutes: 60,
    action: 'ESCALATE',
    targetResolverConfig: {},
    maxEscalations: 1,
  }
}

function emptyStage(order: number): ApprovalStageInput {
  return {
    stageKey: `stage_${order}`,
    stageOrder: order,
    stageName: '',
    stageMode: 'SEQUENTIAL',
    decisionPolicy: 'ANY_ONE',
    minApprovals: 1,
    allowReturnForCorrection: false,
    approverRules: [],
    escalationRules: [],
  }
}

function emptyRule(): ApprovalRuleInput {
  return {
    ruleKey: '',
    displayName: '',
    priority: 100,
    conditionJson: { all: [] },
    matchMode: 'FIRST_MATCH',
    finalActionCode: '',
    stages: [],
  }
}

/** Only a flat all-of-leaves survives round-tripping — matches the v1 write API. */
function toLeafInputs(conditionJson: Record<string, unknown>): ApprovalConditionLeafInput[] {
  const all = (conditionJson as { all?: unknown[] }).all
  if (!Array.isArray(all)) return []

  return all
    .filter(
      (leaf): leaf is { field: string; op: string; value?: unknown } =>
        Boolean(leaf) && typeof leaf === 'object' && 'field' in (leaf as object),
    )
    .map((leaf) => ({
      field: leaf.field,
      op: approvalConditionOperators.includes(leaf.op as never)
        ? (leaf.op as ApprovalConditionLeafInput['op'])
        : 'eq',
      value: leaf.value,
    }))
}

function toApproverInput(approver: ApprovalStage['approvers'][number]): ApprovalApproverRuleInput {
  return {
    resolverType: approver.resolverType as ApprovalApproverRuleInput['resolverType'],
    resolverConfig: approver.resolverConfig,
    approverKind: approver.approverKind,
    fallbackOrder: approver.fallbackOrder ?? 1,
    excludeInitiator: approver.excludeInitiator,
    requireRecentAuth: approver.requireRecentAuth,
  }
}

function toEscalationInput(
  escalation: ApprovalStage['escalations'][number],
): ApprovalEscalationRuleInput {
  return {
    trigger: escalation.trigger,
    afterMinutes: escalation.afterMinutes,
    action: escalation.action,
    targetResolverType: (escalation.targetResolverType ??
      undefined) as ApprovalEscalationRuleInput['targetResolverType'],
    targetResolverConfig: escalation.targetResolverConfig,
    maxEscalations: escalation.maxEscalations ?? 1,
  }
}

function toStageInput(stage: ApprovalStage): ApprovalStageInput {
  return {
    stageKey: stage.stageKey,
    stageOrder: stage.stageOrder,
    stageName: stage.stageName,
    stageMode: stage.stageMode as ApprovalStageInput['stageMode'],
    decisionPolicy: stage.decisionPolicy as ApprovalStageInput['decisionPolicy'],
    minApprovals: stage.minApprovals,
    slaMinutes: stage.slaMinutes ?? undefined,
    allowReturnForCorrection: stage.allowReturnForCorrection,
    approverRules: stage.approvers.map(toApproverInput),
    escalationRules: stage.escalations.map(toEscalationInput),
  }
}

function toRuleInput(rule: ApprovalRule): ApprovalRuleInput {
  return {
    ruleKey: rule.ruleKey,
    displayName: rule.displayName,
    description: rule.description || undefined,
    priority: rule.priority,
    conditionJson: { all: toLeafInputs(rule.conditionJson) },
    matchMode: rule.matchMode as ApprovalRuleInput['matchMode'],
    finalActionCode: rule.finalActionCode,
    autoDecision: rule.autoDecision ?? undefined,
    stages: rule.stages.map(toStageInput),
  }
}

function fieldLabel(text: string) {
  return <span className="text-[0.7rem] font-medium text-muted">{text}</span>
}

function LeafRow({
  conditionFields,
  leaf,
  onChange,
  onRemove,
}: {
  conditionFields: ApprovalConditionField[]
  leaf: ApprovalConditionLeafInput
  onChange: (next: ApprovalConditionLeafInput) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
      <label className="block space-y-1">
        {fieldLabel('Field')}
        <select
          className={selectClass}
          value={leaf.field}
          onChange={(event) => onChange({ ...leaf, field: event.target.value })}
        >
          <option value="">Choose a field</option>
          {conditionFields.map((field) => (
            <option key={field.fieldId} value={field.fieldPath}>
              {field.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        {fieldLabel('Operator')}
        <select
          className={selectClass}
          value={leaf.op}
          onChange={(event) =>
            onChange({ ...leaf, op: event.target.value as ApprovalConditionLeafInput['op'] })
          }
        >
          {approvalConditionOperators.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        {fieldLabel('Value')}
        <Input
          className="h-9 text-sm"
          placeholder="e.g. 500000 or true"
          value={typeof leaf.value === 'string' ? leaf.value : JSON.stringify(leaf.value ?? '')}
          onChange={(event) => onChange({ ...leaf, value: coerceLeafValue(event.target.value) })}
        />
      </label>
      <button
        aria-label="Remove condition"
        className="mb-0.5 rounded-full p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
        type="button"
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  )
}

/** Numbers/booleans matter for gt/lte/is_true comparisons, not just display. */
function coerceLeafValue(raw: string): unknown {
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (raw.trim() !== '' && !Number.isNaN(Number(raw))) return Number(raw)

  return raw
}

function ApproverRow({
  approver,
  onChange,
  onRemove,
}: {
  approver: ApprovalApproverRuleInput
  onChange: (next: ApprovalApproverRuleInput) => void
  onRemove: () => void
}) {
  const [configText, setConfigText] = useState(() => JSON.stringify(approver.resolverConfig))
  const [configError, setConfigError] = useState<string | null>(null)

  return (
    <div className="space-y-2 rounded-[0.6rem] border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Approver rule</span>
        <button
          aria-label="Remove approver rule"
          className="rounded-full p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
          type="button"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block space-y-1">
          {fieldLabel('Resolver type')}
          <select
            className={selectClass}
            value={approver.resolverType}
            onChange={(event) =>
              onChange({
                ...approver,
                resolverType: event.target.value as ApprovalApproverRuleInput['resolverType'],
              })
            }
          >
            {approvalResolverTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          {fieldLabel('Approver kind')}
          <Input
            className="h-9 text-sm"
            value={approver.approverKind}
            onChange={(event) => onChange({ ...approver, approverKind: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Fallback order')}
          <Input
            className="h-9 text-sm"
            min={1}
            type="number"
            value={String(approver.fallbackOrder)}
            onChange={(event) =>
              onChange({ ...approver, fallbackOrder: Number(event.target.value) || 1 })
            }
          />
        </label>
        <div className="flex items-end gap-3 pb-2 text-xs text-foreground">
          <label className="flex items-center gap-1.5">
            <input
              checked={approver.excludeInitiator}
              className="size-4"
              type="checkbox"
              onChange={(event) =>
                onChange({ ...approver, excludeInitiator: event.target.checked })
              }
            />
            Exclude initiator
          </label>
          <label className="flex items-center gap-1.5">
            <input
              checked={approver.requireRecentAuth}
              className="size-4"
              type="checkbox"
              onChange={(event) =>
                onChange({ ...approver, requireRecentAuth: event.target.checked })
              }
            />
            Recent auth
          </label>
        </div>
      </div>
      <label className="block space-y-1">
        {fieldLabel('Resolver config (JSON, e.g. {"roleCode":"SUPER_ADMIN"})')}
        <textarea
          className={cn('form-input min-h-14 resize-y font-mono text-xs', configError && 'border-danger')}
          value={configText}
          onChange={(event) => {
            setConfigText(event.target.value)
            try {
              const parsed = JSON.parse(event.target.value || '{}') as Record<string, unknown>
              setConfigError(null)
              onChange({ ...approver, resolverConfig: parsed })
            } catch {
              setConfigError('Invalid JSON — the last valid config is kept until this is fixed.')
            }
          }}
        />
        {configError ? <p className="text-[0.7rem] text-danger">{configError}</p> : null}
      </label>
    </div>
  )
}

function EscalationRow({
  escalation,
  onChange,
  onRemove,
}: {
  escalation: ApprovalEscalationRuleInput
  onChange: (next: ApprovalEscalationRuleInput) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-[0.6rem] border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Escalation rule</span>
        <button
          aria-label="Remove escalation rule"
          className="rounded-full p-1 text-muted transition hover:bg-danger/10 hover:text-danger"
          type="button"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block space-y-1">
          {fieldLabel('Trigger')}
          <Input
            className="h-9 text-sm"
            value={escalation.trigger}
            onChange={(event) => onChange({ ...escalation, trigger: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('After minutes')}
          <Input
            className="h-9 text-sm"
            min={1}
            type="number"
            value={String(escalation.afterMinutes)}
            onChange={(event) =>
              onChange({ ...escalation, afterMinutes: Number(event.target.value) || 1 })
            }
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Action')}
          <Input
            className="h-9 text-sm"
            placeholder="ESCALATE, ADD_APPROVER, REASSIGN…"
            value={escalation.action}
            onChange={(event) => onChange({ ...escalation, action: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Target resolver')}
          <select
            className={selectClass}
            value={escalation.targetResolverType ?? ''}
            onChange={(event) =>
              onChange({
                ...escalation,
                targetResolverType: (event.target.value ||
                  undefined) as ApprovalEscalationRuleInput['targetResolverType'],
              })
            }
          >
            <option value="">None</option>
            {approvalResolverTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

function StageCard({
  index,
  onChange,
  onRemove,
  stage,
}: {
  index: number
  onChange: (next: ApprovalStageInput) => void
  onRemove: () => void
  stage: ApprovalStageInput
}) {
  return (
    <div className="space-y-2.5 rounded-[0.7rem] border border-border bg-surface-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">Stage {index + 1}</span>
        <button
          aria-label={`Remove stage ${index + 1}`}
          className="rounded-full p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
          type="button"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="block space-y-1">
          {fieldLabel('Stage key')}
          <Input
            className="h-9 text-sm"
            value={stage.stageKey}
            onChange={(event) => onChange({ ...stage, stageKey: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Stage name')}
          <Input
            className="h-9 text-sm"
            value={stage.stageName}
            onChange={(event) => onChange({ ...stage, stageName: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Order')}
          <Input
            className="h-9 text-sm"
            min={1}
            type="number"
            value={String(stage.stageOrder)}
            onChange={(event) =>
              onChange({ ...stage, stageOrder: Number(event.target.value) || 1 })
            }
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Mode')}
          <select
            className={selectClass}
            value={stage.stageMode}
            onChange={(event) =>
              onChange({ ...stage, stageMode: event.target.value as ApprovalStageInput['stageMode'] })
            }
          >
            {approvalStageModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          {fieldLabel('Decision policy')}
          <select
            className={selectClass}
            value={stage.decisionPolicy}
            onChange={(event) =>
              onChange({
                ...stage,
                decisionPolicy: event.target.value as ApprovalStageInput['decisionPolicy'],
              })
            }
          >
            {approvalDecisionPolicies.map((policy) => (
              <option key={policy} value={policy}>
                {policy}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          {fieldLabel('Min approvals')}
          <Input
            className="h-9 text-sm"
            min={1}
            type="number"
            value={String(stage.minApprovals)}
            onChange={(event) =>
              onChange({ ...stage, minApprovals: Number(event.target.value) || 1 })
            }
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('SLA minutes')}
          <Input
            className="h-9 text-sm"
            min={1}
            placeholder="Optional"
            type="number"
            value={stage.slaMinutes ? String(stage.slaMinutes) : ''}
            onChange={(event) =>
              onChange({
                ...stage,
                slaMinutes: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-foreground">
          <input
            checked={stage.allowReturnForCorrection}
            className="size-4"
            type="checkbox"
            onChange={(event) =>
              onChange({ ...stage, allowReturnForCorrection: event.target.checked })
            }
          />
          Allow return for correction
        </label>
      </div>

      <div className="space-y-2 border-t border-border pt-2.5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          Approver rules
        </p>
        {stage.approverRules.map((approver, approverIndex) => (
          <ApproverRow
            approver={approver}
            key={approverIndex}
            onChange={(next) =>
              onChange({
                ...stage,
                approverRules: stage.approverRules.map((item, i) =>
                  i === approverIndex ? next : item,
                ),
              })
            }
            onRemove={() =>
              onChange({
                ...stage,
                approverRules: stage.approverRules.filter((_item, i) => i !== approverIndex),
              })
            }
          />
        ))}
        <Button
          size="xs"
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({ ...stage, approverRules: [...stage.approverRules, emptyApprover()] })
          }
        >
          <Plus className="mr-1 size-3.5" />
          Add approver rule
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-2.5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          Escalation rules
        </p>
        {stage.escalationRules.map((escalation, escalationIndex) => (
          <EscalationRow
            escalation={escalation}
            key={escalationIndex}
            onChange={(next) =>
              onChange({
                ...stage,
                escalationRules: stage.escalationRules.map((item, i) =>
                  i === escalationIndex ? next : item,
                ),
              })
            }
            onRemove={() =>
              onChange({
                ...stage,
                escalationRules: stage.escalationRules.filter((_item, i) => i !== escalationIndex),
              })
            }
          />
        ))}
        <Button
          size="xs"
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({ ...stage, escalationRules: [...stage.escalationRules, emptyEscalation()] })
          }
        >
          <Plus className="mr-1 size-3.5" />
          Add escalation rule
        </Button>
      </div>
    </div>
  )
}

function RuleCard({
  actionTemplates,
  conditionFields,
  index,
  onChange,
  onRemove,
  rule,
}: {
  actionTemplates: ApprovalActionTemplate[]
  conditionFields: ApprovalConditionField[]
  index: number
  onChange: (next: ApprovalRuleInput) => void
  onRemove: () => void
  rule: ApprovalRuleInput
}) {
  const leaves = rule.conditionJson.all

  return (
    <div className="space-y-3 rounded-[0.75rem] border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          Rule {index + 1}
          {rule.displayName ? ` · ${rule.displayName}` : ''}
        </span>
        <button
          aria-label={`Remove rule ${index + 1}`}
          className="rounded-full p-1.5 text-muted transition hover:bg-danger/10 hover:text-danger"
          type="button"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block space-y-1">
          {fieldLabel('Rule key')}
          <Input
            className="h-9 text-sm"
            value={rule.ruleKey}
            onChange={(event) => onChange({ ...rule, ruleKey: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Display name')}
          <Input
            className="h-9 text-sm"
            value={rule.displayName}
            onChange={(event) => onChange({ ...rule, displayName: event.target.value })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Priority')}
          <Input
            className="h-9 text-sm"
            min={0}
            type="number"
            value={String(rule.priority)}
            onChange={(event) => onChange({ ...rule, priority: Number(event.target.value) || 0 })}
          />
        </label>
        <label className="block space-y-1">
          {fieldLabel('Match mode')}
          <select
            className={selectClass}
            value={rule.matchMode}
            onChange={(event) =>
              onChange({ ...rule, matchMode: event.target.value as ApprovalRuleInput['matchMode'] })
            }
          >
            {approvalRuleMatchModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 block space-y-1 sm:col-span-4">
          {fieldLabel('Final action')}
          <select
            className={selectClass}
            value={rule.finalActionCode}
            onChange={(event) => onChange({ ...rule, finalActionCode: event.target.value })}
          >
            <option value="">Choose the action this rule leads to</option>
            {actionTemplates.map((template) => (
              <option key={template.actionTemplateId} value={template.actionCode}>
                {template.displayName} ({template.actionCode})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 border-t border-border pt-2.5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
          Conditions — all must match
        </p>
        {leaves.length === 0 ? (
          <p className="text-xs text-muted">
            No conditions — this rule matches every request for this trigger.
          </p>
        ) : null}
        {leaves.map((leaf, leafIndex) => (
          <LeafRow
            conditionFields={conditionFields}
            key={leafIndex}
            leaf={leaf}
            onChange={(next) =>
              onChange({
                ...rule,
                conditionJson: {
                  all: leaves.map((item, i) => (i === leafIndex ? next : item)),
                },
              })
            }
            onRemove={() =>
              onChange({
                ...rule,
                conditionJson: { all: leaves.filter((_item, i) => i !== leafIndex) },
              })
            }
          />
        ))}
        <Button
          size="xs"
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({ ...rule, conditionJson: { all: [...leaves, emptyLeaf()] } })
          }
        >
          <Plus className="mr-1 size-3.5" />
          Add condition
        </Button>
      </div>

      <div className="space-y-2.5 border-t border-border pt-2.5">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">Stages</p>
        {rule.stages.map((stage, stageIndex) => (
          <StageCard
            index={stageIndex}
            key={stageIndex}
            stage={stage}
            onChange={(next) =>
              onChange({
                ...rule,
                stages: rule.stages.map((item, i) => (i === stageIndex ? next : item)),
              })
            }
            onRemove={() =>
              onChange({ ...rule, stages: rule.stages.filter((_item, i) => i !== stageIndex) })
            }
          />
        ))}
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({ ...rule, stages: [...rule.stages, emptyStage(rule.stages.length + 1)] })
          }
        >
          <Plus className="mr-1.5 size-4" />
          Add stage
        </Button>
      </div>
    </div>
  )
}

interface WorkflowVersionEditorModalProps {
  actionTemplates: ApprovalActionTemplate[]
  conditionFields: ApprovalConditionField[]
  onClose: () => void
  onSaved: (workflow: ApprovalWorkflowDetail) => void
  version: ApprovalWorkflowVersionDetail
  workflow: ApprovalWorkflowDetail
}

/**
 * Replaces a DRAFT version's whole rule tree in one call — there is no
 * per-rule/per-stage endpoint, matching how feature flag targets are edited.
 * Only reachable for a DRAFT version; published versions are immutable and
 * get cloned into a new draft first (see WorkflowDetail's Clone action).
 */
export function WorkflowVersionEditorModal({
  actionTemplates,
  conditionFields,
  onClose,
  onSaved,
  version,
  workflow,
}: WorkflowVersionEditorModalProps) {
  const [rules, setRules] = useState<ApprovalRuleInput[]>(() => version.rules.map(toRuleInput))
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await approvalService.replaceVersionDefinition(version.versionId, {
        rules,
        reason: reason.trim(),
        expectedDefinitionHash: version.definitionHash,
      })

      return response.data
    },
    onSuccess: (data) => onSaved(data),
  })

  const errorMessage =
    saveMutation.error instanceof Error ? saveMutation.error.message : null

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
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col rounded-t-[1rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[90vh] sm:rounded-[0.875rem]">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Edit draft version</h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {workflow.displayName} · version {version.versionNumber} · saving replaces all{' '}
              {version.rules.length} rule{version.rules.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            aria-label="Close version editor"
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
            {conditionFields.length === 0 ? (
              <p className="rounded-[0.75rem] border border-warning/25 bg-warning/5 p-3 text-xs text-warning">
                No condition fields are registered for {workflow.triggerEvent} yet — a rule
                with no conditions matches every request.
              </p>
            ) : null}

            {rules.length === 0 ? (
              <p className="rounded-[0.75rem] border border-dashed border-border p-4 text-center text-sm text-muted">
                No rules yet. Add one to start routing {workflow.triggerEvent}.
              </p>
            ) : (
              rules.map((rule, ruleIndex) => (
                <RuleCard
                  actionTemplates={actionTemplates}
                  conditionFields={conditionFields}
                  index={ruleIndex}
                  key={ruleIndex}
                  rule={rule}
                  onChange={(next) =>
                    setRules((current) =>
                      current.map((item, i) => (i === ruleIndex ? next : item)),
                    )
                  }
                  onRemove={() =>
                    setRules((current) => current.filter((_item, i) => i !== ruleIndex))
                  }
                />
              ))
            )}

            <Button
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setRules((current) => [...current, emptyRule()])}
            >
              <Plus className="mr-1.5 size-4" />
              Add rule
            </Button>

            <ReasonField
              disabled={saveMutation.isPending}
              error={localError}
              minLength={3}
              value={reason}
              onChange={setReason}
            />

            {errorMessage ? (
              <div className="rounded-[0.75rem] border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border p-4">
            <span className="text-xs text-muted">
              {rules.length} rule{rules.length === 1 ? '' : 's'}
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
              <Button isLoading={saveMutation.isPending} size="sm" type="submit" variant="primary">
                Save draft
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
