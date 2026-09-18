import type { PolicyRule, UpsertPolicyRulePayload } from '../../types/settings.types'
import {
  AUDIO_FORMAT_OPTIONS,
  DEFAULT_MEDIA_REEL_CONFIG,
  IMAGE_FORMAT_OPTIONS,
  VIDEO_FORMAT_OPTIONS,
  type MediaReelConfig,
  type MediaReelPolicyFormValues,
  type ReelAspectRatio,
} from '../types/mediaReelPolicy.types'

const BYTES_PER_MB = 1024 * 1024

export function mbToBytes(mb: number) {
  return Math.round(mb * BYTES_PER_MB)
}

export function bytesToMb(bytes: number) {
  return Math.round((bytes / BYTES_PER_MB) * 100) / 100
}

export function minutesToMs(minutes: number) {
  return Math.round(minutes * 60_000)
}

export function msToMinutes(ms: number) {
  return Math.round((ms / 60_000) * 100) / 100
}

export function secondsToMs(seconds: number) {
  return Math.round(seconds * 1000)
}

export function msToSeconds(ms: number) {
  return Math.round((ms / 1000) * 100) / 100
}

export function percentToBps(percent: number) {
  return Math.round(percent * 100)
}

export function bpsToPercent(bps: number) {
  return Math.round((bps / 100) * 100) / 100
}

function formatsToMimeTypes(selected: string[], options: typeof VIDEO_FORMAT_OPTIONS) {
  const mimeTypes = new Set<string>()
  for (const format of selected) {
    const option = options.find((item) => item.value === format)
    option?.mimeTypes.forEach((mime) => mimeTypes.add(mime))
  }
  return Array.from(mimeTypes)
}

function mimeTypesToFormats(mimeTypes: string[], options: typeof VIDEO_FORMAT_OPTIONS) {
  const mimeSet = new Set(mimeTypes)
  return options
    .filter((option) => option.mimeTypes.some((mime) => mimeSet.has(mime)))
    .map((option) => option.value)
}

/** Merges a (possibly partial/legacy) backend config over the documented defaults. */
export function configToFormValues(
  config: Partial<MediaReelConfig> | null | undefined,
): Omit<
  MediaReelPolicyFormValues,
  | 'displayName'
  | 'description'
  | 'status'
  | 'priority'
  | 'scopeType'
  | 'categoryId'
  | 'categoryLabel'
  | 'city'
  | 'zoneId'
  | 'zoneLabel'
  | 'vendorId'
  | 'vendorLabel'
  | 'effectiveFrom'
  | 'effectiveTo'
> {
  const merged: MediaReelConfig = { ...DEFAULT_MEDIA_REEL_CONFIG, ...(config ?? {}) }

  return {
    reelDurationSeconds: [merged.minReelDurationSeconds, merged.maxReelDurationSeconds],
    maxReelSizeMB: bytesToMb(merged.maxReelSizeBytes),
    allowedVideoFormats: mimeTypesToFormats(merged.allowedVideoMimeTypes, VIDEO_FORMAT_OPTIONS),
    reelAspectRatio: (merged.requiredReelAspectRatio as ReelAspectRatio) || '9:16',
    aspectRatioTolerancePercent: bpsToPercent(merged.reelAspectRatioToleranceBps),
    minReelWidth: merged.minReelWidth,
    minReelHeight: merged.minReelHeight,
    maxReelWidth: merged.maxReelWidth,
    maxReelHeight: merged.maxReelHeight,
    vendorDailyUploadLimit: merged.vendorDailyUploadLimit,

    maxImageSizeMB: bytesToMb(merged.maxImageSizeBytes),
    allowedImageFormats: mimeTypesToFormats(merged.allowedImageMimeTypes, IMAGE_FORMAT_OPTIONS),
    maxStoryImageSizeMB: bytesToMb(merged.maxStoryImageSizeBytes),
    allowedStoryImageFormats: mimeTypesToFormats(
      merged.allowedStoryImageMimeTypes,
      IMAGE_FORMAT_OPTIONS,
    ),

    maxMusicTrackMinutes: msToMinutes(merged.maxMusicTrackDurationMs),
    maxMusicPreviewSeconds: msToSeconds(merged.maxMusicPreviewDurationMs),
    maxMusicTrackAudioSizeMB: bytesToMb(merged.maxMusicTrackAudioSizeBytes),
    maxMusicArtworkSizeMB: bytesToMb(merged.maxMusicArtworkSizeBytes),
    maxCreatorAudioSizeMB: bytesToMb(merged.maxCreatorAudioSizeBytes),
    maxReelMusicSelectionSeconds: msToSeconds(merged.maxReelMusicSelectionDurationMs),
    allowedAudioFormats: mimeTypesToFormats(merged.allowedAudioMimeTypes, AUDIO_FORMAT_OPTIONS),

    maxDocumentSizeMB: bytesToMb(merged.maxDocumentSizeBytes),
    maxProofImageSizeMB: bytesToMb(merged.maxProofImageSizeBytes),

    autoSubmitAfterUpload: merged.autoSubmitAfterUpload,
    autoPublishAfterApproval: merged.autoPublishAfterApproval,
  }
}

