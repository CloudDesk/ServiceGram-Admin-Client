import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { vendorService } from '../services/vendor.service'
import type {
  VendorReputationDetail,
  VendorReputationScore,
} from '../types/vendor.types'
import { VendorReputationPanel } from './VendorReputationPanel'

/**
 * The admin reputation panel.
 *
 * This is the screen someone opens when a vendor has called to complain about
 * their score, so the things worth gating are the ones that would make that
 * conversation wrong: a penalty applied without an explanation, an unscored
 * vendor presented as scoring zero, and a badge that vanished with no trace.
 */

const VENDOR_ID = '11111111-1111-4111-8111-111111111111'

function score(overrides: Partial<VendorReputationScore> = {}): VendorReputationScore {
  return {
    vendorId: VENDOR_ID,
    score: 80,
    ratingComponent: 90,
    completionComponent: 95,
    responseComponent: 100,
    complaintComponent: 98,
    cancellationComponent: 100,
    penaltyPoints: 15,
    sampleSize: 60,
    ratedOrderCount: 55,
    computedAt: '2026-08-28T02:40:00.000Z',
    ...overrides,
  }
}

function detail(overrides: Partial<VendorReputationDetail> = {}): VendorReputationDetail {
  return {
    score: score(),
    badges: [],
    events: [],
    ...overrides,
  }
}

function respond(value: VendorReputationDetail) {
  return { code: 'VENDOR_REPUTATION_FETCHED', message: 'ok', data: value }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('VendorReputationPanel', () => {
  it('separates a vendor who has never been scored from one scoring zero', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(
      respond(detail({ score: null })),
    )

    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    // An admin telling a vendor "your score is zero" when nothing has been
    // computed would be telling them something false.
    expect(await screen.findByText('Not scored yet')).toBeInTheDocument()
  })

  it('treats a score with no computed timestamp as unscored', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(
      respond(detail({ score: score({ score: 0, computedAt: null }) })),
    )

    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    expect(await screen.findByText('Not scored yet')).toBeInTheDocument()
  })

  it('marks a thin sample as provisional and withheld from customers', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(
      respond(detail({ score: score({ sampleSize: 3, penaltyPoints: 0, score: 95 }) })),
    )

    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    expect(await screen.findByText(/Provisional/)).toBeInTheDocument()
    expect(screen.getByText(/withheld from/i)).toBeInTheDocument()
  })

  it('shows the earned total and the penalty separately, so the score reconciles', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(
      respond(detail()),
    )

    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    // 80 on screen with 15 penalty points means 95 was earned. An admin
    // answering "why is it 80" needs both halves.
    expect(await screen.findByText('95 / 100')).toBeInTheDocument()
    expect(screen.getByText('−15')).toBeInTheDocument()
  })

  it('still lists a revoked badge, with when it went', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(
      respond(
        detail({
          badges: [
            {
              id: 'badge-1',
              badgeCode: 'COMMUNITY_ELITE',
              awardedAt: '2026-08-01T00:00:00.000Z',
              revokedAt: '2026-08-20T00:00:00.000Z',
              awardedScore: 95,
              reason: null,
            },
          ],
        }),
      ),
    )

    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    // "Where did my badge go" is a real support question, and a badge that
    // simply disappeared from this panel could not be answered. The panel
    // marks it revoked and says when, so both are asserted.
    expect(await screen.findByText('· revoked')).toBeInTheDocument()
    expect(screen.getByText(/Community Elite/)).toBeInTheDocument()
    expect(screen.getByText(/revoked \d/)).toBeInTheDocument()

    // ...and it must not be presented as still active.
    expect(screen.queryByText('No active badges.')).toBeInTheDocument()
  })

  it('refuses to submit a penalty without a usable reason', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(respond(detail()))
    const penalty = vi.spyOn(vendorService, 'applyVendorReputationPenalty')

    const user = userEvent.setup()
    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    await screen.findByLabelText('Points')
    await user.type(screen.getByLabelText('Points'), '15')
    await user.type(screen.getByLabelText('Reason'), 'damaged')

    // Reputation drives ranking and therefore income. A deduction a vendor
    // cannot see a reason for is one they cannot appeal.
    expect(screen.getByRole('button', { name: /Apply change/ })).toBeDisabled()
    expect(penalty).not.toHaveBeenCalled()
  })

  it('refuses a zero or non-numeric penalty', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(respond(detail()))

    const user = userEvent.setup()
    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    await screen.findByLabelText('Points')
    await user.type(screen.getByLabelText('Points'), '0')
    await user.type(
      screen.getByLabelText('Reason'),
      'Confirmed damage after review of the evidence.',
    )

    expect(screen.getByRole('button', { name: /Apply change/ })).toBeDisabled()
  })

  it('submits a valid penalty with the trimmed reason', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(respond(detail()))
    const penalty = vi
      .spyOn(vendorService, 'applyVendorReputationPenalty')
      .mockResolvedValue({
        code: 'VENDOR_REPUTATION_PENALTY_APPLIED',
        message: 'ok',
        data: { penaltyPoints: 15, score: 80 },
      })

    const user = userEvent.setup()
    renderWithProviders(<VendorReputationPanel canUpdate vendorId={VENDOR_ID} />)

    await screen.findByLabelText('Points')
    await user.type(screen.getByLabelText('Points'), '15')
    await user.type(
      screen.getByLabelText('Reason'),
      '  Confirmed damage to a customer garment.  ',
    )
    await user.click(screen.getByRole('button', { name: /Apply change/ }))

    await waitFor(() => {
      expect(penalty).toHaveBeenCalledWith(VENDOR_ID, {
        delta: 15,
        reason: 'Confirmed damage to a customer garment.',
      })
    })
  })

  it('hides the penalty form from an admin without update permission', async () => {
    vi.spyOn(vendorService, 'getVendorReputation').mockResolvedValue(respond(detail()))

    renderWithProviders(
      <VendorReputationPanel canUpdate={false} vendorId={VENDOR_ID} />,
    )

    await screen.findByText('Current score')
    expect(screen.queryByLabelText('Points')).not.toBeInTheDocument()
  })
})
