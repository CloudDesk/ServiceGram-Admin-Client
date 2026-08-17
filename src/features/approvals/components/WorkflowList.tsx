import { ChevronRight, ClipboardCheck, PlayCircle, RefreshCcw } from 'lucide-react'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { cn } from '../../../utils/cn'
import type { ApprovalWorkflowListItem } from '../types/approval.types'
import { workflowStatusLabel } from '../copy'
import { WorkflowListSkeleton, humanizeCode, readErrorMessage } from './shared'
import { StateDot } from './Glyphs'

export function WorkflowList({
  canSimulate,
  error,
  hasAnyFilter,
  isError,
  isFetching,
  isLoading,
  onClearFilters,
  onRetry,
  onSelect,
  onSimulate,
  onValidate,
  selectedWorkflowId,
  totalMatching,
  workflows,
}: {
  canSimulate: boolean
  error: unknown
  hasAnyFilter: boolean
  isError: boolean
  isFetching: boolean
  isLoading: boolean
  onClearFilters: () => void
  onRetry: () => void
  onSelect: (workflowId: string) => void
  onSimulate: (workflowId: string) => void
  onValidate: (workflow: ApprovalWorkflowListItem) => void
  selectedWorkflowId: string
  totalMatching: number
  workflows: ApprovalWorkflowListItem[]
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">
          Workflows
          <span className="ml-1.5 tabular-nums text-muted">({totalMatching})</span>
        </h2>
        {isFetching && (
          <RefreshCcw aria-label="Refreshing" className="size-4 animate-spin text-muted" />
        )}
      </div>

      <div className="min-h-0 overflow-y-auto">
        {isLoading && <WorkflowListSkeleton />}

        {isError && (
          <div className="p-3">
            <ErrorState
              description={readErrorMessage(error)}
              title="Workflows could not load"
              onRetry={onRetry}
            />
          </div>
        )}

        {!isLoading && !isError && workflows.length === 0 && (
          <div className="p-3">
            <EmptyState
              actionLabel={hasAnyFilter ? 'Clear filters' : undefined}
              description="Try changing the search or filters."
              title="No workflows found"
              onAction={hasAnyFilter ? onClearFilters : undefined}
            />
          </div>
        )}

        {!isLoading &&
          workflows.map((workflow) => (
            <WorkflowRow
              canSimulate={canSimulate}
              isSelected={workflow.workflowId === selectedWorkflowId}
              key={workflow.workflowId}
              workflow={workflow}
              onSelect={() => onSelect(workflow.workflowId)}
              onSimulate={() => onSimulate(workflow.workflowId)}
              onValidate={() => onValidate(workflow)}
            />
          ))}
      </div>
    </div>
  )
}

function WorkflowRow({
  canSimulate,
  isSelected,
  onSelect,
  onSimulate,
  onValidate,
  workflow,
}: {
  canSimulate: boolean
  isSelected: boolean
  onSelect: () => void
  onSimulate: () => void
  onValidate: () => void
  workflow: ApprovalWorkflowListItem
}) {
  const hasVersion = Boolean(workflow.latestPublishedVersion)
  const canRunChecks = hasVersion && canSimulate

  return (
    /* One row, not two. The actions sit beside the label rather than on their own
       strip below it, which halved the height of every row in the list. */
    <div
      className={cn(
        'relative flex items-center border-b border-border last:border-b-0',
        isSelected
          ? 'bg-primary/6 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary'
          : 'bg-surface',
      )}
    >
      <button
        aria-pressed={isSelected}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 pr-1 text-left transition-colors hover:bg-surface-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        type="button"
        onClick={onSelect}
      >
        <StateDot status={workflow.status} />

        <span className="min-w-0 flex-1">
          {/* Wraps to two lines rather than truncating — "Vendor bank account
              verification workflow" is unreadable clipped to one line in a rail. */}
          <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {workflow.displayName}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {humanizeCode(workflow.moduleCode)} · {workflow.counts.rules}{' '}
            {workflow.counts.rules === 1 ? 'rule' : 'rules'} · {workflow.counts.stages}{' '}
            {workflow.counts.stages === 1 ? 'stage' : 'stages'}
            {workflow.latestPublishedVersion
              ? ` · v${workflow.latestPublishedVersion.versionNumber}`
              : ` · ${workflowStatusLabel(workflow.status)}`}
          </span>
        </span>

        {/* Chevron carries "this opens a detail view" on touch, where hover cannot. */}
        <ChevronRight className="size-4 shrink-0 text-muted lg:hidden" />
      </button>

      {/* Always visible, always 44px. Nothing hides behind hover. */}
      <div className="flex shrink-0 items-center pr-1.5">
        <button
          aria-label={`Check ${workflow.displayName} for problems`}
          className="btn-icon size-11 min-h-11 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canRunChecks}
          title={
            canSimulate
              ? hasVersion
                ? 'Check for problems'
                : 'No published version to check'
              : 'You do not have permission to run checks'
          }
          type="button"
          onClick={onValidate}
        >
          <ClipboardCheck className="size-4.5" />
        </button>
        <button
          aria-label={`Try ${workflow.displayName} with sample data`}
          className="btn-icon size-11 min-h-11 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canRunChecks}
          title={
            canSimulate
              ? hasVersion
                ? 'Try it with sample data'
                : 'No published version to try'
              : 'You do not have permission to run checks'
          }
          type="button"
          onClick={onSimulate}
        >
          <PlayCircle className="size-4.5" />
        </button>
      </div>
    </div>
  )
}
