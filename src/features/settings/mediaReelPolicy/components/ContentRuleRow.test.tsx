import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { DEFAULT_MEDIA_REEL_CONFIG } from '../types/mediaReelPolicy.types'
import { ContentRuleRow } from './ContentRuleRow'

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

describe('ContentRuleRow', () => {
  it('shows the status badge and the applied-first badge for the lowest-priority active rule', () => {
    const rule = buildRule()
    render(
      <ContentRuleRow
        allRules={[rule]}
        canReadAudit={false}
        canUpdateSettings
        isPreviewed={false}
        rule={rule}
        onEdit={noop}
        onOpenAudit={noop}
        onPreview={noop}
        onToggleStatus={noop}
      />,
    )

    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('Applied first')).toBeInTheDocument()
  })

  it('disables Edit and explains why when settings:update is missing', () => {
    const rule = buildRule()
    render(
      <ContentRuleRow
        allRules={[rule]}
        canReadAudit={false}
        canUpdateSettings={false}
        isPreviewed={false}
        rule={rule}
        onEdit={noop}
        onOpenAudit={noop}
        onPreview={noop}
        onToggleStatus={noop}
      />,
    )

    const editButton = screen.getByRole('button', { name: /Edit/ })
    expect(editButton).toBeDisabled()
    expect(editButton).toHaveAttribute('title', 'Requires settings:update')
  })

  it('calls onPreview when the row is clicked', () => {
    const rule = buildRule()
    const onPreview = vi.fn()
    render(
      <ContentRuleRow
        allRules={[rule]}
        canReadAudit={false}
        canUpdateSettings
        isPreviewed={false}
        rule={rule}
        onEdit={noop}
        onOpenAudit={noop}
        onPreview={onPreview}
        onToggleStatus={noop}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Preview content rule/ }))

    expect(onPreview).toHaveBeenCalledWith(rule)
  })
})
