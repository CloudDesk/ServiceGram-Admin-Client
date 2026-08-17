import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { release2Service } from '../services/release2.service'
import { Release2OverviewPage } from './Release2OverviewPage'
import { Release2SettingsPage } from './Release2SettingsPage'

const getOverview = vi.spyOn(release2Service, 'getOverview')
const getPublicAppConfig = vi.spyOn(release2Service, 'getPublicAppConfig')
const getDeliveryAppConfig = vi.spyOn(release2Service, 'getDeliveryAppConfig')
const getRelease2Settings = vi.spyOn(release2Service, 'getRelease2Settings')

function pendingRequest() {
  return new Promise<never>(() => {
    // Keep the page in its loading state while page chrome is published.
  })
}

beforeEach(() => {
  getOverview.mockReturnValue(pendingRequest())
  getPublicAppConfig.mockReturnValue(pendingRequest())
  getDeliveryAppConfig.mockReturnValue(pendingRequest())
  getRelease2Settings.mockReturnValue(pendingRequest())
})

describe('Release 2 page chrome layout', () => {
  it('keeps overview on document layout so the shell scroll region remains enabled', async () => {
    renderWithProviders(<Release2OverviewPage />, {
      initialEntry: '/app/release-2',
      path: '/app/release-2',
      permissions: ['feature-flags:read', 'settings:read'],
    })

    await screen.findByRole('button', { name: /refresh release 2 overview/i })

    expect(screen.getByTestId('page-chrome-actions')).toHaveAttribute(
      'data-page-layout',
      'document',
    )
  })

  it('keeps settings on document layout so long setting groups can scroll', async () => {
    renderWithProviders(<Release2SettingsPage />, {
      initialEntry: '/app/release-2/settings',
      path: '/app/release-2/settings',
      permissions: ['settings:read'],
    })

    await screen.findByRole('button', { name: /refresh release 2 settings/i })

    expect(screen.getByTestId('page-chrome-actions')).toHaveAttribute(
      'data-page-layout',
      'document',
    )
  })
})
