import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../../services/apiClient'
import { payoutService } from './payout.service'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

const requestSpy = vi.spyOn(apiClient, 'request')

beforeEach(() => {
  requestSpy.mockReset()
  requestSpy.mockResolvedValue(jsonResponse({ data: {} }))
})

describe('payoutService vendor earnings reconciliation', () => {
  it('sends a bounded, audited reconciliation request to the admin endpoint', async () => {
    await payoutService.reconcileVendorEarnings({
      dryRun: false,
      limit: 250,
      reason: 'Repair missed order earnings.',
    })

    expect(requestSpy).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/admin/payouts/earnings/reconcile',
      {
        body: JSON.stringify({
          dryRun: false,
          limit: 250,
          reason: 'Repair missed order earnings.',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    )
  })
})
