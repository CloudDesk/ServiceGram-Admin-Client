import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { release2Service } from '../services/release2.service'
import {
  Release2ServiceError,
  type Release2Setting,
  type Release2SettingResponse,
} from '../types/release2.types'
import { Release2SettingDetailPage } from './Release2SettingDetailPage'

const SETTING_ROUTE = '/app/release-2/settings/:settingKey'

function setting(overrides: Partial<Release2Setting> = {}): Release2Setting {
  return {
    settingId: 'setting-uuid',
    settingKey: 'referral.referrer_reward_paise',
    category: 'referrals',
    displayName: 'Referrer reward',
    description: 'Reward paid to the referrer after first completed booking.',
    valueType: 'integer',
    value: 5000,
    defaultValue: 5000,
    isValueMasked: false,
    isEditable: true,
    isSensitive: false,
    version: 3,
    riskLevel: 'FINANCE',
    requiresReason: true,
    requiresRecentAuth: true,
    validation: { min: 0, max: 1000000, unit: 'paise' },
    uiGroup: 'referrals',
    isRelease2: true,
    updatedByAdminId: 'admin-uuid',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    warnings: [
      'This is a finance setting. Changes affect money movement and require a reason.',
    ],
    availableActions: ['PREVIEW', 'UPDATE'],
    wouldRequireApproval: false,
    ...overrides,
  }
}

function settingResponse(overrides: Partial<Release2Setting> = {}) {
  return {
    success: true,
    code: 'RELEASE2_SETTING_LOADED',
    message: 'Release 2 setting loaded successfully.',
    data: setting(overrides),
  } satisfies Release2SettingResponse
}

function serviceError(
  code: string,
  status: number,
  message: string,
  details?: Record<string, unknown>,
) {
  return new Release2ServiceError(message, status, code, {
    success: false,
    code,
    message,
    details,
  })
}

const getSetting = vi.spyOn(release2Service, 'getRelease2Setting')
const previewSetting = vi.spyOn(release2Service, 'previewRelease2Setting')
const updateSetting = vi.spyOn(release2Service, 'updateRelease2Setting')

function renderPage(permissions: string[]) {
  return renderWithProviders(<Release2SettingDetailPage />, {
    initialEntry: '/app/release-2/settings/referral.referrer_reward_paise',
    path: SETTING_ROUTE,
    permissions,
  })
}

async function editValue(nextValue: string) {
  const valueInput = await screen.findByLabelText(/new value/i)
  await userEvent.clear(valueInput)
  await userEvent.type(valueInput, nextValue)
}

beforeEach(() => {
  getSetting.mockReset()
  previewSetting.mockReset()
  updateSetting.mockReset()
})

describe('Release2SettingDetailPage permission states', () => {
  it('shows the missing-permission panel when the backend denies the read', async () => {
    getSetting.mockRejectedValue(
      serviceError('AUTH_PERMISSION_DENIED', 403, 'You do not have permission.', {
        reason: 'settings:read is required.',
      }),
    )

    renderPage([])

    expect(
      await screen.findByText('You do not have access to this screen'),
    ).toBeInTheDocument()
    expect(screen.getByText('settings:read is required.')).toBeInTheDocument()
    expect(screen.getByText('settings:read')).toBeInTheDocument()
  })

  it('blocks a finance setting without the finance permission', async () => {
    getSetting.mockResolvedValue(settingResponse())

    renderPage(['settings:read', 'settings:update'])

    expect(
      await screen.findByText('Finance setting is read-only for your role'),
    ).toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: 'Save value' })

    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute(
      'title',
      'Requires release2-finance-settings:update',
    )
  })

  it('renders the backend finance warning verbatim', async () => {
    getSetting.mockResolvedValue(settingResponse())

    renderPage(['settings:read'])

    expect(
      await screen.findByText(
        'This is a finance setting. Changes affect money movement and require a reason.',
      ),
    ).toBeInTheDocument()
  })
})

