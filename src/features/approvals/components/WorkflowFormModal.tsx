import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { approvalService } from '../services/approval.service'
import type { ApprovalWorkflowDetail } from '../types/approval.types'

interface WorkflowFormModalProps {
  onClose: () => void
  onCreated: (workflow: ApprovalWorkflowDetail) => void
}

/**
 * Creates the workflow row plus an empty DRAFT v1 in one call. Rules, stages,
 * and approvers get added afterwards in the version editor — a brand-new
 * workflow has nothing to route yet.
 */
export function WorkflowFormModal({ onClose, onCreated }: WorkflowFormModalProps) {
  const [workflowCode, setWorkflowCode] = useState('')
  const [moduleCode, setModuleCode] = useState('')
  const [triggerEvent, setTriggerEvent] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')

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

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">Module code *</span>
              <Input
                placeholder="payments"
                required
                value={moduleCode}
                onChange={(event) => setModuleCode(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">Trigger event *</span>
              <Input
                placeholder="VENDOR_PAYOUT_REQUESTED"
                required
                value={triggerEvent}
                onChange={(event) => setTriggerEvent(event.target.value)}
              />
            </label>
          </div>

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
