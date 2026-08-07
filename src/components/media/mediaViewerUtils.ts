import type { MediaViewerKind } from './MediaViewer.types'

const imageExtensions = ['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']
const videoExtensions = ['.m3u8', '.mov', '.mp4', '.mpeg', '.webm']

function normalizedExtensionSource(value: string | null | undefined) {
  if (!value) return ''

  try {
    const url = new URL(value)
    return decodeURIComponent(url.pathname).toLowerCase()
  } catch {
    return value.toLowerCase()
  }
}

function hasExtension(value: string, extensions: string[]) {
  return extensions.some((extension) => value.endsWith(extension))
}

function hasAnyExtension(values: string[], extensions: string[]) {
  return values.some((value) => hasExtension(value, extensions))
}

export function isOpenableMediaUrl(value: string | null | undefined): value is string {
  if (!value) return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function inferMediaViewerKind({
  fileName,
  mimeType,
  src,
}: {
  fileName?: string | null
  mimeType?: string | null
  src?: string | null
}): MediaViewerKind {
  const normalizedMimeType = mimeType?.toLowerCase() ?? ''
  const extensionSources = [
    normalizedExtensionSource(fileName),
    normalizedExtensionSource(src),
  ].filter(Boolean)

  if (normalizedMimeType.startsWith('image/')) return 'image'
  if (normalizedMimeType.startsWith('video/')) return 'video'
  if (normalizedMimeType === 'application/pdf') return 'pdf'
  if (hasAnyExtension(extensionSources, imageExtensions)) return 'image'
  if (hasAnyExtension(extensionSources, videoExtensions)) return 'video'
  if (extensionSources.some((value) => value.endsWith('.pdf'))) return 'pdf'

  return 'document'
}

export function formatMediaFileSize(value: number | null | undefined) {
  if (value == null) return 'Size unavailable'

  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

export function mediaKindLabel(kind: MediaViewerKind) {
  if (kind === 'cloudflare-video' || kind === 'video') return 'Video'
  if (kind === 'image') return 'Image'
  if (kind === 'pdf') return 'PDF'
  if (kind === 'reel') return 'Reel media'
  return 'Document'
}
