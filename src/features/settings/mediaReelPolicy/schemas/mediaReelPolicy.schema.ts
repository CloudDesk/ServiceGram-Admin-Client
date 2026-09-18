import { z } from 'zod'

export const mediaReelPolicyFormSchema = z
  .object({
    displayName: z.string().trim().min(3, 'Name must be at least 3 characters.'),
    description: z.string(),
    status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
    priority: z.number().int().min(0, 'Rule order must be 0 or greater.'),
    scopeType: z.enum(['GLOBAL', 'CATEGORY', 'CITY', 'ZONE', 'VENDOR']),
    categoryId: z.string(),
    categoryLabel: z.string(),
    city: z.string(),
    zoneId: z.string(),
    zoneLabel: z.string(),
    vendorId: z.string(),
    vendorLabel: z.string(),
    effectiveFrom: z.string().min(1, 'Choose when this rule becomes active.'),
    effectiveTo: z.string(),

    reelDurationSeconds: z.tuple([
      z.number().min(1, 'Minimum reel length must be at least 1 second.'),
      z.number().max(3600, 'Maximum reel length must be 3600 seconds or less.'),
    ]),
    maxReelSizeMB: z.number().positive('Enter a size greater than 0.'),
    allowedVideoFormats: z.array(z.string()).min(1, 'Select at least one video format.'),
    reelAspectRatio: z.enum(['9:16', '1:1', '16:9']),
    aspectRatioTolerancePercent: z.number().min(0).max(100),
    minReelWidth: z.number().positive(),
    minReelHeight: z.number().positive(),
    maxReelWidth: z.number().positive(),
    maxReelHeight: z.number().positive(),
    vendorDailyUploadLimit: z.number().int().positive(),

    maxImageSizeMB: z.number().positive(),
    allowedImageFormats: z.array(z.string()).min(1, 'Select at least one photo format.'),
    maxStoryImageSizeMB: z.number().positive(),
    allowedStoryImageFormats: z.array(z.string()).min(1, 'Select at least one story format.'),

    maxMusicTrackMinutes: z.number().positive(),
    maxMusicPreviewSeconds: z.number().positive(),
    maxMusicTrackAudioSizeMB: z.number().positive(),
    maxMusicArtworkSizeMB: z.number().positive(),
    maxCreatorAudioSizeMB: z.number().positive(),
    maxReelMusicSelectionSeconds: z.number().positive(),
    allowedAudioFormats: z.array(z.string()).min(1, 'Select at least one audio format.'),

    maxDocumentSizeMB: z.number().positive(),
    maxProofImageSizeMB: z.number().positive(),

    autoSubmitAfterUpload: z.boolean(),
    autoPublishAfterApproval: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const [minDuration, maxDuration] = values.reelDurationSeconds
    if (minDuration > maxDuration) {
      ctx.addIssue({
        code: 'custom',
        message: 'Minimum reel length cannot be greater than the maximum.',
        path: ['reelDurationSeconds'],
      })
    }

    if (values.minReelWidth > values.maxReelWidth) {
      ctx.addIssue({
        code: 'custom',
        message: 'Minimum width cannot be greater than the maximum width.',
        path: ['maxReelWidth'],
      })
    }

    if (values.minReelHeight > values.maxReelHeight) {
      ctx.addIssue({
        code: 'custom',
        message: 'Minimum height cannot be greater than the maximum height.',
        path: ['maxReelHeight'],
      })
    }

    if (values.maxMusicPreviewSeconds * 1000 > values.maxMusicTrackMinutes * 60_000) {
      ctx.addIssue({
        code: 'custom',
        message: 'Preview length cannot be longer than the track length.',
        path: ['maxMusicPreviewSeconds'],
      })
    }

    if (values.maxReelMusicSelectionSeconds * 1000 > values.maxMusicTrackMinutes * 60_000) {
      ctx.addIssue({
        code: 'custom',
        message: 'Soundtrack selection cannot be longer than the track length.',
        path: ['maxReelMusicSelectionSeconds'],
      })
    }

    if (values.effectiveTo.trim()) {
      const from = new Date(values.effectiveFrom).getTime()
      const to = new Date(values.effectiveTo).getTime()
      if (!Number.isNaN(from) && !Number.isNaN(to) && to < from) {
        ctx.addIssue({
          code: 'custom',
          message: 'End date cannot be before the start date.',
          path: ['effectiveTo'],
        })
      }
    }

    if (values.scopeType === 'CATEGORY' && !values.categoryId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a category for this rule.',
        path: ['categoryId'],
      })
    }
    if (values.scopeType === 'CITY' && !values.city.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a city for this rule.',
        path: ['city'],
      })
    }
    if (values.scopeType === 'ZONE' && !values.zoneId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a zone for this rule.',
        path: ['zoneId'],
      })
    }
    if (values.scopeType === 'VENDOR' && !values.vendorId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a vendor for this rule.',
        path: ['vendorId'],
      })
    }
  })

export type MediaReelPolicyFormSchema = z.infer<typeof mediaReelPolicyFormSchema>

export const mediaReelPolicyReasonSchema = z
  .string()
  .trim()
  .min(3, 'Reason must be at least 3 characters.')