describe('Release2SettingDetailPage preview before save', () => {
  it('keeps save disabled until a valid preview and a reason exist', async () => {
    getSetting.mockResolvedValue(settingResponse())
    previewSetting.mockResolvedValue({
      success: true,
      code: 'RELEASE2_SETTING_PREVIEWED',
      message: 'Release 2 setting preview completed.',
      data: {
        settingKey: 'referral.referrer_reward_paise',
        normalizedValue: 7500,
        validationErrors: [],
        warnings: [],
        wouldRequireApproval: false,
        isValid: true,
      },
    })

    renderPage([
      'settings:read',
      'settings:update',
      'release2-finance-settings:update',
    ])

    const saveButton = await screen.findByRole('button', { name: 'Save value' })

    expect(saveButton).toHaveAttribute('title', 'Change the value first')

    await editValue('7500')
    expect(saveButton).toHaveAttribute('title', 'Run Check value first')

    await userEvent.click(screen.getByRole('button', { name: 'Check value' }))

    expect(await screen.findByText(/Valid · will save ₹75/)).toBeInTheDocument()
    expect(saveButton).toHaveAttribute('title', 'Add a reason')

    await userEvent.type(
      screen.getByLabelText(/reason/i),
      'Increase referral reward for launch cohort.',
    )

    expect(saveButton).toBeEnabled()
  })

  it('shows the backend validation error from a rejected preview', async () => {
    getSetting.mockResolvedValue(settingResponse())
    previewSetting.mockResolvedValue({
      success: true,
      code: 'RELEASE2_SETTING_PREVIEWED',
      message: 'Release 2 setting preview completed.',
      data: {
        settingKey: 'referral.referrer_reward_paise',
        normalizedValue: 2000000,
        validationErrors: [
          { field: 'value', message: 'Value must be at most 1000000.' },
        ],
        warnings: [],
        wouldRequireApproval: false,
        isValid: false,
      },
    })

    renderPage([
      'settings:read',
      'settings:update',
      'release2-finance-settings:update',
    ])

    await editValue('2000000')
    await userEvent.click(screen.getByRole('button', { name: 'Check value' }))

    expect(
      await screen.findByText('Value must be at most 1000000.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Rejected by validation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save value' })).toBeDisabled()
  })
})

describe('Release2SettingDetailPage mutation errors', () => {
  async function submitValidSave() {
    getSetting.mockResolvedValue(settingResponse())
    previewSetting.mockResolvedValue({
      success: true,
      code: 'RELEASE2_SETTING_PREVIEWED',
      message: 'Release 2 setting preview completed.',
      data: {
        settingKey: 'referral.referrer_reward_paise',
        normalizedValue: 7500,
        validationErrors: [],
        warnings: [],
        wouldRequireApproval: false,
        isValid: true,
      },
    })

    renderPage([
      'settings:read',
      'settings:update',
      'release2-finance-settings:update',
    ])

    await editValue('7500')
    await userEvent.click(screen.getByRole('button', { name: 'Check value' }))
    await screen.findByText(/Valid · will save/)
    await userEvent.type(screen.getByLabelText(/reason/i), 'Launch cohort change.')
    await userEvent.click(screen.getByRole('button', { name: 'Save value' }))
  }

  it('sends expectedVersion from the loaded record', async () => {
    updateSetting.mockResolvedValue(settingResponse({ value: 7500, version: 4 }))

    await submitValidSave()

    await waitFor(() => {
      expect(updateSetting).toHaveBeenCalledWith('referral.referrer_reward_paise', {
        value: 7500,
        expectedVersion: 3,
        reason: 'Launch cohort change.',
      })
    })
  })

  it('renders a stale-version conflict with the live version and a reload action', async () => {
    updateSetting.mockRejectedValue(
      serviceError(
        'SETTING_VERSION_CONFLICT',
        409,
        'This setting was updated by someone else.',
        {
          reason: 'The expectedVersion does not match the current setting version.',
          action: 'Reload the setting and retry with the latest version.',
          metadata: { currentVersion: 5 },
        },
      ),
    )

    await submitValidSave()

    expect(
      await screen.findByText('This setting was updated by someone else.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Current version is 5\./)).toBeInTheDocument()
    expect(screen.getByText('SETTING_VERSION_CONFLICT')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('renders a rejected save fieldError next to the value input', async () => {
    updateSetting.mockRejectedValue(
      serviceError(
        'SETTING_VALIDATION_FAILED',
        400,
        'Value must be at most 1000000.',
        {
          reason: 'Value must be at most 1000000.',
          action: 'Correct the value using the returned validation metadata.',
          fieldErrors: [
            {
              field: 'value',
              code: 'SETTING_VALIDATION_FAILED',
              message: 'Value must be at most 1000000.',
            },
          ],
        },
      ),
    )

    await submitValidSave()

    await waitFor(() => {
      expect(
        screen.getAllByText('Value must be at most 1000000.').length,
      ).toBeGreaterThan(1)
    })
  })

  it('asks for re-authentication when the backend requires recent auth', async () => {
    updateSetting.mockRejectedValue(
      serviceError('AUTH_REAUTH_REQUIRED', 401, 'Recent authentication required.'),
    )

    await submitValidSave()

    expect(
      await screen.findByText('Re-authentication required'),
    ).toBeInTheDocument()
  })
})
