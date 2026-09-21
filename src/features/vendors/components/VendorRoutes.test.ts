import { describe, expect, it } from 'vitest'
import {
  buildVendorOnboardingRedirect,
  readVendorQueue,
} from '../vendorRoutes'

describe('vendor list route state', () => {
  it('reads canonical and legacy onboarding queue filters', () => {
    expect(readVendorQueue(new URLSearchParams('queue=documentsPending'))).toBe(
      'documentsPending',
    )
    expect(
      readVendorQueue(new URLSearchParams('onboardingStatus=UNDER_REVIEW')),
    ).toBe('underReview')
    expect(
      readVendorQueue(new URLSearchParams('onboardingStatus=SUBMITTED')),
    ).toBe('submitted')
    expect(readVendorQueue(new URLSearchParams('vendorStatus=SUSPENDED'))).toBe(
      'suspended',
    )
  })

  it('falls back safely when a queue is unknown', () => {
    expect(readVendorQueue(new URLSearchParams('queue=unknown'))).toBe('active')
  })

  it('accepts the submitted application queue', () => {
    expect(readVendorQueue(new URLSearchParams('queue=submitted'))).toBe(
      'submitted',
    )
  })
})

describe('legacy vendor onboarding redirects', () => {
  it('moves list filters to the consolidated Vendors page', () => {
    expect(
      buildVendorOnboardingRedirect(
        '?onboardingStatus=DOCUMENTS_PENDING&search=laundry&city=Bengaluru',
      ),
    ).toBe(
      '/app/vendors?search=laundry&city=Bengaluru&queue=documentsPending',
    )
  })

  it('preserves bank approval and vendor detail links', () => {
    expect(buildVendorOnboardingRedirect('?bankAccountStatus=PENDING_VERIFICATION')).toBe(
      '/app/vendors?queue=onboarding&approvalQueue=BANK_ACCOUNT_APPROVALS',
    )
    expect(buildVendorOnboardingRedirect('', '', 'vendor-123')).toBe(
      '/app/vendors/vendor-123',
    )
  })
})
