import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(import.meta.dirname, 'PayoutsPage.tsx'), 'utf8')

describe('PayoutsPage vendor earnings reconciliation guardrails', () => {
  it('keeps reconciliation permission-gated and reason-confirmed', () => {
    expect(page).toContain("usePermission('payouts:approve')")
    expect(page).toContain('canApprovePayouts ?')
    expect(page).toContain('title="Reconcile vendor earnings"')
    expect(page).toContain('reasonLabel="Reconciliation reason"')
    expect(page).toContain('payoutService.reconcileVendorEarnings')
  })

  it('makes the financial boundary explicit before running reconciliation', () => {
    expect(page).toContain('This does not transfer money or create payout batches.')
    expect(page).toContain('Orders awaiting payment stay pending')
    expect(page).toContain('readyToCreateCount')
    expect(page).toContain('dueEligibilityCount')
    expect(page).toContain('refundReviewCount')
  })
})
