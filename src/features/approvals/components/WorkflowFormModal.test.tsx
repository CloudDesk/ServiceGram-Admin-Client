import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { approvalService } from '../services/approval.service'
import {
  ApprovalServiceError,
  type ApprovalWorkflowDetail,
  type ApprovalWorkflowListItem,
} from '../types/approval.types'
import { WorkflowFormModal } from './WorkflowFormModal'

function listItem(overrides: Partial<ApprovalWorkflowListItem> = {}): ApprovalWorkflowListItem {
  return {
    availableActions: [],
    blockingReasons: [],
    counts: { rules: 1, stages: 1 },
    description: '',
    displayName: 'Refund approval',
    latestPublishedVersion: null,
    lifecycle: { createdAt: null, updatedAt: null },
    metadata: {},
    moduleCode: 'orders',
    nextRecommendedAction: '',
    runtimeMode: 'CONFIGURATION_ONLY',
    status: 'ACTIVE',
    triggerEvent: 'REFUND_REQUESTED',
    warnings: [],
    workflowCode: 'refund.approval.phase1',
    workflowId: 'refund-workflow-uuid',
    ...overrides,
  }
}

function workflow(overrides: Partial<ApprovalWorkflowDetail> = {}): ApprovalWorkflowDetail {
  return {
    availableActions: [],
    blockingReasons: [],
    description: '',
    latestPublishedVersionId: null,
    lifecycle: { createdAt: null, updatedAt: null },
    metadata: {},
    moduleCode: 'payments',
    nextRecommendedAction: '',
    runtimeMode: 'CONFIGURATION_ONLY',
    status: 'DRAFT',
    displayName: 'Vendor payout approval',
    triggerEvent: 'VENDOR_PAYOUT_REQUESTED',
    versions: [],
    warnings: [],
    workflowCode: 'vendor_payout.approval.phase1',
    workflowId: 'workflow-uuid',
    ...overrides,
  }
}

const createWorkflow = vi.spyOn(approvalService, 'createWorkflow')

beforeEach(() => {
  createWorkflow.mockReset()
})

describe('WorkflowFormModal', () => {
  it('submits trimmed field values and reports the created workflow', async () => {
    const user = userEvent.setup()
    createWorkflow.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_CREATED',
      message: 'Approval workflow created successfully.',
      data: workflow(),
    })
    const onCreated = vi.fn()

    renderWithProviders(
      <WorkflowFormModal existingWorkflows={[]} onClose={vi.fn()} onCreated={onCreated} />,
    )

    await user.type(screen.getByPlaceholderText('vendor_payout.approval.phase1'), '  vendor_payout.approval.phase1  ')
    await user.type(screen.getByPlaceholderText('Vendor payout approval'), '  Vendor payout approval  ')
    await user.type(screen.getByPlaceholderText('payments'), '  payments  ')
    await user.type(screen.getByPlaceholderText('VENDOR_PAYOUT_REQUESTED'), '  VENDOR_PAYOUT_REQUESTED  ')
    await user.click(screen.getByRole('button', { name: 'Create workflow' }))

    await waitFor(() => expect(createWorkflow).toHaveBeenCalledWith({
      workflowCode: 'vendor_payout.approval.phase1',
      moduleCode: 'payments',
      triggerEvent: 'VENDOR_PAYOUT_REQUESTED',
      displayName: 'Vendor payout approval',
      description: undefined,
    }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(workflow()))
  })

  it('shows the backend error when the workflow code is already taken', async () => {
    const user = userEvent.setup()
    createWorkflow.mockRejectedValue(
      new ApprovalServiceError(
        'A workflow with code refund.approval.phase1 already exists.',
        409,
        'APPROVAL_WORKFLOW_CODE_TAKEN',
        null,
      ),
    )

    renderWithProviders(
      <WorkflowFormModal existingWorkflows={[]} onClose={vi.fn()} onCreated={vi.fn()} />,
    )

    await user.type(screen.getByPlaceholderText('vendor_payout.approval.phase1'), 'refund.approval.phase1')
    await user.type(screen.getByPlaceholderText('Vendor payout approval'), 'Refund approval')
    await user.type(screen.getByPlaceholderText('payments'), 'payments')
    await user.type(screen.getByPlaceholderText('VENDOR_PAYOUT_REQUESTED'), 'REFUND_REQUESTED')
    await user.click(screen.getByRole('button', { name: 'Create workflow' }))

    expect(
      await screen.findByText('A workflow with code refund.approval.phase1 already exists.'),
    ).toBeInTheDocument()
  })

  it('defaults to an existing trigger and only reveals free-text fields for a custom one', async () => {
    const user = userEvent.setup()
    createWorkflow.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_CREATED',
      message: 'Approval workflow created successfully.',
      data: workflow(),
    })

    renderWithProviders(
      <WorkflowFormModal existingWorkflows={[listItem()]} onClose={vi.fn()} onCreated={vi.fn()} />,
    )

    expect(screen.queryByPlaceholderText('payments')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('vendor_payout.approval.phase1'), 'a.new.workflow')
    await user.type(screen.getByPlaceholderText('Vendor payout approval'), 'A new workflow')
    await user.click(screen.getByRole('button', { name: 'Create workflow' }))

    await waitFor(() =>
      expect(createWorkflow).toHaveBeenCalledWith({
        workflowCode: 'a.new.workflow',
        moduleCode: 'orders',
        triggerEvent: 'REFUND_REQUESTED',
        displayName: 'A new workflow',
        description: undefined,
      }),
    )
  })

  it('reveals module/trigger inputs when "Custom / new trigger…" is selected', async () => {
    const user = userEvent.setup()
    createWorkflow.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_CREATED',
      message: 'Approval workflow created successfully.',
      data: workflow(),
    })

    renderWithProviders(
      <WorkflowFormModal existingWorkflows={[listItem()]} onClose={vi.fn()} onCreated={vi.fn()} />,
    )

    await user.selectOptions(screen.getByRole('combobox'), 'Custom / new trigger…')

    expect(screen.getByPlaceholderText('payments')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('vendor_payout.approval.phase1'), 'a.new.workflow')
    await user.type(screen.getByPlaceholderText('Vendor payout approval'), 'A new workflow')
    await user.type(screen.getByPlaceholderText('payments'), 'payments')
    await user.type(screen.getByPlaceholderText('VENDOR_PAYOUT_REQUESTED'), 'VENDOR_PAYOUT_REQUESTED')
    await user.click(screen.getByRole('button', { name: 'Create workflow' }))

    await waitFor(() =>
      expect(createWorkflow).toHaveBeenCalledWith({
        workflowCode: 'a.new.workflow',
        moduleCode: 'payments',
        triggerEvent: 'VENDOR_PAYOUT_REQUESTED',
        displayName: 'A new workflow',
        description: undefined,
      }),
    )
  })
})
