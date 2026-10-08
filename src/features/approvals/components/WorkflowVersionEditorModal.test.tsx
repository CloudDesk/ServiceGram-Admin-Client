import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { approvalService } from '../services/approval.service'
import type {
  ApprovalActionTemplate,
  ApprovalConditionField,
  ApprovalRule,
  ApprovalWorkflowDetail,
  ApprovalWorkflowVersionDetail,
} from '../types/approval.types'
import { WorkflowVersionEditorModal } from './WorkflowVersionEditorModal'

const workflow: ApprovalWorkflowDetail = {
  availableActions: [],
  blockingReasons: [],
  description: '',
  isTriggerRoutable: false,
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

  it('loads an any-group rule as ANY with its real conditions, not as empty', async () => {
    const anyRule: ApprovalRule = {
      ruleId: 'rule-uuid',
      ruleKey: 'payout.finance.high_value_or_hold',
      displayName: 'High-value or hold payout review',
      description: '',
      priority: 100,
      matchMode: 'FIRST_MATCH',
      conditionJson: {
        any: [
          { field: 'payout.totalAmountPaise', op: 'gt', value: 2500000 },
          { field: 'payout.hasHold', op: 'is_true' },
        ],
      },
      finalActionCode: 'PAYOUT_APPROVE',
      autoDecision: null,
      metadata: {},
      stages: [],
    }
    const version: ApprovalWorkflowVersionDetail = {
      ...draftVersion,
      rules: [anyRule],
      counts: { rules: 1, stages: 0 },
    }

    renderWithProviders(
      <WorkflowVersionEditorModal
        actionTemplates={actionTemplates}
        conditionFields={conditionFields}
        version={version}
        workflow={workflow}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByText(/conditions — any one must match/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /combine conditions/i })).toHaveValue('any')
    expect(
      screen.queryByText('No conditions — this rule matches every request for this trigger.'),
    ).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Field')).toHaveLength(2)
  })

  it('switching the combinator to ANY and saving sends an any-group, not an all-group', async () => {
    const user = userEvent.setup()
    replaceVersionDefinition.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_VERSION_DEFINITION_REPLACED',
      message: 'Approval workflow version definition saved successfully.',
      data: workflow,
    })

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
    await user.click(screen.getByRole('button', { name: /add condition/i }))
    await user.selectOptions(screen.getByRole('combobox', { name: /combine conditions/i }), 'any')
    await user.type(
      screen.getByPlaceholderText('Why is this change being made?'),
      'Switching to any-of-these.',
    )
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(replaceVersionDefinition).toHaveBeenCalledWith(
        'version-uuid',
        expect.objectContaining({
          rules: [
            expect.objectContaining({
              conditionJson: { any: [{ field: '', op: 'eq', value: '' }] },
            }),
          ],
        }),
      ),
    )
  })

  it('renders an unsupported condition shape read-only and round-trips it unchanged on save', async () => {
    const user = userEvent.setup()
    replaceVersionDefinition.mockResolvedValue({
      code: 'ADMIN_APPROVAL_WORKFLOW_VERSION_DEFINITION_REPLACED',
      message: 'Approval workflow version definition saved successfully.',
      data: workflow,
    })
    const unsupportedConditionJson = {
      not: { field: 'vendor.bankAccountStatus', op: 'eq', value: 'VERIFIED' },
    }
    const notRule: ApprovalRule = {
      ruleId: 'rule-uuid',
      ruleKey: 'not.example',
      displayName: 'Not example',
      description: '',
      priority: 100,
      matchMode: 'FIRST_MATCH',
      conditionJson: unsupportedConditionJson,
      finalActionCode: 'PAYOUT_APPROVE',
      autoDecision: null,
      metadata: {},
      stages: [],
    }
    const version: ApprovalWorkflowVersionDetail = {
      ...draftVersion,
      rules: [notRule],
      counts: { rules: 1, stages: 0 },
    }

    renderWithProviders(
      <WorkflowVersionEditorModal
        actionTemplates={actionTemplates}
        conditionFields={conditionFields}
        version={version}
        workflow={workflow}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByText(/doesn't support yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /combine conditions/i })).not.toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText('Why is this change being made?'),
      'Unrelated change, should not touch this rule.',
    )
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(replaceVersionDefinition).toHaveBeenCalledWith(
        'version-uuid',
        expect.objectContaining({
          rules: [expect.objectContaining({ conditionJson: unsupportedConditionJson })],
        }),
      ),
    )
  })
})