export function formValuesToConfig(values: MediaReelPolicyFormValues): MediaReelConfig {
  return {
    minReelDurationSeconds: values.reelDurationSeconds[0],
    maxReelDurationSeconds: values.reelDurationSeconds[1],
    maxReelSizeBytes: mbToBytes(values.maxReelSizeMB),
    allowedVideoMimeTypes: formatsToMimeTypes(values.allowedVideoFormats, VIDEO_FORMAT_OPTIONS),
    requiredReelAspectRatio: values.reelAspectRatio,
    reelAspectRatioToleranceBps: percentToBps(values.aspectRatioTolerancePercent),
    minReelWidth: values.minReelWidth,
    minReelHeight: values.minReelHeight,
    maxReelWidth: values.maxReelWidth,
    maxReelHeight: values.maxReelHeight,
    autoSubmitAfterUpload: values.autoSubmitAfterUpload,
    autoPublishAfterApproval: values.autoPublishAfterApproval,
    vendorDailyUploadLimit: values.vendorDailyUploadLimit,
    maxImageSizeBytes: mbToBytes(values.maxImageSizeMB),
    allowedImageMimeTypes: formatsToMimeTypes(values.allowedImageFormats, IMAGE_FORMAT_OPTIONS),
    maxStoryImageSizeBytes: mbToBytes(values.maxStoryImageSizeMB),
    allowedStoryImageMimeTypes: formatsToMimeTypes(
      values.allowedStoryImageFormats,
      IMAGE_FORMAT_OPTIONS,
    ),
    maxMusicTrackDurationMs: minutesToMs(values.maxMusicTrackMinutes),
    maxMusicPreviewDurationMs: secondsToMs(values.maxMusicPreviewSeconds),
    maxMusicTrackAudioSizeBytes: mbToBytes(values.maxMusicTrackAudioSizeMB),
    maxMusicArtworkSizeBytes: mbToBytes(values.maxMusicArtworkSizeMB),
    maxCreatorAudioSizeBytes: mbToBytes(values.maxCreatorAudioSizeMB),
    maxReelMusicSelectionDurationMs: secondsToMs(values.maxReelMusicSelectionSeconds),
    allowedAudioMimeTypes: formatsToMimeTypes(values.allowedAudioFormats, AUDIO_FORMAT_OPTIONS),
    maxDocumentSizeBytes: mbToBytes(values.maxDocumentSizeMB),
    maxProofImageSizeBytes: mbToBytes(values.maxProofImageSizeMB),
  }
}

function toDateTimeInputValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function fromDateTimeInputValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Date values must be valid.')
  }
  return date.toISOString()
}

function defaultEffectiveFrom() {
  return toDateTimeInputValue(new Date().toISOString())
}

