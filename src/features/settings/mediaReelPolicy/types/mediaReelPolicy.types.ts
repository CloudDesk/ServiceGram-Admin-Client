import type {
  PolicyScopeType,
  PolicyStatus,
} from '../../types/settings.types'

/** The MEDIA_REEL_RULE `config` shape, exactly as the backend stores it (bytes/ms/bps). */
export interface MediaReelConfig {
  minReelDurationSeconds: number
  maxReelDurationSeconds: number
  maxReelSizeBytes: number
  allowedVideoMimeTypes: string[]
  requiredReelAspectRatio: string
  reelAspectRatioToleranceBps: number
  minReelWidth: number
  minReelHeight: number
  maxReelWidth: number
  maxReelHeight: number
  autoSubmitAfterUpload: boolean
  autoPublishAfterApproval: boolean
  vendorDailyUploadLimit: number
  maxImageSizeBytes: number
  allowedImageMimeTypes: string[]
  maxStoryImageSizeBytes: number
  allowedStoryImageMimeTypes: string[]
  maxMusicTrackDurationMs: number
  maxMusicPreviewDurationMs: number
  maxMusicTrackAudioSizeBytes: number
  maxMusicArtworkSizeBytes: number
  maxCreatorAudioSizeBytes: number
  maxReelMusicSelectionDurationMs: number
  allowedAudioMimeTypes: string[]
  maxDocumentSizeBytes: number
  maxProofImageSizeBytes: number
}

export type ReelAspectRatio = '9:16' | '1:1' | '16:9'

export const REEL_ASPECT_RATIO_OPTIONS: { value: ReelAspectRatio; label: string }[] = [
  { value: '9:16', label: 'Portrait' },
  { value: '1:1', label: 'Square' },
  { value: '16:9', label: 'Landscape' },
]

interface FormatOption {
  value: string
  label: string
  mimeTypes: string[]
}

export const VIDEO_FORMAT_OPTIONS: FormatOption[] = [
  { value: 'MP4', label: 'MP4', mimeTypes: ['video/mp4'] },
  { value: 'MOV', label: 'MOV', mimeTypes: ['video/quicktime'] },
  { value: 'WEBM', label: 'WebM', mimeTypes: ['video/webm'] },
]

export const IMAGE_FORMAT_OPTIONS: FormatOption[] = [
  { value: 'JPEG', label: 'JPEG', mimeTypes: ['image/jpeg'] },
  { value: 'PNG', label: 'PNG', mimeTypes: ['image/png'] },
  { value: 'WEBP', label: 'WEBP', mimeTypes: ['image/webp'] },
]

export const AUDIO_FORMAT_OPTIONS: FormatOption[] = [
  { value: 'AAC', label: 'AAC', mimeTypes: ['audio/aac'] },
  { value: 'MP4_AUDIO', label: 'MP4 Audio', mimeTypes: ['audio/mp4'] },
  { value: 'MP3', label: 'MP3', mimeTypes: ['audio/mpeg'] },
  { value: 'OGG', label: 'OGG', mimeTypes: ['audio/ogg'] },
  { value: 'WAV', label: 'WAV', mimeTypes: ['audio/wav', 'audio/x-wav'] },
]

/** The friendly, non-technical shape the visual editor works with (seconds/MB/px/%). */
export interface MediaReelPolicyFormValues {
  displayName: string
  description: string
  status: PolicyStatus
  priority: number
  scopeType: PolicyScopeType
  categoryId: string
  categoryLabel: string
  city: string
  zoneId: string
  zoneLabel: string
  vendorId: string
  vendorLabel: string
  effectiveFrom: string
  effectiveTo: string

  reelDurationSeconds: [number, number]
  maxReelSizeMB: number
  allowedVideoFormats: string[]
  reelAspectRatio: ReelAspectRatio
  aspectRatioTolerancePercent: number
  minReelWidth: number
  minReelHeight: number
  maxReelWidth: number
  maxReelHeight: number
  vendorDailyUploadLimit: number

  maxImageSizeMB: number
  allowedImageFormats: string[]
  maxStoryImageSizeMB: number
  allowedStoryImageFormats: string[]

  maxMusicTrackMinutes: number
  maxMusicPreviewSeconds: number
  maxMusicTrackAudioSizeMB: number
  maxMusicArtworkSizeMB: number
  maxCreatorAudioSizeMB: number
  maxReelMusicSelectionSeconds: number
  allowedAudioFormats: string[]

  maxDocumentSizeMB: number
  maxProofImageSizeMB: number

  autoSubmitAfterUpload: boolean
  autoPublishAfterApproval: boolean
}

export const RESOLUTION_PRESETS: {
  label: string
  minWidth: number
  minHeight: number
  maxWidth: number
  maxHeight: number
}[] = [
  { label: 'HD (720×1280)', minWidth: 720, minHeight: 1280, maxWidth: 1080, maxHeight: 1920 },
  { label: 'Full HD (1080×1920)', minWidth: 1080, minHeight: 1920, maxWidth: 1080, maxHeight: 1920 },
  { label: '4K (2160×3840)', minWidth: 1080, minHeight: 1920, maxWidth: 2160, maxHeight: 3840 },
]

/** Example payload from the API contract, used as the "Start from default rules" fallback. */
export const DEFAULT_MEDIA_REEL_CONFIG: MediaReelConfig = {
  minReelDurationSeconds: 1,
  maxReelDurationSeconds: 60,
  maxReelSizeBytes: 104_857_600,
  allowedVideoMimeTypes: ['video/mp4', 'video/quicktime'],
  requiredReelAspectRatio: '9:16',
  reelAspectRatioToleranceBps: 300,
  minReelWidth: 720,
  minReelHeight: 1280,
  maxReelWidth: 2160,
  maxReelHeight: 3840,
  autoSubmitAfterUpload: false,
  autoPublishAfterApproval: false,
  vendorDailyUploadLimit: 10,
  maxImageSizeBytes: 5_242_880,
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxStoryImageSizeBytes: 5_242_880,
  allowedStoryImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxMusicTrackDurationMs: 900_000,
  maxMusicPreviewDurationMs: 60_000,
  maxMusicTrackAudioSizeBytes: 52_428_800,
  maxMusicArtworkSizeBytes: 5_242_880,
  maxCreatorAudioSizeBytes: 52_428_800,
  maxReelMusicSelectionDurationMs: 60_000,
  allowedAudioMimeTypes: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav'],
  maxDocumentSizeBytes: 10_485_760,
  maxProofImageSizeBytes: 5_242_880,
}
