import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { SettingsServiceError } from '../../types/settings.types'
import { DEFAULT_MEDIA_REEL_CONFIG } from '../types/mediaReelPolicy.types'
import { MediaReelPolicyModal, type MediaReelPolicyModalProps } from './MediaReelPolicyModal'

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
    version: 3,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveTo: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    availableActions: ['EDIT', 'ARCHIVE'],
    ...overrides,
  }
}

function renderModal(props: Partial<MediaReelPolicyModalProps> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSubmit = vi.fn()
  const onClearError = vi.fn()
  const onReloadLatest = vi.fn().mockResolvedValue(null)
  const defaultProps: MediaReelPolicyModalProps = {
    action: { action: 'CREATE' },
    canUpdateSettings: true,
    defaultConfigSource: null,
    error: null,
    isSubmitting: false,
    onClearError,
    onClose: vi.fn(),
    onReloadLatest,
    onSubmit,
    ...props,
  }

  return {
    onClearError,
    onReloadLatest,
    onSubmit,
    ...render(wrap(<MediaReelPolicyModal {...defaultProps} />, queryClient)),
  }
}

function wrap(element: ReactElement, queryClient: QueryClient) {
  return <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
}

describe('MediaReelPolicyModal permissions', () => {
  it('disables Save and explains why when settings:update is missing', () => {
    renderModal({ canUpdateSettings: false })

    expect(screen.getByText(/read-only access/i)).toBeInTheDocument()
    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveAttribute('title', 'Requires settings:update')
  })
})

describe('MediaReelPolicyModal save flow', () => {
  it('opens the confirm step with a diff, then submits the mapped payload on confirm', async () => {
    const { onSubmit } = renderModal()

    fireEvent.change(screen.getByPlaceholderText('Default content rules'), {
      target: { value: 'Default content rules' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Confirm content rule changes')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Why this content rule is changing'), {
      target: { value: 'Initial content rollout' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0]?.[0]
    if (!payload) throw new Error('onSubmit was not called with a payload.')
    expect(payload.family).toBe('MEDIA_REEL_RULE')
    expect(payload.displayName).toBe('Default content rules')
    expect(payload.reason).toBe('Initial content rollout')
    expect(payload.config.maxReelSizeBytes).toBe(104_857_600)
  })

  it('blocks confirmation until a reason of at least 3 characters is entered', async () => {
    const { onSubmit } = renderModal()

    fireEvent.change(screen.getByPlaceholderText('Default content rules'), {
      target: { value: 'Default content rules' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText('Confirm content rule changes')

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }))

    expect(await screen.findByText('Reason must be at least 3 characters.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('MediaReelPolicyModal server error mapping', () => {
  it('maps a fieldErrors entry onto the corresponding visible field', async () => {
    const serviceError = new SettingsServiceError('Validation failed.', 422, 'VALIDATION_FAILED', {
      details: {
        fieldErrors: [
          {
            field: 'config.minReelDurationSeconds',
            code: 'too_small',
            message: 'Must be at least 1 second.',
          },
        ],
      },
    })

    renderModal({ error: serviceError })

    expect(await screen.findByText('Must be at least 1 second.')).toBeInTheDocument()
  })

  it('shows activation conflicts and applies the suggested rule order', async () => {
    const serviceError = new SettingsServiceError(
      'This policy conflicts with another active rule.',
      409,
      'POLICY_RULE_ACTIVATION_CONFLICT',
      {
        details: {
          metadata: {
            suggestedPriority: 99,
            conflictingRules: [
              {
                policyRuleId: 'rule-existing',
                ruleKey: 'media.reels.global.existing',
                displayName: 'Existing global rule',
                priority: 100,
                scope: {
                  scopeType: 'GLOBAL',
                  categoryId: null,
                  city: null,
                  zoneId: null,
                  vendorId: null,
                },
                effectiveFrom: '2026-01-01T00:00:00.000Z',
                effectiveTo: null,
              },
            ],
          },
        },
      },
    )

    renderModal({ error: serviceError })
    fireEvent.change(screen.getByPlaceholderText('Default content rules'), {
      target: { value: 'Default content rules' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Another active rule has the same order')).toBeInTheDocument()
    expect(screen.getByText('Existing global rule (order 100)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use suggested order 99' }))

    expect(screen.queryByText('Confirm content rule changes')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('99')).toBeInTheDocument()
  })
})
