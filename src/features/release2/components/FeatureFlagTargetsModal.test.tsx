import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { release2Service } from '../services/release2.service'
import {
  Release2ServiceError,
  type FeatureFlagDetail,
} from '../types/release2.types'
import { FeatureFlagTargetsModal } from './FeatureFlagTargetsModal'

function flag(overrides: Partial<FeatureFlagDetail> = {}): FeatureFlagDetail {
  return {
    availableActions: ['UPDATE', 'REPLACE_TARGETS', 'ARCHIVE'],
    createdAt: '2026-07-01T10:00:00.000Z',
    createdByAdminId: 'admin-uuid',
    defaultEnabled: false,
    description: null,
    displayName: 'Customer Wallet',
    effectiveFrom: null,
    effectiveTo: null,
    effectiveWindowLabel: 'Always',
    featureFlagId: 'flag-uuid',
    featureKey: 'customer.wallet',
    isPublic: false,
    nextRecommendedAction: null,
    ownerTeam: null,
    phase: 'PHASE_1',
    riskLevel: 'FINANCE',
    rolloutPercentage: 100,
    status: 'ENABLED',
    statusTone: 'success',
    targetCount: 1,
    targets: [
      {
        appType: 'CUSTOMER',
        city: 'Bengaluru',
        createdAt: '2026-07-01T10:00:00.000Z',
        effect: 'ALLOW',
        influencerId: null,
        isActive: true,
        priority: 200,
        roleCode: null,
        subjectUserId: null,
        targetId: 'target-uuid',
        updatedAt: '2026-07-01T10:00:00.000Z',
        userSegment: 'RETURNING_CUSTOMER',
        vendorId: null,
        zoneId: null,
      },
    ],
    updatedAt: '2026-08-01T10:00:00.000Z',
    updatedByAdminId: 'admin-uuid',
    version: 4,
    warnings: [],
    ...overrides,
  }
}

function serviceError(
  code: string,
  status: number,
  message: string,
  details?: Record<string, unknown>,
) {
  return new Release2ServiceError(message, status, code, {
    code,
    details,
    message,
    success: false,
  })
}

const replaceFeatureFlagTargets = vi.spyOn(
  release2Service,
  'replaceFeatureFlagTargets',
)

function renderModal(detail = flag()) {
  return renderWithProviders(
    <FeatureFlagTargetsModal
      flag={detail}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  )
}

beforeEach(() => {
  replaceFeatureFlagTargets.mockReset()
})

describe('FeatureFlagTargetsModal', () => {
  it('warns that saving replaces the whole rule set', () => {
    renderModal()

    expect(
      screen.getByText('customer.wallet · saving replaces all 1 rules'),
    ).toBeInTheDocument()
  })

  it('loads existing rules into the editor', () => {
    renderModal()

    expect(screen.getByDisplayValue('Bengaluru')).toBeInTheDocument()
    expect(screen.getByDisplayValue('200')).toBeInTheDocument()
    expect(screen.getByText('1 rule · version 4')).toBeInTheDocument()
  })

  it('requires a reason before replacing targets', async () => {
    renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Replace targets' }))

    expect(
      await screen.findByText('Reason must be at least 3 characters.'),
    ).toBeInTheDocument()
    expect(replaceFeatureFlagTargets).not.toHaveBeenCalled()
  })

  it('sends blank optional fields as null with the expectedVersion', async () => {
    replaceFeatureFlagTargets.mockResolvedValue({
      code: 'FEATURE_FLAG_TARGETS_REPLACED',
      data: flag(),
      message: 'Feature flag targets replaced successfully.',
      success: true,
    })

    renderModal()

    await userEvent.type(
      screen.getByLabelText(/reason/i),
      'Limit Phase 1 QA to Bengaluru customers.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Replace targets' }))

    await waitFor(() => {
      expect(replaceFeatureFlagTargets).toHaveBeenCalledWith('customer.wallet', {
        expectedVersion: 4,
        reason: 'Limit Phase 1 QA to Bengaluru customers.',
        targets: [
          {
            appType: 'CUSTOMER',
            city: 'Bengaluru',
            effect: 'ALLOW',
            influencerId: null,
            isActive: true,
            priority: 200,
            roleCode: null,
            subjectUserId: null,
            userSegment: 'RETURNING_CUSTOMER',
            vendorId: null,
            zoneId: null,
          },
        ],
      })
    })
  })

  it('adds and removes rules before saving', async () => {
    renderModal()

    await userEvent.click(screen.getByRole('button', { name: /add rule/i }))
    expect(screen.getByText('2 rules · version 4')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove target 2' }),
    )
    expect(screen.getByText('1 rule · version 4')).toBeInTheDocument()
  })

  it('maps an indexed target fieldError onto the row that caused it', async () => {
    replaceFeatureFlagTargets.mockRejectedValue(
      serviceError(
        'FEATURE_FLAG_INVALID_TARGET',
        400,
        'One or more feature-flag targets are invalid.',
        {
          action: 'Use existing zone, vendor, influencer, or user ids.',
          fieldErrors: [
            {
              code: 'FEATURE_FLAG_INVALID_TARGET',
              field: 'targets.0.zoneId',
              message: 'zoneId does not match an existing service zone.',
            },
          ],
          reason: 'zoneId does not match an existing service zone.',
        },
      ),
    )

    renderModal()

    await userEvent.type(screen.getByLabelText(/reason/i), 'Bad zone id.')
    await userEvent.click(screen.getByRole('button', { name: 'Replace targets' }))

    expect(
      await screen.findAllByText(
        'zoneId does not match an existing service zone.',
      ),
    ).not.toHaveLength(0)
  })

  it('renders a stale-version conflict with the live version', async () => {
    replaceFeatureFlagTargets.mockRejectedValue(
      serviceError(
        'FEATURE_FLAG_VERSION_CONFLICT',
        409,
        'This feature flag was updated by someone else.',
        {
          action: 'Reload the flag and retry with the latest version.',
          metadata: { currentVersion: 6 },
          reason: 'The expectedVersion does not match the current flag version.',
        },
      ),
    )

    renderModal()

    await userEvent.type(screen.getByLabelText(/reason/i), 'Stale targets write.')
    await userEvent.click(screen.getByRole('button', { name: 'Replace targets' }))

    expect(
      await screen.findByText('This feature flag was updated by someone else.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Current version is 6\./)).toBeInTheDocument()
  })
})
