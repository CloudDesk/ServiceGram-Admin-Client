import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { DEFAULT_MEDIA_REEL_CONFIG } from '../types/mediaReelPolicy.types'
import { ContentRulesWorkspace, type ContentRulesWorkspaceProps } from './ContentRulesWorkspace'

function buildRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    policyRuleId: 'rule-1',
    family: 'MEDIA_REEL_RULE',
    ruleKey: 'media.reels.global.global',
    displayName: 'Default content rules',
    description: null,
    status: 'ACTIVE',
    priority: 100,
    scope: { scopeType: 'GLOBAL', categoryId: null, city: null, zoneId: null, vendorId: null },
    config: DEFAULT_MEDIA_REEL_CONFIG as unknown as Record<string, unknown>,
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

function renderWorkspace(overrides: Partial<ContentRulesWorkspaceProps> = {}) {
  const props: ContentRulesWorkspaceProps = {
    rows: [],
    canReadAudit: false,
    canUpdateSettings: true,
    isError: false,
    isLoading: false,
    onRetry: noop,
    search: '',
    onSearchChange: noop,
    queueTabs: [],
    activeQueue: 'mediaPolicies',
    onQueueChange: noop,
    policyStatus: '',
    policyScopeType: '',
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
    onEdit: noop,
    onOpenAudit: noop,
    onToggleStatus: noop,
    ...overrides,
  }

  return render(<ContentRulesWorkspace {...props} />)
}

describe('ContentRulesWorkspace', () => {
  it('shows an error state with retry when the query failed', () => {
    const onRetry = vi.fn()
    renderWorkspace({ isError: true, onRetry })

    expect(screen.getByText('We could not load content rules.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows a loading skeleton while the initial fetch is pending', () => {
    const { container } = renderWorkspace({ isLoading: true })

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows an empty state when there are no rows', () => {
    renderWorkspace()

    expect(screen.getByText('No content rules found')).toBeInTheDocument()
  })

  it('renders the rule name, status badge, and applied-first badge', () => {
    renderWorkspace({ rows: [buildRule()] })

    expect(screen.getByText('Default content rules')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('Applied first')).toBeInTheDocument()
    expect(screen.getByText('1–60 sec · Up to 100 MB')).toBeInTheDocument()
    expect(screen.getByText('Order 100')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Density' })).not.toBeInTheDocument()
  })

  it('opens the preview when a row is clicked', () => {
    const onPreview = vi.fn()
    const rule = buildRule()
    renderWorkspace({ rows: [rule], onPreview })

    fireEvent.click(screen.getByText('Default content rules'))

    expect(onPreview).toHaveBeenCalledWith(rule)
  })

  it('hides the Edit pill when settings:update is missing', () => {
    renderWorkspace({ rows: [buildRule()], canUpdateSettings: false })

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('disables the toolbar Create button and explains why when settings:update is missing', () => {
    renderWorkspace({ canUpdateSettings: false })

    const createButton = screen.getByRole('button', { name: /Content rule/ })
    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('title', 'Requires settings:update')
  })
})
