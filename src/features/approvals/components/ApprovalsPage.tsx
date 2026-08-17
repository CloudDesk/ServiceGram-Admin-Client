import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, GitBranch, Layers3, RefreshCcw } from 'lucide-react'
import { ListFilterBar, type ActiveFilterChip } from '../../../components/layout/ListFilterBar'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { approvalService } from '../services/approval.service'
import type {
  ApprovalRegistryQueryParams,
  ApprovalWorkflowDetail,
  ApprovalWorkflowListItem,
  ApprovalWorkflowStatus,
} from '../types/approval.types'
import { workflowStatusLabel } from '../copy'
import type { ApprovalTab } from './WorkflowDetail'
import {
  FilterSelect,
  formatCount,
  humanizeCode,
  readWorkflowStatus,
  sumWorkflowCounts,
  uniqueSorted,
  workflowStatuses,
} from './shared'
import { WorkflowDetail } from './WorkflowDetail'
import { WorkflowList } from './WorkflowList'

interface WorkflowFilters {
  moduleCode: string
  search: string
  status?: ApprovalWorkflowStatus
  triggerEvent: string
}

const emptyWorkflows: ApprovalWorkflowListItem[] = []

export function ApprovalsPage() {
  const canSimulate = usePermission('approvals:simulate')
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedWorkflowId = searchParams.get('workflowId') ?? ''
  const selectedTab = readTab(searchParams.get('tab'))

  const filters = useMemo<WorkflowFilters>(
    () => ({
      moduleCode: searchParams.get('moduleCode') ?? '',
      search: searchParams.get('search') ?? '',
      status: readWorkflowStatus(searchParams.get('status')),
      triggerEvent: searchParams.get('triggerEvent') ?? '',
    }),
    [searchParams],
  )

  const updateSearchParams = useCallback(
    (updates: Record<string, null | string | undefined>) => {
      const nextParams = new URLSearchParams(searchParams)
      Object.entries(updates).forEach(([key, value]) => {
        if (value) nextParams.set(key, value)
        else nextParams.delete(key)
      })
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // ─── List queries ──────────────────────────────────────────────────────────

  /**
   * One unfiltered fetch backs the filter dropdowns and the metric strip. The
   * previous version also ran a count-only query for the active total, which the
   * catalogue already contains.
   */
  const catalogQuery = useQuery({
    queryFn: () => approvalService.getWorkflows({ limit: 100, page: 1 }),
    queryKey: ['approvals', 'workflows', 'catalog'],
  })

  const workflowsQuery = useQuery({
    queryFn: () =>
      approvalService.getWorkflows({
        limit: 50,
        moduleCode: filters.moduleCode || undefined,
        page: 1,
        search: filters.search || undefined,
        status: filters.status,
        triggerEvent: filters.triggerEvent || undefined,
      }),
    queryKey: ['approvals', 'workflows', filters],
  })

  const workflows = workflowsQuery.data?.data ?? emptyWorkflows
  const catalogWorkflows = catalogQuery.data?.data ?? emptyWorkflows

  /**
   * Auto-select on desktop only. Below lg the list is the whole screen, and
   * selecting for the user would push them straight into a detail they never
   * asked for.
   */
  useEffect(() => {
    if (!workflowsQuery.isSuccess) return
    const selectedStillVisible = workflows.some((wf) => wf.workflowId === selectedWorkflowId)
    const isWide = window.matchMedia('(min-width: 1024px)').matches

    if (isWide && workflows.length > 0 && !selectedStillVisible) {
      updateSearchParams({ workflowId: workflows[0]?.workflowId })
      return
    }
    if (workflows.length === 0 && selectedWorkflowId) {
      updateSearchParams({ workflowId: null })
    }
  }, [selectedWorkflowId, updateSearchParams, workflows, workflowsQuery.isSuccess])

  // ─── Detail queries ────────────────────────────────────────────────────────

  const detailQuery = useQuery({
    enabled: Boolean(selectedWorkflowId),
    queryFn: () => approvalService.getWorkflowDetail(selectedWorkflowId),
    queryKey: ['approvals', 'workflow-detail', selectedWorkflowId],
  })

  const selectedWorkflow = detailQuery.data?.data ?? null
  const selectedVersion = useMemo(() => findSelectedVersion(selectedWorkflow), [selectedWorkflow])

  const registryParams: ApprovalRegistryQueryParams = {
    isActive: true,
    limit: 100,
    moduleCode: selectedWorkflow?.moduleCode,
    page: 1,
    triggerEvent: selectedWorkflow?.triggerEvent,
  }

  const conditionFieldsQuery = useQuery({
    enabled: Boolean(selectedWorkflow),
    queryFn: () => approvalService.getConditionFields(registryParams),
    queryKey: [
      'approvals',
      'condition-fields',
      selectedWorkflow?.moduleCode,
      selectedWorkflow?.triggerEvent,
    ],
  })

  const actionTemplatesQuery = useQuery({
    enabled: Boolean(selectedWorkflow),
    queryFn: () =>
      approvalService.getActionTemplates({
        isActive: true,
        limit: 100,
        moduleCode: selectedWorkflow?.moduleCode,
        page: 1,
      }),
    queryKey: ['approvals', 'action-templates', selectedWorkflow?.moduleCode],
  })

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const validateMutation = useMutation({
    mutationFn: (versionId: string) => approvalService.validateWorkflowVersion(versionId),
  })

  const simulateMutation = useMutation({
    mutationFn: ({ context, versionId }: { context: Record<string, unknown>; versionId: string }) =>
      approvalService.simulateWorkflowVersion(versionId, { context }),
  })

  // ─── Derived state ─────────────────────────────────────────────────────────

  const moduleOptions = useMemo(
    () => uniqueSorted(catalogWorkflows.map((wf) => wf.moduleCode)),
    [catalogWorkflows],
  )
  const triggerOptions = useMemo(
    () =>
      uniqueSorted(
        catalogWorkflows
          .filter((wf) => (filters.moduleCode ? wf.moduleCode === filters.moduleCode : true))
          .map((wf) => wf.triggerEvent),
      ),
    [catalogWorkflows, filters.moduleCode],
  )

  const totalWorkflowCount =
    catalogQuery.data?.summary.totalMatching ?? workflowsQuery.data?.summary.totalMatching ?? 0
  const activeWorkflowCount = catalogWorkflows.filter((wf) => wf.status === 'ACTIVE').length
  const configuredRuleCount = sumWorkflowCounts(catalogWorkflows, 'rules')
  const configuredStageCount = sumWorkflowCounts(catalogWorkflows, 'stages')
  const selectedListItem = workflows.find((wf) => wf.workflowId === selectedWorkflowId)

  const activeFilters = buildActiveFilterChips(filters, updateSearchParams)
  const hasAnyFilter = activeFilters.length > 0

  const clearAllFilters = () =>
    updateSearchParams({ moduleCode: null, search: null, status: null, triggerEvent: null })

  const refreshAll = () => {
    void workflowsQuery.refetch()
    void catalogQuery.refetch()
    if (selectedWorkflowId) void detailQuery.refetch()
  }

  /**
   * Below lg the two panels are one column deep, so exactly one is mounted at a
   * time — list until a workflow is picked, detail after, with a back control in
   * the detail header. At lg and up both are visible side by side.
   */
  const isDetailOpen = Boolean(selectedWorkflowId)

  return (
    <PageContainer className="flex flex-col gap-3">
      {/*
        The totals ride in the header rather than in three full-width cards.
        Four numbers do not earn a band of their own.
      */}
      <PageContextHeader
        actionNode={
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              <HeaderStat
                icon={<GitBranch className="size-3.5" />}
                label={`${formatCount(activeWorkflowCount)} live`}
                value={formatCount(totalWorkflowCount)}
              />
              <HeaderStat
                icon={<CheckCircle2 className="size-3.5" />}
                label="rules"
                value={formatCount(configuredRuleCount)}
              />
              <HeaderStat
                icon={<Layers3 className="size-3.5" />}
                label="stages"
                value={formatCount(configuredStageCount)}
              />
            </div>
            <Button size="sm" type="button" variant="secondary" onClick={refreshAll}>
              <RefreshCcw className="mr-1.5 size-4" />
              Refresh
            </Button>
          </div>
        }
        breadcrumbs={[{ href: routePaths.dashboard, label: 'Dashboard' }, { label: 'Approvals' }]}
        compact
        title="Approval workflows"
      />

      {/* Filters — collapsed on phones while a detail is open */}
      <div className={cn(isDetailOpen && 'hidden lg:block')}>
        <ListFilterBar
          activeFilters={activeFilters}
          onClearAll={hasAnyFilter ? clearAllFilters : undefined}
          primaryFilters={
            <>
              <ListHeaderSearch
                className="min-w-full sm:min-w-[17rem]"
                placeholder="Search workflow, trigger, or module"
                value={filters.search}
                onChange={(value) => updateSearchParams({ search: value || null })}
              />
              <FilterSelect
                ariaLabel="Filter by state"
                value={filters.status ?? ''}
                onChange={(value) => updateSearchParams({ status: value || null, workflowId: null })}
              >
                <option value="">Any state</option>
                {workflowStatuses.map((status) => (
                  <option key={status} value={status}>
                    {workflowStatusLabel(status)}
                  </option>
                ))}
              </FilterSelect>
            </>
          }
          secondaryFilters={
            <>
              <FilterSelect
                ariaLabel="Filter by module"
                value={filters.moduleCode}
                onChange={(value) =>
                  updateSearchParams({
                    moduleCode: value || null,
                    triggerEvent: null,
                    workflowId: null,
                  })
                }
              >
                <option value="">All modules</option>
                {moduleOptions.map((code) => (
                  <option key={code} value={code}>
                    {humanizeCode(code)}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                ariaLabel="Filter by trigger"
                value={filters.triggerEvent}
                onChange={(value) =>
                  updateSearchParams({ triggerEvent: value || null, workflowId: null })
                }
              >
                <option value="">All triggers</option>
                {triggerOptions.map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {humanizeCode(trigger)}
                  </option>
                ))}
              </FilterSelect>
            </>
          }
        />
      </div>

      <section className="grid min-h-0 items-start gap-3 lg:grid-cols-[clamp(16rem,21vw,20rem)_minmax(0,1fr)]">
        {/*
          `self-start` stops the rail stretching to the detail panel's height —
          four workflows used to leave a column of empty card below them.
          Sticky keeps it in reach while the detail scrolls.
        */}
        <Card
          className={cn(
            'overflow-hidden p-0 lg:sticky lg:top-3 lg:max-h-[calc(100vh-8rem)] lg:self-start',
            isDetailOpen && 'hidden lg:block',
          )}
        >
          <WorkflowList
            canSimulate={canSimulate}
            error={workflowsQuery.error}
            hasAnyFilter={hasAnyFilter}
            isError={workflowsQuery.isError}
            isFetching={workflowsQuery.isFetching}
            isLoading={workflowsQuery.isLoading}
            selectedWorkflowId={selectedWorkflowId}
            totalMatching={workflowsQuery.data?.summary.totalMatching ?? 0}
            workflows={workflows}
            onClearFilters={clearAllFilters}
            onRetry={() => void workflowsQuery.refetch()}
            onSelect={(workflowId) => updateSearchParams({ workflowId })}
            onSimulate={(workflowId) => updateSearchParams({ tab: 'simulation', workflowId })}
            onValidate={(workflow) => {
              const versionId = workflow.latestPublishedVersion?.versionId
              if (versionId && canSimulate) validateMutation.mutate(versionId)
            }}
          />
        </Card>

        {/* Detail: mounted only once something is selected, below lg */}
        <Card className={cn('min-h-0 overflow-hidden p-0', !isDetailOpen && 'hidden lg:block')}>
          <WorkflowDetail
            actionTemplates={actionTemplatesQuery.data?.data ?? []}
            canSimulate={canSimulate}
            conditionFields={conditionFieldsQuery.data?.data ?? []}
            detailError={detailQuery.error}
            isActionTemplatesLoading={actionTemplatesQuery.isLoading}
            isConditionFieldsLoading={conditionFieldsQuery.isLoading}
            isDetailError={detailQuery.isError}
            isDetailLoading={Boolean(selectedWorkflowId) && detailQuery.isLoading}
            selectedListItem={selectedListItem}
            selectedTab={selectedTab}
            selectedVersion={selectedVersion}
            simulation={simulateMutation.data?.data ?? null}
            simulationError={simulateMutation.error}
            simulationIsPending={simulateMutation.isPending}
            validation={validateMutation.data?.data ?? null}
            validationIsPending={validateMutation.isPending}
            workflow={selectedWorkflow}
            onBack={() => updateSearchParams({ workflowId: null })}
            onRetryDetail={() => void detailQuery.refetch()}
            onRunSimulation={(context) => {
              if (!selectedVersion || !canSimulate) return
              simulateMutation.mutate({ context, versionId: selectedVersion.versionId })
            }}
            onTabChange={(tab) => updateSearchParams({ tab })}
            onValidate={() => {
              if (!selectedVersion || !canSimulate) return
              validateMutation.mutate(selectedVersion.versionId)
            }}
          />
        </Card>
      </section>
    </PageContainer>
  )
}

// ─── Module-private helpers ───────────────────────────────────────────────────

function HeaderStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs text-muted">
      <span className="translate-y-0.5 text-muted">{icon}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
      {label}
    </span>
  )
}

function readTab(value: string | null): ApprovalTab {
  const tabs: ApprovalTab[] = ['flow', 'reference', 'simulation']
  return tabs.includes(value as ApprovalTab) ? (value as ApprovalTab) : 'flow'
}

function findSelectedVersion(workflow: ApprovalWorkflowDetail | null) {
  if (!workflow) return null
  return (
    workflow.versions.find((v) => v.versionId === workflow.latestPublishedVersionId) ??
    workflow.versions.find((v) => v.status === 'PUBLISHED') ??
    workflow.versions[0] ??
    null
  )
}

function buildActiveFilterChips(
  filters: WorkflowFilters,
  updateSearchParams: (updates: Record<string, null | string>) => void,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = []

  if (filters.search) {
    chips.push({
      key: 'search',
      label: `Search: ${filters.search}`,
      onRemove: () => updateSearchParams({ search: null }),
    })
  }
  if (filters.status) {
    chips.push({
      key: 'status',
      label: workflowStatusLabel(filters.status),
      onRemove: () => updateSearchParams({ status: null, workflowId: null }),
    })
  }
  if (filters.moduleCode) {
    chips.push({
      key: 'moduleCode',
      label: humanizeCode(filters.moduleCode),
      onRemove: () =>
        updateSearchParams({ moduleCode: null, triggerEvent: null, workflowId: null }),
    })
  }
  if (filters.triggerEvent) {
    chips.push({
      key: 'triggerEvent',
      label: humanizeCode(filters.triggerEvent),
      onRemove: () => updateSearchParams({ triggerEvent: null, workflowId: null }),
    })
  }

  return chips
}
