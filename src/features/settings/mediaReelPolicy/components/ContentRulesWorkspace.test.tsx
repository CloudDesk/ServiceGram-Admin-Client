import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { DEFAULT_MEDIA_REEL_CONFIG } from '../types/mediaReelPolicy.types'
import { ContentRulesWorkspace } from './ContentRulesWorkspace'

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

const baseProps = {
  canReadAudit: false,
  canUpdateSettings: true,
  isError: false,
  isInitialLoading: false,
  isRefreshing: false,
  onCreate: noop,
  onEdit: noop,
  onOpenAudit: noop,
  onPreview: noop,
  onRefresh: noop,
  onToggleStatus: noop,
  rows: [] as PolicyRule[],
}

describe('ContentRulesWorkspace', () => {
  it('shows an error state with retry when the query failed', () => {
    const onRefresh = vi.fn()
    render(<ContentRulesWorkspace {...baseProps} isError onRefresh={onRefresh} />)

    expect(screen.getByText('Content rules unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('shows a loading skeleton while the initial fetch is pending', () => {
    const { container } = render(<ContentRulesWorkspace {...baseProps} isInitialLoading />)

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows an empty state with a create action when there are no rows', () => {
    render(<ContentRulesWorkspace {...baseProps} />)

    expect(screen.getByText('No content rules found')).toBeInTheDocument()
  })

  it('renders one row per content rule', () => {
    render(<ContentRulesWorkspace {...baseProps} rows={[buildRule()]} />)

    expect(screen.getByText('Default content rules')).toBeInTheDocument()
  })
})
