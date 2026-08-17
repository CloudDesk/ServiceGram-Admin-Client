import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Route,
  TestTube2,
  XCircle,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { cn } from '../../../utils/cn'
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

export type ApprovalTab = 'flow' | 'reference' | 'simulation'

const approvalTabs: { icon: ReactNode; id: ApprovalTab; label: string }[] = [
  { icon: <Route className="size-4" />, id: 'flow', label: 'How it routes' },
  { icon: <TestTube2 className="size-4" />, id: 'simulation', label: 'Try it' },
  { icon: <ClipboardCheck className="size-4" />, id: 'reference', label: 'Reference' },
]

export function WorkflowDetail({
  actionTemplates,
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

          <Button
            className="shrink-0"
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
    </div>
  )
}
