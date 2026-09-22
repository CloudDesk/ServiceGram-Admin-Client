import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Info,
  Pencil,
  PowerOff,
  Route,
  Rocket,
  TestTube2,
  XCircle,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { ReasonModal } from '../../../components/ui/ReasonModal/ReasonModal'
import { cn } from '../../../utils/cn'
import { approvalService } from '../services/approval.service'
import type {
  ApprovalActionTemplate,
  ApprovalConditionField,
  ApprovalSimulationData,
  ApprovalValidationData,
  ApprovalWorkflowDetail,
  ApprovalWorkflowListItem,
  ApprovalWorkflowVersionDetail,
} from '../types/approval.types'
import { runtimeNotice, versionStatusLabel } from '../copy'
import { DetailSkeleton, IssueList, formatDateTime, readErrorMessage } from './shared'
import { FlowTab } from './FlowTab'
import { RegistryTab } from './RegistryTab'
import { SimulationTab } from './SimulationTab'
import { StateDot } from './Glyphs'
import { WorkflowVersionEditorModal } from './WorkflowVersionEditorModal'

export type ApprovalTab = 'flow' | 'reference' | 'simulation'

const approvalTabs: { icon: ReactNode; id: ApprovalTab; label: string }[] = [
  { icon: <Route className="size-4" />, id: 'flow', label: 'How it routes' },
  { icon: <TestTube2 className="size-4" />, id: 'simulation', label: 'Try it' },
  { icon: <ClipboardCheck className="size-4" />, id: 'reference', label: 'Reference' },
]

