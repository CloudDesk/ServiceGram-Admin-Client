import { describe, expect, it } from 'vitest'
import type { PolicyRule } from '../../types/settings.types'
import { DEFAULT_MEDIA_REEL_CONFIG } from '../types/mediaReelPolicy.types'
import {
  bpsToPercent,
  bytesToMb,
  configToFormValues,
  formValuesToConfig,
  formValuesToUpsertPayload,
  mbToBytes,
  minutesToMs,
  msToMinutes,
  msToSeconds,
  percentToBps,
  recordToFormValues,
  secondsToMs,
} from './mediaReelPolicy.mappers'

describe('unit conversion helpers', () => {
  it('converts megabytes to bytes and back', () => {
    expect(mbToBytes(100)).toBe(104_857_600)
    expect(bytesToMb(104_857_600)).toBe(100)
  })

  it('converts minutes to milliseconds and back', () => {
    expect(minutesToMs(15)).toBe(900_000)
    expect(msToMinutes(900_000)).toBe(15)
  })

  it('converts seconds to milliseconds and back', () => {
    expect(secondsToMs(60)).toBe(60_000)
    expect(msToSeconds(60_000)).toBe(60)
  })

  it('converts a percentage to basis points and back', () => {
    expect(percentToBps(3)).toBe(300)
    expect(bpsToPercent(300)).toBe(3)
  })
})

describe('configToFormValues / formValuesToConfig round trip', () => {
  it('maps the documented default config to friendly units and back losslessly', () => {
    const formSlice = configToFormValues(DEFAULT_MEDIA_REEL_CONFIG)

    expect(formSlice.reelDurationSeconds).toEqual([1, 60])
    expect(formSlice.maxReelSizeMB).toBe(100)
    expect(formSlice.allowedVideoFormats).toEqual(['MP4', 'MOV'])
    expect(formSlice.aspectRatioTolerancePercent).toBe(3)
    expect(formSlice.maxMusicTrackMinutes).toBe(15)
    expect(formSlice.maxMusicPreviewSeconds).toBe(60)

    const fullValues = recordToFormValues(null)
    const config = formValuesToConfig({ ...fullValues, ...formSlice })

    expect(config).toEqual(DEFAULT_MEDIA_REEL_CONFIG)
  })

  it('fills in defaults for a partial/legacy config', () => {
    const formSlice = configToFormValues({ maxReelSizeBytes: 52_428_800 })

    expect(formSlice.maxReelSizeMB).toBe(50)
    expect(formSlice.reelDurationSeconds).toEqual([
      DEFAULT_MEDIA_REEL_CONFIG.minReelDurationSeconds,
      DEFAULT_MEDIA_REEL_CONFIG.maxReelDurationSeconds,
    ])
  })
})

describe('formValuesToUpsertPayload', () => {
  it('derives a ruleKey from scope for a new GLOBAL rule and submits the complete config', () => {
    const values = recordToFormValues(null)
    values.displayName = 'Default content rules'

    const payload = formValuesToUpsertPayload(values, null, 'Initial rollout')

    expect(payload.family).toBe('MEDIA_REEL_RULE')
    expect(payload.ruleKey).toBe('media.reels.global.global')
    expect(payload.scopeType).toBe('GLOBAL')
    expect(payload.categoryId).toBeNull()
    expect(payload.expectedVersion).toBeUndefined()
    expect(payload.reason).toBe('Initial rollout')
    expect(Object.keys(payload.config ?? {})).toHaveLength(
      Object.keys(DEFAULT_MEDIA_REEL_CONFIG).length,
    )
  })

  it('keeps the existing ruleKey unchanged when editing a record', () => {
    const record = {
      policyRuleId: 'rule-1',
      family: 'MEDIA_REEL_RULE',
      ruleKey: 'media.reels.category.grooming',
      displayName: 'Grooming reels',
      description: null,
      status: 'ACTIVE',
      priority: 50,
      scope: { scopeType: 'CATEGORY', categoryId: 'cat-1', city: null, zoneId: null, vendorId: null },
      config: DEFAULT_MEDIA_REEL_CONFIG as unknown as Record<string, unknown>,
      metadata: {},
      version: 2,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
      availableActions: ['EDIT'],
    } satisfies PolicyRule

    const values = recordToFormValues(record)
    const payload = formValuesToUpsertPayload(values, record, 'Tweak grooming limits')

    expect(payload.ruleKey).toBe('media.reels.category.grooming')
    expect(payload.categoryId).toBe('cat-1')
    expect(payload.expectedVersion).toBe(2)
  })
})
