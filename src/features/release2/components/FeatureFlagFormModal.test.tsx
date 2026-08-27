import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { release2Service } from '../services/release2.service'
import {
  Release2ServiceError,
  type FeatureFlagDetail,
} from '../types/release2.types'
import { FeatureFlagFormModal } from './FeatureFlagFormModal'

function flag(overrides: Partial<FeatureFlagDetail> = {}): FeatureFlagDetail {
  return {
    availableActions: ['UPDATE', 'REPLACE_TARGETS', 'ARCHIVE'],
    createdAt: '2026-07-01T10:00:00.000Z',
    createdByAdminId: 'admin-uuid',
    defaultEnabled: false,
    description: 'Ledger-backed customer wallet.',
    displayName: 'Customer Wallet',
    effectiveFrom: null,
    effectiveTo: null,
    effectiveWindowLabel: 'Always',
    featureFlagId: 'flag-uuid',
    featureKey: 'customer.wallet',
    isPublic: false,
    nextRecommendedAction: null,
    ownerTeam: 'finance',
    phase: 'PHASE_1',
    riskLevel: 'FINANCE',
    rolloutPercentage: 25,
    status: 'DISABLED',
    statusTone: 'warning',
    targetCount: 0,
    targets: [],
    updatedAt: '2026-08-01T10:00:00.000Z',
    updatedByAdminId: 'admin-uuid',
    version: 3,
    warnings: [],
    ...overrides,
  }
}

function response(overrides: Partial<FeatureFlagDetail> = {}) {
  return {
    code: 'FEATURE_FLAG_UPDATED',
    data: flag(overrides),
    message: 'Feature flag updated successfully.',
    success: true as const,
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

const createFeatureFlag = vi.spyOn(release2Service, 'createFeatureFlag')
const updateFeatureFlag = vi.spyOn(release2Service, 'updateFeatureFlag')

beforeEach(() => {
  createFeatureFlag.mockReset()
  updateFeatureFlag.mockReset()
})

describe('FeatureFlagFormModal create', () => {
  it('blocks submit until key, name and reason are present', async () => {
    renderWithProviders(
      <FeatureFlagFormModal mode="create" onClose={vi.fn()} onSaved={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Create flag' }))

    expect(
      await screen.findByText('Feature key must be at least 3 characters.'),
    ).toBeInTheDocument()
    expect(createFeatureFlag).not.toHaveBeenCalled()
  })

  it('sends a trimmed create payload with the audit reason', async () => {
    createFeatureFlag.mockResolvedValue(response())

    renderWithProviders(
      <FeatureFlagFormModal mode="create" onClose={vi.fn()} onSaved={vi.fn()} />,
    )

    await userEvent.type(
      screen.getByPlaceholderText('customer.wallet'),
      'customer.vault',
    )
    await userEvent.type(
      screen.getByPlaceholderText('Customer Wallet'),
      'Digital Vault',
    )
    await userEvent.type(
      screen.getByLabelText(/reason/i),
      'Preparing Phase 1 vault rails.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Create flag' }))

    await waitFor(() => {
      expect(createFeatureFlag).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Digital Vault',
          featureKey: 'customer.vault',
          reason: 'Preparing Phase 1 vault rails.',
          status: 'DISABLED',
        }),
      )
    })
  })

  it('puts a backend fieldError under the field it belongs to', async () => {
    createFeatureFlag.mockRejectedValue(
      serviceError('VALIDATION_FAILED', 400, 'Request validation failed.', {
        fieldErrors: [
          {
            code: 'INVALID_STRING',
            field: 'featureKey',
            message: 'featureKey must be a lowercase dotted key.',
          },
        ],
        reason: 'One or more fields are invalid.',
      }),
    )

    renderWithProviders(
      <FeatureFlagFormModal mode="create" onClose={vi.fn()} onSaved={vi.fn()} />,
    )

    await userEvent.type(
      screen.getByPlaceholderText('customer.wallet'),
      'Customer Vault',
    )
    await userEvent.type(
      screen.getByPlaceholderText('Customer Wallet'),
      'Digital Vault',
    )
    await userEvent.type(screen.getByLabelText(/reason/i), 'Trying an invalid key.')
    await userEvent.click(screen.getByRole('button', { name: 'Create flag' }))

    expect(
      await screen.findAllByText('featureKey must be a lowercase dotted key.'),
    ).not.toHaveLength(0)
  })
})

describe('FeatureFlagFormModal edit', () => {
  it('prefills from the loaded flag and shows the version it saves against', async () => {
    renderWithProviders(
      <FeatureFlagFormModal
        flag={flag()}
        mode="edit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('Customer Wallet')).toBeInTheDocument()
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()
    expect(screen.getByText('Saving against version 3')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('customer.wallet')).toBeNull()
  })

  it('sends expectedVersion from the loaded record', async () => {
    updateFeatureFlag.mockResolvedValue(response({ version: 4 }))

    renderWithProviders(
      <FeatureFlagFormModal
        flag={flag()}
        mode="edit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await userEvent.type(
      screen.getByLabelText(/reason/i),
      'Enable wallet for controlled QA rollout.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(updateFeatureFlag).toHaveBeenCalledWith(
        'customer.wallet',
        expect.objectContaining({
          expectedVersion: 3,
          reason: 'Enable wallet for controlled QA rollout.',
        }),
      )
    })
  })

  it('renders a stale-version conflict with the live version', async () => {
    updateFeatureFlag.mockRejectedValue(
      serviceError(
        'FEATURE_FLAG_VERSION_CONFLICT',
        409,
        'This feature flag was updated by someone else.',
        {
          action: 'Reload the flag and retry with the latest version.',
          metadata: { currentVersion: 9 },
          reason: 'The expectedVersion does not match the current flag version.',
        },
      ),
    )

    renderWithProviders(
      <FeatureFlagFormModal
        flag={flag()}
        mode="edit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText(/reason/i), 'Stale write.')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('This feature flag was updated by someone else.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Current version is 9\./)).toBeInTheDocument()
  })

  it('surfaces a rejected rollout percentage from the backend', async () => {
    updateFeatureFlag.mockRejectedValue(
      serviceError(
        'FEATURE_FLAG_INVALID_ROLLOUT',
        400,
        'Rollout percentage must be between 0 and 100.',
        {
          action: 'Use an integer from 0 to 100.',
          reason: 'rolloutPercentage is outside the allowed range.',
        },
      ),
    )

    renderWithProviders(
      <FeatureFlagFormModal
        flag={flag()}
        mode="edit"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await userEvent.type(screen.getByLabelText(/reason/i), 'Bad rollout.')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Rollout percentage must be between 0 and 100.'),
    ).toBeInTheDocument()
    expect(screen.getByText('FEATURE_FLAG_INVALID_ROLLOUT')).toBeInTheDocument()
  })
})
