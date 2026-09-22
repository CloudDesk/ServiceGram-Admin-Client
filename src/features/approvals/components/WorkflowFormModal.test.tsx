import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { approvalService } from '../services/approval.service'
import { ApprovalServiceError, type ApprovalWorkflowDetail } from '../types/approval.types'
import { WorkflowFormModal } from './WorkflowFormModal'

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

    renderWithProviders(<WorkflowFormModal onClose={vi.fn()} onCreated={onCreated} />)

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

    renderWithProviders(<WorkflowFormModal onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('vendor_payout.approval.phase1'), 'refund.approval.phase1')
    await user.type(screen.getByPlaceholderText('Vendor payout approval'), 'Refund approval')
    await user.type(screen.getByPlaceholderText('payments'), 'payments')
    await user.type(screen.getByPlaceholderText('VENDOR_PAYOUT_REQUESTED'), 'REFUND_REQUESTED')
    await user.click(screen.getByRole('button', { name: 'Create workflow' }))

    expect(
      await screen.findByText('A workflow with code refund.approval.phase1 already exists.'),
    ).toBeInTheDocument()
  })
})