export function recordToFormValues(record: PolicyRule | null): MediaReelPolicyFormValues {
  const config = configToFormValues(record?.config as Partial<MediaReelConfig> | undefined)

  return {
    displayName: record?.displayName ?? '',
    description: record?.description ?? '',
    status: record?.status ?? 'DRAFT',
    priority: record?.priority ?? 100,
    scopeType: record?.scope.scopeType ?? 'GLOBAL',
    categoryId: record?.scope.categoryId ?? '',
    categoryLabel: '',
    city: record?.scope.city ?? '',
    zoneId: record?.scope.zoneId ?? '',
    zoneLabel: '',
    vendorId: record?.scope.vendorId ?? '',
    vendorLabel: '',
    effectiveFrom: record ? toDateTimeInputValue(record.effectiveFrom) : defaultEffectiveFrom(),
    effectiveTo: record ? toDateTimeInputValue(record.effectiveTo) : '',
    ...config,
  }
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/(^-+|-+$)/g, '') || 'rule'
  )
}

function deriveRuleKey(values: MediaReelPolicyFormValues) {
  const scopeSlug =
    values.scopeType === 'GLOBAL'
      ? 'global'
      : values.scopeType === 'CATEGORY'
        ? slugify(values.categoryLabel || values.categoryId)
        : values.scopeType === 'CITY'
          ? slugify(values.city)
          : values.scopeType === 'ZONE'
            ? slugify(values.zoneLabel || values.zoneId)
            : slugify(values.vendorLabel || values.vendorId)

  return `media.reels.${values.scopeType.toLowerCase()}.${scopeSlug}`
}

export function formValuesToUpsertPayload(
  values: MediaReelPolicyFormValues,
  existingRecord: PolicyRule | null,
  reason: string,
): UpsertPolicyRulePayload {
  return {
    family: 'MEDIA_REEL_RULE',
    ruleKey: existingRecord?.ruleKey ?? deriveRuleKey(values),
    displayName: values.displayName.trim(),
    description: values.description.trim() || null,
    status: values.status,
    priority: values.priority,
    scopeType: values.scopeType,
    categoryId: values.scopeType === 'CATEGORY' ? values.categoryId || null : null,
    city: values.scopeType === 'CITY' ? values.city.trim() || null : null,
    zoneId: values.scopeType === 'ZONE' ? values.zoneId || null : null,
    vendorId: values.scopeType === 'VENDOR' ? values.vendorId || null : null,
    config: formValuesToConfig(values) as unknown as Record<string, unknown>,
    metadata: existingRecord?.metadata ?? {},
    effectiveFrom: fromDateTimeInputValue(values.effectiveFrom),
    effectiveTo: values.effectiveTo.trim() ? fromDateTimeInputValue(values.effectiveTo) : null,
    // Required by the backend once a rule exists (POLICY_RULE_VERSION_REQUIRED
    // otherwise); must stay unset on create, where `existingRecord` is null.
    expectedVersion: existingRecord?.version,
    reason: reason.trim(),
  }
}

export interface MediaReelPolicyDiffEntry {
  field: string
  label: string
  before: string
  after: string
}

const FORMAT_LABEL_LOOKUP = new Map(
  [...VIDEO_FORMAT_OPTIONS, ...IMAGE_FORMAT_OPTIONS, ...AUDIO_FORMAT_OPTIONS].map((option) => [
    option.value,
    option.label,
  ]),
)

function formatFormatList(values: string[]) {
  if (values.length === 0) return 'None'
  return values.map((value) => FORMAT_LABEL_LOOKUP.get(value) ?? value).join(', ')
}

function formatBoolean(value: boolean) {
  return value ? 'On' : 'Off'
}

interface DiffFieldDescriptor {
  field: keyof MediaReelPolicyFormValues
  label: string
  format: (values: MediaReelPolicyFormValues) => string
}

