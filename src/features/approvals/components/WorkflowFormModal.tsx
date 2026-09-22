import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { approvalService } from '../services/approval.service'
import type { ApprovalWorkflowDetail, ApprovalWorkflowListItem } from '../types/approval.types'
import { humanizeCode } from './sharedUtils'

const CUSTOM_TRIGGER_KEY = '__custom__'

interface WorkflowFormModalProps {
  existingWorkflows: ApprovalWorkflowListItem[]
  onClose: () => void
  onCreated: (workflow: ApprovalWorkflowDetail) => void
}

function triggerKey(moduleCode: string, triggerEvent: string) {
  return `${moduleCode}::${triggerEvent}`
}

/**
 * Creates the workflow row plus an empty DRAFT v1 in one call. Rules, stages,
 * and approvers get added afterwards in the version editor — a brand-new
 * workflow has nothing to route yet.
 */
export function WorkflowFormModal({
  existingWorkflows,
  onClose,
  onCreated,
}: WorkflowFormModalProps) {
  const [workflowCode, setWorkflowCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')

  /**
   * `triggerEvent` is a join key the runtime uses to find a workflow when a
   * real event fires — those event names are hardcoded in application code
   * (payments/orders/etc.), not stored anywhere as an enum. Defaulting to a
   * known trigger avoids the silent failure mode of a typo'd or made-up
   * trigger that never matches anything at runtime.
   */
  const knownTriggers = useMemo(() => {
    const seen = new Map<
      string,
      { moduleCode: string; triggerEvent: string; isTriggerRoutable: boolean }
    >()
    for (const workflow of existingWorkflows) {
      seen.set(triggerKey(workflow.moduleCode, workflow.triggerEvent), {
        moduleCode: workflow.moduleCode,
        triggerEvent: workflow.triggerEvent,
        isTriggerRoutable: workflow.isTriggerRoutable,
      })
    }
    return [...seen.values()].sort((a, b) => triggerKey(a.moduleCode, a.triggerEvent).localeCompare(triggerKey(b.moduleCode, b.triggerEvent)))
  }, [existingWorkflows])

  const [selectedTriggerKey, setSelectedTriggerKey] = useState<string>(
    knownTriggers[0] ? triggerKey(knownTriggers[0].moduleCode, knownTriggers[0].triggerEvent) : CUSTOM_TRIGGER_KEY,
  )
  const [customModuleCode, setCustomModuleCode] = useState('')
  const [customTriggerEvent, setCustomTriggerEvent] = useState('')

  const isCustomTrigger = selectedTriggerKey === CUSTOM_TRIGGER_KEY
  const selectedKnownTrigger = knownTriggers.find(
    (trigger) => triggerKey(trigger.moduleCode, trigger.triggerEvent) === selectedTriggerKey,
  )
  const moduleCode = isCustomTrigger ? customModuleCode : (selectedKnownTrigger?.moduleCode ?? '')
  const triggerEvent = isCustomTrigger
    ? customTriggerEvent
    : (selectedKnownTrigger?.triggerEvent ?? '')

  const createMutation = useMutation({
    mutationFn: () =>
      approvalService.createWorkflow({
        workflowCode: workflowCode.trim(),
        moduleCode: moduleCode.trim(),
        triggerEvent: triggerEvent.trim(),
        displayName: displayName.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: (response) => onCreated(response.data),
  })

  const errorMessage =
    createMutation.error instanceof Error ? createMutation.error.message : null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createMutation.mutate()
  }

  return (
    <div className="premium-overlay flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-[1rem] border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:rounded-[0.875rem] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">New workflow</h2>
            <p className="mt-0.5 text-sm text-muted">
              Starts as an empty DRAFT — add rules and stages next.
            </p>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={createMutation.isPending}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-foreground">Workflow code *</span>
            <Input
              placeholder="vendor_payout.approval.phase1"
              required
              value={workflowCode}
              onChange={(event) => setWorkflowCode(event.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-foreground">Display name *</span>
            <Input
              placeholder="Vendor payout approval"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-foreground">Trigger *</span>
            <select
              className="form-select h-9 text-sm"
              value={selectedTriggerKey}
              onChange={(event) => setSelectedTriggerKey(event.target.value)}
            >
              {knownTriggers.map((trigger) => (
                <option
                  key={triggerKey(trigger.moduleCode, trigger.triggerEvent)}
                  value={triggerKey(trigger.moduleCode, trigger.triggerEvent)}
                >
                  {humanizeCode(trigger.moduleCode)} · {humanizeCode(trigger.triggerEvent)}
                  {trigger.isTriggerRoutable ? '' : ' (dormant — never fires yet)'}
                </option>
              ))}
              <option value={CUSTOM_TRIGGER_KEY}>Custom / new trigger…</option>
            </select>
            <span className="block text-[0.7rem] text-muted">
              This decides when the workflow actually fires — pick an existing trigger unless
              you're wiring up a brand-new one.
            </span>
          </label>

          {!isCustomTrigger && selectedKnownTrigger && !selectedKnownTrigger.isTriggerRoutable ? (
            <p className="rounded-[0.75rem] border border-warning/25 bg-warning/5 p-3 text-[0.7rem] text-warning">
              This trigger is configured but dormant — no context builder is wired for it in the
              backend, so a workflow here will never evaluate real events until that's built.
            </p>
          ) : null}

          {isCustomTrigger ? (
            <div className="space-y-3 rounded-[0.75rem] border border-warning/25 bg-warning/5 p-3">
              <p className="text-[0.7rem] text-warning">
                A custom trigger only fires if application code emits this exact module + event
                combination — confirm with engineering that it exists before publishing, or this
                workflow will silently never run.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-foreground">Module code *</span>
                  <Input
                    placeholder="payments"
                    required
                    value={customModuleCode}
                    onChange={(event) => setCustomModuleCode(event.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-foreground">Trigger event *</span>
                  <Input
                    placeholder="VENDOR_PAYOUT_REQUESTED"
                    required
                    value={customTriggerEvent}
                    onChange={(event) => setCustomTriggerEvent(event.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-foreground">Description</span>
            <textarea
              className="form-input min-h-16 resize-y"
              placeholder="What does this workflow route, and why?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          {errorMessage ? (
            <div className="rounded-[0.75rem] border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              disabled={createMutation.isPending}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={createMutation.isPending} size="sm" type="submit" variant="primary">
              Create workflow
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
