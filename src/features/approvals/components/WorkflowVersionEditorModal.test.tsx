import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { approvalService } from '../services/approval.service'
import type {
  ApprovalActionTemplate,
  ApprovalConditionField,
  ApprovalWorkflowDetail,
  ApprovalWorkflowVersionDetail,
} from '../types/approval.types'
import { WorkflowVersionEditorModal } from './WorkflowVersionEditorModal'

const workflow: ApprovalWorkflowDetail = {
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
}

const draftVersion: ApprovalWorkflowVersionDetail = {
  availableActions: [],
  counts: { rules: 0, stages: 0 },
  definitionHash: 'hash-1',
  deactivatedAt: null,
  effectiveFrom: null,
  effectiveTo: null,
  lifecycle: { createdAt: null, updatedAt: null },
  nextRecommendedAction: '',
  publishedAt: null,
  rules: [],
  status: 'DRAFT',
  versionId: 'version-uuid',
  versionNumber: 1,
}

const conditionFields: ApprovalConditionField[] = []
const actionTemplates: ApprovalActionTemplate[] = [
  {
    actionTemplateId: 'action-uuid',
    actionCode: 'REFUND_APPROVE',
    moduleCode: 'payments',
    entityType: 'refund',
    displayName: 'Approve refund',
    description: '',
    serviceAdapterKey: 'payments.approveRefund',
    requiredPermissionCode: 'payments:refund',
    riskLevel: 'HIGH',
    finalState: 'APPROVED',
    isActive: true,
    metadata: {},
    availableActions: [],
  },
]

const replaceVersionDefinition = vi.spyOn(approvalService, 'replaceVersionDefinition')

beforeEach(() => {
  replaceVersionDefinition.mockReset()
})

describe('WorkflowVersionEditorModal', () => {
  it('requires a reason before saving', async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <WorkflowVersionEditorModal
        actionTemplates={actionTemplates}
        conditionFields={conditionFields}
        version={draftVersion}
        workflow={workflow}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /add rule/i }))
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Reason must be at least 3 characters.')).toBeInTheDocument()
    expect(replaceVersionDefinition).not.toHaveBeenCalled()
  })

  it('saves the whole rule tree with the expected definition hash', async () => {
    const user = userEvent.setup()
    replaceVersionDefinition.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_VERSION_DEFINITION_REPLACED',
      message: 'Approval workflow version definition saved successfully.',
      data: workflow,
    })
    const onSaved = vi.fn()

    renderWithProviders(
      <WorkflowVersionEditorModal
        actionTemplates={actionTemplates}
        conditionFields={conditionFields}
        version={draftVersion}
        workflow={workflow}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    )

    await user.click(screen.getByRole('button', { name: /add rule/i }))
    await user.type(
      screen.getByPlaceholderText('Why is this change being made?'),
      'Adding the first rule.',
    )
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(replaceVersionDefinition).toHaveBeenCalledWith('version-uuid', {
        rules: [
          expect.objectContaining({
            ruleKey: '',
            priority: 100,
            matchMode: 'FIRST_MATCH',
            conditionJson: { all: [] },
            stages: [],
          }),
        ],
        reason: 'Adding the first rule.',
        expectedDefinitionHash: 'hash-1',
      }),
    )
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(workflow))
  })
})
