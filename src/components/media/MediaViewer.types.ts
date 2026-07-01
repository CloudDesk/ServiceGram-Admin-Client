export type MediaViewerKind =
  | 'cloudflare-video'
  | 'document'
  | 'image'
  | 'pdf'
  | 'reel'
  | 'video'

export interface MediaViewerItem {
  id: string
  kind: MediaViewerKind
  title: string
  src?: string | null
  downloadUrl?: string | null
  posterUrl?: string | null
  cloudflareVideoUid?: string | null
  description?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  width?: number | null
  height?: number | null
  expiresAt?: string | null
  providerStatus?: string | null
  warnings?: string[]
  ownerLabel?: string | null
  sourceLabel?: string | null
  relatedItems?: MediaViewerItem[]
}

export interface OpenMediaViewerInput {
  items: MediaViewerItem[]
  startIndex?: number
}

export interface MediaViewerContextValue {
  closeMediaViewer: () => void
  openMediaViewer: (input: OpenMediaViewerInput) => void
}
