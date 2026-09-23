import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { PolicyRulesWorkspace, type PolicyRulesWorkspaceProps } from './PolicyRulesWorkspace'

function buildRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    policyRuleId: 'rule-1',
    family: 'PRICING_RULE',
    ruleKey: 'pricing.global.phase1',
    displayName: 'Phase 1 global pricing',
    description: null,
    status: 'ACTIVE',
    priority: 100,
    scope: { scopeType: 'GLOBAL', categoryId: null, city: null, zoneId: null, vendorId: null },
    config: {},
    metadata: {},
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    availableActions: ['EDIT', 'ARCHIVE'],
    ...overrides,
  }
}

const noop = () => undefined

function renderWorkspace(overrides: Partial<PolicyRulesWorkspaceProps> = {}) {
  const props: PolicyRulesWorkspaceProps = {
    rows: [],
    canReadAudit: false,
    canReadVendors: false,
    canUpdateSettings: true,
    isError: false,
    isLoading: false,
    onRetry: noop,
    search: '',
    onSearchChange: noop,
    queueTabs: [],
    activeQueue: 'policies',
    onQueueChange: noop,
    policyFamily: '',
    policyStatus: '',
    policyScopeType: '',
    onPolicyFamilyChange: noop,
    onPolicyStatusChange: noop,
    onPolicyScopeTypeChange: noop,
    appliedFilterCount: 0,
    onResetFilters: noop,
    page: 1,
    limit: 10,
    onPageChange: noop,
    onPageSizeChange: noop,
    onPreview: noop,
    onCreate: noop,
    onPreviewPricing: noop,
    onSelectAction: noop,
    onOpenAudit: noop,
    onOpenCategory: noop,
    onOpenZone: noop,
    onOpenVendor: noop,
    ...overrides,
  }

  return render(<PolicyRulesWorkspace {...props} />)
}

describe('PolicyRulesWorkspace', () => {
  it('shows an empty state when there are no rows', () => {
    renderWorkspace()

    expect(screen.getByText('No policy rules found')).toBeInTheDocument()
  })

  it('renders a concise rule summary, status, scope order, and schedule', () => {
    renderWorkspace({ rows: [buildRule()] })

    expect(screen.getByText('Phase 1 global pricing')).toBeInTheDocument()
    expect(screen.getByText('Pricing Rule · v1')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getAllByText('Global').length).toBeGreaterThan(0)
    expect(screen.getByText('Global · Order 100')).toBeInTheDocument()
    expect(screen.getByText(/Starts 1 Jan 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Density' })).not.toBeInTheDocument()
  })

  it('opens the preview when a row is clicked', () => {
    const onPreview = vi.fn()
    const rule = buildRule()
    renderWorkspace({ rows: [rule], onPreview })

    fireEvent.click(screen.getByText('Phase 1 global pricing'))

    expect(onPreview).toHaveBeenCalledWith(rule)
  })

  it('hides the Edit pill when settings:update is missing', () => {
    renderWorkspace({ rows: [buildRule()], canUpdateSettings: false })

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('shows Activate/Archive and Audit only in the overflow menu when allowed', () => {
    const onSelectAction = vi.fn()
    const rule = buildRule({ status: 'ACTIVE', availableActions: ['EDIT', 'ARCHIVE'] })
    renderWorkspace({ rows: [rule], canReadAudit: true, onSelectAction })

    fireEvent.click(screen.getByRole('button', { name: /More actions for Phase 1 global pricing/ }))

    expect(screen.getByRole('menuitem', { name: /Archive rule/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Audit history/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: /Archive rule/ }))
    expect(onSelectAction).toHaveBeenCalledWith({ action: 'ARCHIVE', record: rule })
  })

  it('disables the toolbar Create button and explains why when settings:update is missing', () => {
    renderWorkspace({ canUpdateSettings: false })

    const createButton = screen.getByRole('button', { name: /Policy rule/ })
    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('title', 'Requires settings:update')
  })
})
