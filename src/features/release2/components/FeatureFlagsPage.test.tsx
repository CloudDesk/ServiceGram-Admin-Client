import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { release2Service } from '../services/release2.service'
import {
  Release2ServiceError,
  type FeatureFlagListRow,
  type FeatureFlagsListResponse,
} from '../types/release2.types'
import { FeatureFlagsPage } from './FeatureFlagsPage'

function row(overrides: Partial<FeatureFlagListRow> = {}): FeatureFlagListRow {
  return {
    featureFlagId: 'flag-uuid',
    featureKey: 'customer.wallet',
    displayName: 'Customer Wallet',
    phase: 'PHASE_1',
    status: 'ENABLED',
    statusTone: 'success',
    defaultEnabled: false,
    rolloutPercentage: 0,
    effectiveWindowLabel: 'Always',
    targetCount: 2,
    riskLevel: 'FINANCE',
    isPublic: false,
    version: 3,
    updatedAt: '2026-08-01T10:00:00.000Z',
    availableActions: ['UPDATE', 'REPLACE_TARGETS', 'ARCHIVE', 'EVALUATE', 'VIEW_HISTORY'],
    ...overrides,
  }
}

const listResponse: FeatureFlagsListResponse = {
  success: true,
  code: 'FEATURE_FLAGS_LISTED',
  message: 'Feature flags loaded successfully.',
  data: [row()],
  pagination: {
    page: 1,
    limit: 50,
    totalItems: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
  summary: {
    totalFlags: 30,
    enabledCount: 4,
    disabledCount: 25,
    archivedCount: 1,
    expiringSoonCount: 2,
    highRiskEnabledCount: 3,
  },
}

const getFeatureFlags = vi.spyOn(release2Service, 'getFeatureFlags')

function renderPage(permissions: string[]) {
  return renderWithProviders(<FeatureFlagsPage />, {
    initialEntry: '/app/release-2/feature-flags',
    path: '/app/release-2/feature-flags',
    permissions,
  })
}

beforeEach(() => {
  getFeatureFlags.mockReset()
  window.localStorage.clear()
})

describe('FeatureFlagsPage', () => {
  it('shows the missing-permission panel when the backend denies the list', async () => {
    getFeatureFlags.mockRejectedValue(
      new Release2ServiceError('You do not have permission.', 403, 'AUTH_PERMISSION_DENIED', {
        success: false,
        code: 'AUTH_PERMISSION_DENIED',
        message: 'You do not have permission.',
        details: { reason: 'feature-flags:read is required.' },
      }),
    )

    renderPage([])

    expect(
      await screen.findByText('You do not have access to this screen'),
    ).toBeInTheDocument()
    expect(screen.getByText('feature-flags:read')).toBeInTheDocument()
  })

  it('disables create without feature-flags:update and explains why', async () => {
    getFeatureFlags.mockResolvedValue(listResponse)

    renderPage(['feature-flags:read'])

    const createButton = await screen.findByRole('button', { name: /new flag/i })

    expect(createButton).toBeDisabled()
    expect(createButton).toHaveAttribute('title', 'Requires feature-flags:update')
  })

  it('enables create with feature-flags:update', async () => {
    getFeatureFlags.mockResolvedValue(listResponse)

    renderPage(['feature-flags:read', 'feature-flags:update'])

    expect(await screen.findByRole('button', { name: /new flag/i })).toBeEnabled()
  })

  it('renders backend summary counts rather than counting the current page', async () => {
    getFeatureFlags.mockResolvedValue(listResponse)

    renderPage(['feature-flags:read'])

    const strip = await screen.findByRole('region', {
      name: 'Feature flag rollout summary',
    })

    expect(strip).toHaveTextContent('Total30')
    expect(strip).toHaveTextContent('On4')
    expect(strip).toHaveTextContent('High-risk on3')
    expect(strip).toHaveTextContent('Expiring ≤7d2')
  })

  it('requests the status filter that matches the selected queue', async () => {
    getFeatureFlags.mockResolvedValue(listResponse)

    renderWithProviders(<FeatureFlagsPage />, {
      initialEntry: '/app/release-2/feature-flags?status=ARCHIVED',
      path: '/app/release-2/feature-flags',
      permissions: ['feature-flags:read'],
    })

    await screen.findByText('Customer Wallet')

    expect(getFeatureFlags).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ARCHIVED' }),
    )
  })
})
