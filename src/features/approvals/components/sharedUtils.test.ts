// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { collectConditionLeaves, conditionJoiner } from './sharedUtils'

describe('collectConditionLeaves', () => {
  it('flattens a real any-group rule (Payout) into its leaf conditions', () => {
    const payoutHighValueOrHold = {
      any: [
        { field: 'payout.totalAmountPaise', op: 'gt', value: 2500000 },
        { field: 'payout.hasHold', op: 'is_true' },
        { field: 'vendor.recentBankChange', op: 'is_true' },
      ],
    }

    const leaves = collectConditionLeaves(payoutHighValueOrHold)

    expect(leaves).toHaveLength(3)
    expect(leaves.map((leaf) => leaf.field)).toEqual([
      'payout.totalAmountPaise',
      'payout.hasHold',
      'vendor.recentBankChange',
    ])
  })

  it('flattens a real all-group rule (Payout standard review)', () => {
    const payoutStandard = {
      all: [
        { field: 'payout.totalAmountPaise', op: 'lte', value: 2500000 },
        { field: 'vendor.bankAccountStatus', op: 'eq', value: 'VERIFIED' },
        { field: 'payout.hasHold', op: 'is_false' },
        { field: 'vendor.recentBankChange', op: 'is_false' },
      ],
    }

    const leaves = collectConditionLeaves(payoutStandard)

    expect(leaves).toHaveLength(4)
  })

  it('unwraps a not-group down to its inner leaf', () => {
    const notVerified = {
      not: { field: 'vendor.bankAccountStatus', op: 'eq', value: 'VERIFIED' },
    }

    const leaves = collectConditionLeaves(notVerified)

    expect(leaves).toEqual([
      expect.objectContaining({ field: 'vendor.bankAccountStatus', op: 'eq' }),
    ])
  })
})

describe('conditionJoiner', () => {
  it('reads an any-group as "or" (the 4 real risk rules: Refund, Payout, Reel, Vendor bank account)', () => {
    expect(conditionJoiner({ any: [] })).toBe('or')
  })

  it('reads an all-group as "and"', () => {
    expect(conditionJoiner({ all: [] })).toBe('and')
  })
})
