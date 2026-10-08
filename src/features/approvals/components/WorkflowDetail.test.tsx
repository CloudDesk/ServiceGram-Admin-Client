import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { approvalService } from '../services/approval.service'
import type {
  ApprovalWorkflowDetail,
  ApprovalWorkflowListItem,
  ApprovalWorkflowVersionDetail,
} from '../types/approval.types'
import { WorkflowDetail } from './WorkflowDetail'

function listItem(overrides: Partial<ApprovalWorkflowListItem> = {}): ApprovalWorkflowListItem {
  return {
    availableActions: [],
    blockingReasons: [],
    counts: { rules: 1, stages: 1 },
    description: '',
    displayName: 'Payout approval',
    hasDraftVersion: false,
    isTriggerRoutable: true,
    latestPublishedVersion: null,
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

function workflow(overrides: Partial<ApprovalWorkflowDetail> = {}): ApprovalWorkflowDetail {
  return {
    availableActions: [],
    blockingReasons: [],
    description: '',
    displayName: 'Payout approval',
    isTriggerRoutable: true,
    latestPublishedVersionId: 'version-uuid',
    lifecycle: { createdAt: null, updatedAt: null },
    metadata: {},
    moduleCode: 'payouts',
    nextRecommendedAction: '',
    runtimeMode: 'SIMULATION_ONLY',
    status: 'ACTIVE',
    triggerEvent: 'PAYOUT_CREATED',
    versions: [],
    warnings: [],
    workflowCode: 'payout.approval.phase1',
    workflowId: 'payout-workflow-uuid',
    ...overrides,
  }
}

function version(
  overrides: Partial<ApprovalWorkflowVersionDetail> = {},
): ApprovalWorkflowVersionDetail {
  return {
    availableActions: [],
    counts: { rules: 1, stages: 1 },
    deactivatedAt: null,
    definitionHash: 'hash',
    effectiveFrom: null,
    effectiveTo: null,
    lifecycle: { createdAt: null, updatedAt: null },
    nextRecommendedAction: '',
    publishedAt: null,
    rules: [],
    status: 'PUBLISHED',
    versionId: 'version-uuid',
    versionNumber: 1,
    ...overrides,
  }
}

function baseProps(overrides: Partial<Parameters<typeof WorkflowDetail>[0]> = {}) {
  return {
    actionTemplates: [],
    canManage: true,
    canPublish: true,
    canSimulate: true,
    conditionFields: [],
    detailError: null,
    isActionTemplatesLoading: false,
    isConditionFieldsLoading: false,
    isDetailError: false,
    isDetailLoading: false,
    onBack: vi.fn(),
    onRetryDetail: vi.fn(),
    onRunSimulation: vi.fn(),
    onTabChange: vi.fn(),
    onValidate: vi.fn(),
    onWorkflowChanged: vi.fn(),
    onWorkflowDeleted: vi.fn(),
    selectedListItem: listItem(),
    selectedTab: 'flow' as const,
    selectedVersion: version(),
    simulation: null,
    simulationError: null,
    simulationIsPending: false,
    validation: null,
    validationIsPending: false,
    workflow: workflow(),
    ...overrides,
  }
}

const setEnforcement = vi.spyOn(approvalService, 'setEnforcement')

beforeEach(() => {
  setEnforcement.mockReset()
})

describe('WorkflowDetail enforcement toggle', () => {
  it('disables the switch until a version is published', () => {
    renderWithProviders(
      <WorkflowDetail
        {...baseProps({
          selectedListItem: listItem({ runtimeMode: 'CONFIGURATION_ONLY' }),
          workflow: workflow({ runtimeMode: 'CONFIGURATION_ONLY' }),
        })}
      />,
    )

    const toggle = screen.getByRole('switch', { name: /turn enforcement on/i })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('title', expect.stringMatching(/publish a version/i))
  })

  it('shows the payout no-reject warning before turning enforcement on, without calling setEnforcement yet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WorkflowDetail {...baseProps()} />)

    await user.click(screen.getByRole('switch', { name: /turn enforcement on/i }))

    expect(
      await screen.findByText(/payouts have no automatic reject action yet/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/only affects approval instances created from now on/i),
    ).toBeInTheDocument()
    expect(setEnforcement).not.toHaveBeenCalled()
  })

  it('calls setEnforcement with the typed reason only after confirming', async () => {
    const user = userEvent.setup()
    setEnforcement.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_RUNTIME_MODE_SET',
      message: 'Enforcement updated.',
      data: workflow({ runtimeMode: 'ENFORCED' }),
    })
    const onWorkflowChanged = vi.fn()

    renderWithProviders(
      <WorkflowDetail {...baseProps({ onWorkflowChanged })} />,
    )

    await user.click(screen.getByRole('switch', { name: /turn enforcement on/i }))
    expect(setEnforcement).not.toHaveBeenCalled()

    await user.type(
      screen.getByPlaceholderText('Why is enforcement being turned on?'),
      'Finance signed off on go-live.',
    )
    await user.click(screen.getByRole('button', { name: 'Turn on' }))

    await waitFor(() =>
      expect(setEnforcement).toHaveBeenCalledWith('payout-workflow-uuid', {
        runtimeMode: 'ENFORCED',
        reason: 'Finance signed off on go-live.',
      }),
    )
    await waitFor(() =>
      expect(onWorkflowChanged).toHaveBeenCalledWith(workflow({ runtimeMode: 'ENFORCED' })),
    )
  })

  it('warns about future-only effect, not an instant flip, when turning enforcement off', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <WorkflowDetail
        {...baseProps({
          selectedListItem: listItem({ runtimeMode: 'ENFORCED' }),
          workflow: workflow({ runtimeMode: 'ENFORCED' }),
        })}
      />,
    )

    await user.click(screen.getByRole('switch', { name: /turn enforcement off/i }))

    expect(
      await screen.findByText(/future approval instances go back to observe-only/i),
    ).toBeInTheDocument()
    expect(setEnforcement).not.toHaveBeenCalled()
  })
})