export function WorkflowDetail({
  actionTemplates,
  canManage,
  canPublish,
  canSimulate,
  conditionFields,
  detailError,
  isActionTemplatesLoading,
  isConditionFieldsLoading,
  isDetailError,
  isDetailLoading,
  onBack,
  onRetryDetail,
  onRunSimulation,
  onTabChange,
  onValidate,
  onWorkflowChanged,
  selectedListItem,
  selectedTab,
  selectedVersion,
  simulation,
  simulationError,
  simulationIsPending,
  validation,
  validationIsPending,
  workflow,
}: {
  actionTemplates: ApprovalActionTemplate[]
  canManage: boolean
  canPublish: boolean
  canSimulate: boolean
  conditionFields: ApprovalConditionField[]
  detailError: unknown
  isActionTemplatesLoading: boolean
  isConditionFieldsLoading: boolean
  isDetailError: boolean
  isDetailLoading: boolean
  onBack: () => void
  onRetryDetail: () => void
  onRunSimulation: (context: Record<string, unknown>) => void
  onTabChange: (tab: ApprovalTab) => void
  onValidate: () => void
  onWorkflowChanged: (workflow: ApprovalWorkflowDetail) => void
  selectedListItem?: ApprovalWorkflowListItem
  selectedTab: ApprovalTab
  selectedVersion: ApprovalWorkflowVersionDetail | null
  simulation: ApprovalSimulationData | null
  simulationError: unknown
  simulationIsPending: boolean
  validation: ApprovalValidationData | null
  validationIsPending: boolean
  workflow: ApprovalWorkflowDetail | null
}) {
  const [openModal, setOpenModal] = useState<'edit' | 'publish' | 'deactivate' | null>(null)

  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!workflow || !selectedVersion) throw new Error('Nothing to clone.')
      const response = await approvalService.createDraftVersion(workflow.workflowId, {
        cloneFromVersionId: selectedVersion.versionId,
      })
      return response.data
    },
    onSuccess: (updated) => onWorkflowChanged(updated),
  })

  const publishMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!selectedVersion) throw new Error('No version selected.')
      const response = await approvalService.publishVersion(selectedVersion.versionId, { reason })
      return response.data
    },
    onSuccess: (updated) => {
      setOpenModal(null)
      onWorkflowChanged(updated)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!selectedVersion) throw new Error('No version selected.')
      const response = await approvalService.deactivateVersion(selectedVersion.versionId, {
        reason,
      })
      return response.data
    },
    onSuccess: (updated) => {
      setOpenModal(null)
      onWorkflowChanged(updated)
    },
  })
  if (!selectedListItem && !isDetailLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          description="Choose a workflow to see how it routes, who approves, and what happens at the end."
          title="Select a workflow"
        />
      </div>
    )
  }

  if (isDetailLoading) return <DetailSkeleton />

  if (isDetailError) {
    return (
      <div className="p-4">
        <ErrorState
          description={readErrorMessage(detailError)}
          title="Workflow detail could not load"
          onRetry={onRetryDetail}
        />
      </div>
    )
  }

  if (!workflow || !selectedVersion) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          description="This workflow needs a published version before it can be checked or tried."
          title="No published version"
        />
      </div>
    )
  }

  // Results belong to whichever workflow was checked; drop them when the selection moves.
  const currentValidation =
    validation?.workflow.workflowId === workflow.workflowId ? validation : null
  const currentSimulation =
    simulation?.workflow.workflowId === workflow.workflowId ? simulation : null

  return (
    <div className="flex min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-start gap-2.5">
          {/* Back to the list — the only way out of detail below lg */}
          <button
            aria-label="Back to workflows"
            className="btn-icon size-11 min-h-11 shrink-0 lg:hidden"
            type="button"
            onClick={onBack}
          >
            <ArrowLeft className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StateDot status={workflow.status} />
              <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                {workflow.displayName}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              Version {selectedVersion.versionNumber} ·{' '}
              {versionStatusLabel(selectedVersion.status)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Button
              disabled={!canSimulate}
              isLoading={validationIsPending}
              size="sm"
              title={canSimulate ? undefined : 'You do not have permission to run checks'}
              type="button"
              variant="secondary"
              onClick={onValidate}
            >
              <ClipboardCheck className="mr-1.5 size-4" />
              Check
            </Button>

            {canManage && selectedVersion.status === 'DRAFT' ? (
              <Button size="sm" type="button" variant="secondary" onClick={() => setOpenModal('edit')}>
                <Pencil className="mr-1.5 size-4" />
                Edit draft
              </Button>
            ) : null}

            {canManage && selectedVersion.status !== 'DRAFT' ? (
              <Button
                isLoading={cloneMutation.isPending}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => cloneMutation.mutate()}
              >
                <Copy className="mr-1.5 size-4" />
                Clone to draft
              </Button>
            ) : null}

            {canPublish && selectedVersion.status === 'DRAFT' ? (
              <Button size="sm" type="button" variant="primary" onClick={() => setOpenModal('publish')}>
                <Rocket className="mr-1.5 size-4" />
                Publish
              </Button>
            ) : null}

            {canPublish && selectedVersion.status === 'PUBLISHED' ? (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setOpenModal('deactivate')}
              >
                <PowerOff className="mr-1.5 size-4" />
                Deactivate
              </Button>
            ) : null}
          </div>
        </div>

        {/*
          Runtime state as one compact line with the detail on hover, rather than
          a full-width paragraph band repeated on every workflow.
        */}
        <p
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-warning"
          title={runtimeNotice}
        >
          <Info className="size-3.5 shrink-0" />
          Not enforced yet — configuration only
        </p>

        {currentValidation && (
          <div
            className={cn(
              'mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border px-3 py-2',
              currentValidation.valid
                ? 'border-success/30 bg-success/5'
                : 'border-danger/30 bg-danger/5',
            )}
          >
            {currentValidation.valid ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <XCircle className="size-4 shrink-0 text-danger" />
            )}
            <p className="text-sm font-semibold text-foreground">
              {currentValidation.valid
                ? 'No problems found'
                : `${currentValidation.errors.length} ${currentValidation.errors.length === 1 ? 'problem' : 'problems'} to fix`}
            </p>
            <span className="ml-auto text-xs text-muted">
              Checked {formatDateTime(currentValidation.checkedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-3 pt-2">
        <div aria-label="Workflow sections" className="flex gap-1 overflow-x-auto" role="tablist">
          {approvalTabs.map((tab) => {
            const isSelected = tab.id === selectedTab
            return (
              <button
                aria-selected={isSelected}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-control px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'bg-surface-muted text-foreground'
                    : 'text-muted hover:bg-surface-muted/50 hover:text-foreground',
                )}
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* The check's findings, listed — not just counted */}
        {currentValidation && currentValidation.errors.length > 0 && (
          <div className="mb-3">
            <IssueList issues={currentValidation.errors} title="Problems to fix" />
          </div>
        )}
        {currentValidation && currentValidation.warnings.length > 0 && (
          <div className="mb-3">
            <IssueList issues={currentValidation.warnings} title="Worth knowing" />
          </div>
        )}

        {selectedTab === 'flow' && (
          <FlowTab
            actionTemplates={actionTemplates}
            conditionFields={conditionFields}
            selectedVersion={selectedVersion}
            workflow={workflow}
          />
        )}
        {selectedTab === 'simulation' && (
          <SimulationTab
            canSimulate={canSimulate}
            conditionFields={conditionFields}
            error={simulationError}
            isPending={simulationIsPending}
            result={currentSimulation}
            workflow={workflow}
            onRunSimulation={onRunSimulation}
          />
        )}
        {selectedTab === 'reference' && (
          <RegistryTab
            actionTemplates={actionTemplates}
            conditionFields={conditionFields}
            isActionTemplatesLoading={isActionTemplatesLoading}
            isConditionFieldsLoading={isConditionFieldsLoading}
          />
        )}
      </div>

      {openModal === 'edit' ? (
        <WorkflowVersionEditorModal
          actionTemplates={actionTemplates}
          conditionFields={conditionFields}
          version={selectedVersion}
          workflow={workflow}
          onClose={() => setOpenModal(null)}
          onSaved={(updated) => {
            setOpenModal(null)
            onWorkflowChanged(updated)
          }}
        />
      ) : null}

      {openModal === 'publish' ? (
        <ReasonModal
          confirmLabel="Publish"
          error={publishMutation.error}
          isSubmitting={publishMutation.isPending}
          reasonPlaceholder="Why is this version going live?"
          subtitle={`${workflow.displayName} · version ${selectedVersion.versionNumber}`}
          title="Publish this version?"
          warnings={[
            'Deactivates the workflow’s currently published version, if any.',
            'Once published, this version becomes immutable — further edits go through a new draft.',
          ]}
          onClose={() => setOpenModal(null)}
          onSubmit={(reason) => publishMutation.mutate(reason)}
        />
      ) : null}

      {openModal === 'deactivate' ? (
        <ReasonModal
          confirmLabel="Deactivate"
          error={deactivateMutation.error}
          isDestructive
          isSubmitting={deactivateMutation.isPending}
          reasonPlaceholder="Why is this version being taken offline?"
          subtitle={`${workflow.displayName} · version ${selectedVersion.versionNumber}`}
          title="Deactivate this version?"
          warnings={['New requests stop routing through it. Approvals already in flight are unaffected.']}
          onClose={() => setOpenModal(null)}
          onSubmit={(reason) => deactivateMutation.mutate(reason)}
        />
      ) : null}
    </div>
  )
}
