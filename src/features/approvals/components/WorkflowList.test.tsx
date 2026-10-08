import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { ApprovalWorkflowListItem } from '../types/approval.types'
import { WorkflowList } from './WorkflowList'

function listItem(overrides: Partial<ApprovalWorkflowListItem> = {}): ApprovalWorkflowListItem {
  return {
    availableActions: [],
    blockingReasons: [],
    counts: { rules: 2, stages: 3 },
    description: '',
    displayName: 'Payout approval workflow',
    hasDraftVersion: false,
    isTriggerRoutable: true,
    latestPublishedVersion: {
      versionId: 'version-uuid',
      versionNumber: 2,
      status: 'PUBLISHED',
      definitionHash: 'hash',
      effectiveFrom: null,
      effectiveTo: null,
      publishedAt: null,
      deactivatedAt: null,
      lifecycle: { createdAt: null, updatedAt: null },
    },
    lifecycle: { createdAt: null, updatedAt: null },
    metadata: {},
    moduleCode: 'payouts',
    nextRecommendedAction: '',
    runtimeMode: 'SIMULATION_ONLY',
    status: 'ACTIVE',
    triggerEvent: 'PAYOUT_CREATED',
    warnings: [],
    workflowCode: 'payout.approval.phase1',
    workflowId: 'payout-workflow-uuid',
    ...overrides,
  }
}

function baseProps(workflows: ApprovalWorkflowListItem[]) {
  return {
    canSimulate: true,
    error: null,
    hasAnyFilter: false,
    isError: false,
    isFetching: false,
    isLoading: false,
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onSimulate: vi.fn(),
    onValidate: vi.fn(),
    selectedWorkflowId: '',
    totalMatching: workflows.length,
    workflows,
  }
}

describe('WorkflowList "Draft pending" chip (F-06)', () => {
  it('shows the chip for a live workflow with an unpublished draft version', () => {
    renderWithProviders(
      <WorkflowList {...baseProps([listItem({ hasDraftVersion: true, status: 'ACTIVE' })])} />,
    )

    expect(screen.getByText('Draft pending')).toBeInTheDocument()
  })

  it('hides the chip when there is no unpublished draft version', () => {
    renderWithProviders(
      <WorkflowList {...baseProps([listItem({ hasDraftVersion: false, status: 'ACTIVE' })])} />,
    )

    expect(screen.queryByText('Draft pending')).not.toBeInTheDocument()
  })

  it('hides the chip for a workflow whose own status is already Draft, to avoid duplicating the state dot', () => {
    renderWithProviders(
      <WorkflowList {...baseProps([listItem({ hasDraftVersion: true, status: 'DRAFT' })])} />,
    )

    expect(screen.queryByText('Draft pending')).not.toBeInTheDocument()
  })
})
