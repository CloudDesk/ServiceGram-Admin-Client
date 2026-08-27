import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { release2Service } from '../services/release2.service'
import {
  Release2ServiceError,
  type FeatureFlagDetail,
  type FeatureFlagDetailResponse,
} from '../types/release2.types'
import { FeatureFlagDetailPage } from './FeatureFlagDetailPage'

const FLAG_ROUTE = '/app/release-2/feature-flags/:featureKey'
const FLAG_ENTRY = '/app/release-2/feature-flags/customer.wallet'

function flag(overrides: Partial<FeatureFlagDetail> = {}): FeatureFlagDetail {
  return {
    availableActions: [
      'UPDATE',
      'REPLACE_TARGETS',
      'ARCHIVE',
      'EVALUATE',
      'VIEW_HISTORY',
    ],
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
    nextRecommendedAction: 'ADD_ALLOW_TARGET',
    ownerTeam: 'finance',
    phase: 'PHASE_1',
    riskLevel: 'FINANCE',
    rolloutPercentage: 0,
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
    version: 3,
    warnings: [
      'This flag is enabled but rollout is 0%, so nobody will receive it.',
    ],
    ...overrides,
  }
}

function detailResponse(overrides: Partial<FeatureFlagDetail> = {}) {
  return {
    code: 'FEATURE_FLAG_LOADED',
    data: flag(overrides),
    message: 'Feature flag loaded successfully.',
    success: true,
  } satisfies FeatureFlagDetailResponse
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

const getFeatureFlag = vi.spyOn(release2Service, 'getFeatureFlag')
const archiveFeatureFlag = vi.spyOn(release2Service, 'archiveFeatureFlag')
const getFeatureFlagHistory = vi.spyOn(release2Service, 'getFeatureFlagHistory')

function renderPage(permissions: string[]) {
  return renderWithProviders(<FeatureFlagDetailPage />, {
    initialEntry: FLAG_ENTRY,
    path: FLAG_ROUTE,
    permissions,
  })
}

const FULL_ACCESS = ['feature-flags:read', 'feature-flags:update']

beforeEach(() => {
  getFeatureFlag.mockReset()
  archiveFeatureFlag.mockReset()
  getFeatureFlagHistory.mockReset()
})

describe('FeatureFlagDetailPage permission and lifecycle states', () => {
  it('shows the missing-permission panel when the backend denies the read', async () => {
    getFeatureFlag.mockRejectedValue(
      serviceError('AUTH_PERMISSION_DENIED', 403, 'You do not have permission.', {
        reason: 'feature-flags:read is required.',
      }),
    )

    renderPage([])

    expect(
      await screen.findByText('You do not have access to this screen'),
    ).toBeInTheDocument()
    expect(screen.getByText('feature-flags:read')).toBeInTheDocument()
  })

  it('disables every mutation without feature-flags:update and says why', async () => {
    getFeatureFlag.mockResolvedValue(detailResponse())

    renderPage(['feature-flags:read'])

    for (const label of ['Edit', 'Targets', 'Archive']) {
      const button = await screen.findByRole('button', { name: label })

      expect(button).toBeDisabled()
      expect(button).toHaveAttribute('title', 'Requires feature-flags:update')
    }
  })

  it('follows backend availableActions when the flag is archived', async () => {
    getFeatureFlag.mockResolvedValue(
      detailResponse({
        availableActions: ['EVALUATE', 'VIEW_HISTORY'],
        nextRecommendedAction: null,
        status: 'ARCHIVED',
        statusTone: 'neutral',
        warnings: [],
      }),
    )

    renderPage(FULL_ACCESS)

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveAttribute(
      'title',
      'Archived flags cannot be changed',
    )
    expect(
      screen.getByText('This flag is archived and read-only'),
    ).toBeInTheDocument()
  })

  it('renders backend warnings and the next recommended action verbatim', async () => {
    getFeatureFlag.mockResolvedValue(detailResponse())

    renderPage(FULL_ACCESS)

    expect(
      await screen.findByText(
        'This flag is enabled but rollout is 0%, so nobody will receive it.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Next: Add an ALLOW target')).toBeInTheDocument()
  })
})

describe('FeatureFlagDetailPage archive flow', () => {
  async function openArchiveDialog() {
    getFeatureFlag.mockResolvedValue(detailResponse())

    renderPage(FULL_ACCESS)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Archive' }),
    )

    return screen.findByRole('button', { name: 'Archive flag' })
  }

  it('requires a confirmation with a reason before archiving', async () => {
    const confirmButton = await openArchiveDialog()

    expect(
      screen.getByText('Archive this feature flag?'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Archiving is permanent. The flag becomes read-only and stops evaluating.',
      ),
    ).toBeInTheDocument()

    await userEvent.click(confirmButton)

    expect(
      await screen.findByText('Reason must be at least 3 characters.'),
    ).toBeInTheDocument()
    expect(archiveFeatureFlag).not.toHaveBeenCalled()
  })

  it('sends the reason and the loaded expectedVersion', async () => {
    const confirmButton = await openArchiveDialog()

    archiveFeatureFlag.mockResolvedValue(
      detailResponse({ status: 'ARCHIVED', version: 4 }),
    )

    await userEvent.type(
      screen.getByLabelText(/reason/i),
      'Retired after Phase 1 redesign.',
    )
    await userEvent.click(confirmButton)

    await waitFor(() => {
      expect(archiveFeatureFlag).toHaveBeenCalledWith('customer.wallet', {
        expectedVersion: 3,
        reason: 'Retired after Phase 1 redesign.',
      })
    })
  })

  it('renders a stale-version conflict with the live version and a reload action', async () => {
    const confirmButton = await openArchiveDialog()

    archiveFeatureFlag.mockRejectedValue(
      serviceError(
        'FEATURE_FLAG_VERSION_CONFLICT',
        409,
        'This feature flag was updated by someone else.',
        {
          action: 'Reload the flag and retry with the latest version.',
          metadata: { currentVersion: 7 },
          reason: 'The expectedVersion does not match the current flag version.',
        },
      ),
    )

    await userEvent.type(screen.getByLabelText(/reason/i), 'Stale write.')
    await userEvent.click(confirmButton)

    expect(
      await screen.findByText('This feature flag was updated by someone else.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Current version is 7\./)).toBeInTheDocument()
    expect(
      screen.getByText('FEATURE_FLAG_VERSION_CONFLICT'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('surfaces an already-archived rejection instead of a generic failure', async () => {
    const confirmButton = await openArchiveDialog()

    archiveFeatureFlag.mockRejectedValue(
      serviceError(
        'FEATURE_FLAG_ARCHIVED',
        409,
        'This feature flag is already archived.',
        {
          action: 'No further archive action is needed.',
          reason: 'The flag is already archived.',
        },
      ),
    )

    await userEvent.type(screen.getByLabelText(/reason/i), 'Duplicate archive.')
    await userEvent.click(confirmButton)

    expect(
      await screen.findByText('This feature flag is already archived.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No further archive action is needed\./),
    ).toBeInTheDocument()
  })
})

describe('FeatureFlagDetailPage history', () => {
  it('loads audit history only once the section is opened', async () => {
    getFeatureFlag.mockResolvedValue(detailResponse())
    getFeatureFlagHistory.mockResolvedValue({
      code: 'FEATURE_FLAG_HISTORY_LISTED',
      data: [
        {
          actionCode: 'update',
          actor: {
            actorAdminId: 'admin-uuid',
            actorType: 'ADMIN',
            actorUserId: null,
            adminName: 'Ops Admin',
            email: null,
            userStatus: null,
            userType: null,
          },
          auditLogId: 'audit-uuid',
          createdAt: '2026-08-01T10:00:00.000Z',
          entityId: 'flag-uuid',
          entityType: 'feature_flag',
          ipAddress: null,
          moduleCode: 'feature_flags',
          newValue: null,
          oldValue: null,
          reason: 'Enabled for Chennai QA.',
          requestId: 'req-uuid',
        },
      ],
      message: 'Feature flag history loaded successfully.',
      pagination: {
        hasNextPage: false,
        hasPreviousPage: false,
        limit: 10,
        page: 1,
        totalItems: 1,
        totalPages: 1,
      },
      success: true,
    })

    renderPage(FULL_ACCESS)

    await screen.findByText('Change history')
    expect(getFeatureFlagHistory).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: /show/i }))

    expect(await screen.findByText('Ops Admin')).toBeInTheDocument()
    expect(screen.getByText('Enabled for Chennai QA.')).toBeInTheDocument()
    expect(getFeatureFlagHistory).toHaveBeenCalledWith('customer.wallet', {
      limit: 10,
      page: 1,
    })
  })
})
