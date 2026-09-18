import { describe, expect, it } from 'vitest'
import { recordToFormValues } from '../mappers/mediaReelPolicy.mappers'
import { mediaReelPolicyFormSchema } from './mediaReelPolicy.schema'

function validValues() {
  return recordToFormValues(null)
}

describe('mediaReelPolicyFormSchema', () => {
  it('accepts the default form values', () => {
    const values = validValues()
    values.displayName = 'Default content rules'

    const result = mediaReelPolicyFormSchema.safeParse(values)

    expect(result.success).toBe(true)
  })

  it('rejects a minimum reel duration greater than the maximum', () => {
    const values = validValues()
    values.displayName = 'Default content rules'
    values.reelDurationSeconds = [90, 30]

    const result = mediaReelPolicyFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(
      result.success ? [] : result.error.issues.some((issue) => issue.path[0] === 'reelDurationSeconds'),
    ).toBe(true)
  })

  it('rejects a minimum resolution greater than the maximum', () => {
    const values = validValues()
    values.displayName = 'Default content rules'
    values.minReelWidth = 2000
    values.maxReelWidth = 1000

    const result = mediaReelPolicyFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(
      result.success ? [] : result.error.issues.some((issue) => issue.path[0] === 'maxReelWidth'),
    ).toBe(true)
  })

  it('rejects a music preview longer than the track', () => {
    const values = validValues()
    values.displayName = 'Default content rules'
    values.maxMusicTrackMinutes = 1
    values.maxMusicPreviewSeconds = 120

    const result = mediaReelPolicyFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(
      result.success
        ? []
        : result.error.issues.some((issue) => issue.path[0] === 'maxMusicPreviewSeconds'),
    ).toBe(true)
  })

  it.each([
    ['CATEGORY', 'categoryId'],
    ['CITY', 'city'],
    ['ZONE', 'zoneId'],
    ['VENDOR', 'vendorId'],
  ] as const)('requires a %s scope value to be set', (scopeType, field) => {
    const values = validValues()
    values.displayName = 'Default content rules'
    values.scopeType = scopeType

    const result = mediaReelPolicyFormSchema.safeParse(values)

    expect(result.success).toBe(false)
    expect(result.success ? [] : result.error.issues.some((issue) => issue.path[0] === field)).toBe(
      true,
    )
  })

  it('rejects a format group with no selections', () => {
    const values = validValues()
    values.displayName = 'Default content rules'
    values.allowedVideoFormats = []

    const result = mediaReelPolicyFormSchema.safeParse(values)

    expect(result.success).toBe(false)
  })
})