const DIFF_FIELDS: DiffFieldDescriptor[] = [
  { field: 'displayName', label: 'Name', format: (v) => v.displayName || '—' },
  { field: 'status', label: 'Status', format: (v) => v.status },
  { field: 'priority', label: 'Rule order', format: (v) => String(v.priority) },
  { field: 'scopeType', label: 'Applies to', format: (v) => v.scopeType },
  {
    field: 'reelDurationSeconds',
    label: 'Reel length',
    format: (v) => `${v.reelDurationSeconds[0]}–${v.reelDurationSeconds[1]} sec`,
  },
  { field: 'maxReelSizeMB', label: 'Reel max size', format: (v) => `${v.maxReelSizeMB} MB` },
  {
    field: 'allowedVideoFormats',
    label: 'Video formats',
    format: (v) => formatFormatList(v.allowedVideoFormats),
  },
  { field: 'reelAspectRatio', label: 'Portrait format', format: (v) => v.reelAspectRatio },
  {
    field: 'aspectRatioTolerancePercent',
    label: 'Aspect ratio tolerance',
    format: (v) => `${v.aspectRatioTolerancePercent}%`,
  },
  {
    field: 'minReelWidth',
    label: 'Resolution',
    format: (v) => `${v.minReelWidth}×${v.minReelHeight} – ${v.maxReelWidth}×${v.maxReelHeight}`,
  },
  {
    field: 'vendorDailyUploadLimit',
    label: 'Daily uploads',
    format: (v) => String(v.vendorDailyUploadLimit),
  },
  { field: 'maxImageSizeMB', label: 'Photo max size', format: (v) => `${v.maxImageSizeMB} MB` },
  {
    field: 'allowedImageFormats',
    label: 'Photo formats',
    format: (v) => formatFormatList(v.allowedImageFormats),
  },
  {
    field: 'maxStoryImageSizeMB',
    label: 'Story max size',
    format: (v) => `${v.maxStoryImageSizeMB} MB`,
  },
  {
    field: 'allowedStoryImageFormats',
    label: 'Story formats',
    format: (v) => formatFormatList(v.allowedStoryImageFormats),
  },
  {
    field: 'maxMusicTrackMinutes',
    label: 'Track length',
    format: (v) => `${v.maxMusicTrackMinutes} min`,
  },
  {
    field: 'maxMusicPreviewSeconds',
    label: 'Preview length',
    format: (v) => `${v.maxMusicPreviewSeconds} sec`,
  },
  {
    field: 'maxMusicTrackAudioSizeMB',
    label: 'Audio file size',
    format: (v) => `${v.maxMusicTrackAudioSizeMB} MB`,
  },
  {
    field: 'maxMusicArtworkSizeMB',
    label: 'Artwork size',
    format: (v) => `${v.maxMusicArtworkSizeMB} MB`,
  },
  {
    field: 'maxCreatorAudioSizeMB',
    label: 'Creator upload size',
    format: (v) => `${v.maxCreatorAudioSizeMB} MB`,
  },
  {
    field: 'maxReelMusicSelectionSeconds',
    label: 'Max soundtrack selection',
    format: (v) => `${v.maxReelMusicSelectionSeconds} sec`,
  },
  {
    field: 'allowedAudioFormats',
    label: 'Audio formats',
    format: (v) => formatFormatList(v.allowedAudioFormats),
  },
  {
    field: 'maxDocumentSizeMB',
    label: 'Document max size',
    format: (v) => `${v.maxDocumentSizeMB} MB`,
  },
  {
    field: 'maxProofImageSizeMB',
    label: 'Proof photo max size',
    format: (v) => `${v.maxProofImageSizeMB} MB`,
  },
  {
    field: 'autoSubmitAfterUpload',
    label: 'Submit automatically',
    format: (v) => formatBoolean(v.autoSubmitAfterUpload),
  },
  {
    field: 'autoPublishAfterApproval',
    label: 'Publish automatically',
    format: (v) => formatBoolean(v.autoPublishAfterApproval),
  },
]

export function diffFormValues(
  before: MediaReelPolicyFormValues,
  after: MediaReelPolicyFormValues,
): MediaReelPolicyDiffEntry[] {
  return DIFF_FIELDS.filter((descriptor) => descriptor.format(before) !== descriptor.format(after)).map(
    (descriptor) => ({
      field: descriptor.field,
      label: descriptor.label,
      before: descriptor.format(before),
      after: descriptor.format(after),
    }),
  )
}
