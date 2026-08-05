import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  Info,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { PDFViewer } from '@embedpdf/react-pdf-viewer'
import Lightbox, { type Slide } from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails'
import Video from 'yet-another-react-lightbox/plugins/video'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'
import { Button } from '../ui/Button'
import { useTheme } from '../../providers/themeContext'
import { cn } from '../../utils/cn'
import type { MediaViewerItem } from './MediaViewer.types'
import {
  formatMediaFileSize,
  isOpenableMediaUrl,
  mediaKindLabel,
} from './mediaViewerUtils'

interface MediaViewerDialogProps {
  items: MediaViewerItem[]
  startIndex: number
  onClose: () => void
}

interface LightboxEntry {
  item: MediaViewerItem
  originalIndex: number
  slide: Slide
}

const mediaWarningLabels: Record<string, string> = {
  VENDOR_APPROVED_DOCUMENT_LOCKED: 'Document locked after vendor approval',
}

function isLightboxItem(item: MediaViewerItem) {
  return item.kind === 'image' || item.kind === 'video'
}

function isVideoMediaItem(item: MediaViewerItem) {
  return item.kind === 'cloudflare-video' || item.kind === 'video'
}

function buildDescription(item: MediaViewerItem) {
  return [
    item.description,
    item.ownerLabel,
    item.mimeType,
    item.sizeBytes == null ? null : formatMediaFileSize(item.sizeBytes),
  ]
    .filter(Boolean)
    .join(' · ')
}

function toLightboxSlide(item: MediaViewerItem): Slide | null {
  const src = item.src ?? item.downloadUrl

  if (!isOpenableMediaUrl(src)) return null

  const shared = {
    description: buildDescription(item),
    title: item.title,
  }

  if (item.kind === 'image') {
    return {
      ...shared,
      alt: item.title,
      height: item.height ?? undefined,
      src,
      type: 'image',
      width: item.width ?? undefined,
    } satisfies Slide
  }

  if (item.kind === 'video') {
    return {
      ...shared,
      height: item.height ?? undefined,
      poster: item.posterUrl ?? undefined,
      sources: [
        {
          src,
          type: item.mimeType?.startsWith('video/') ? item.mimeType : 'video/mp4',
        },
      ],
      type: 'video',
      width: item.width ?? undefined,
    } as Slide
  }

  return null
}

function humanizeMediaCode(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const explicitLabel = mediaWarningLabels[trimmed]
  if (explicitLabel) return explicitLabel

  if (!/^[A-Z0-9_-]+$/.test(trimmed)) return trimmed

  return trimmed
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function metadataRows(item: MediaViewerItem) {
  return [
    { label: 'Type', value: mediaKindLabel(item.kind) },
    { label: 'File', value: item.fileName },
    { label: 'MIME', value: item.mimeType },
    {
      label: 'Size',
      value: item.sizeBytes == null ? null : formatMediaFileSize(item.sizeBytes),
    },
    { label: 'Source', value: humanizeMediaCode(item.sourceLabel) },
    { label: 'Owner', value: humanizeMediaCode(item.ownerLabel) },
  ].filter((row) => Boolean(row.value))
}

function openExternal(url: string | null | undefined) {
  if (isOpenableMediaUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function isCloudflareStreamHost(hostname: string) {
  const normalizedHostname = hostname.toLowerCase()

  return (
    normalizedHostname === 'videodelivery.net' ||
    normalizedHostname.endsWith('.videodelivery.net') ||
    normalizedHostname === 'cloudflarestream.com' ||
    normalizedHostname.endsWith('.cloudflarestream.com')
  )
}

function getCloudflarePlaybackIdFromUrl(value: string | null | undefined) {
  if (!isOpenableMediaUrl(value)) return null

  try {
    const url = new URL(value)

    if (!isCloudflareStreamHost(url.hostname)) return null

    return url.pathname.split('/').filter(Boolean)[0] ?? null
  } catch {
    return null
  }
}

function resolveCloudflareStreamSrc(item: MediaViewerItem) {
  return (
    getCloudflarePlaybackIdFromUrl(item.src) ??
    getCloudflarePlaybackIdFromUrl(item.downloadUrl) ??
    item.cloudflareVideoUid ??
    null
  )
}

function getMediaAspectRatio(item: MediaViewerItem, fallback = '16 / 9') {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return `${item.width} / ${item.height}`
  }

  return fallback
}

function isPortraitMedia(item: MediaViewerItem) {
  return Boolean(item.width && item.height && item.height > item.width)
}

function buildCloudflareIframeSrc(
  playbackId: string,
  item: MediaViewerItem,
  primaryColor: string,
) {
  const iframeUrl = new URL(
    `https://iframe.cloudflarestream.com/${encodeURIComponent(playbackId)}`,
  )

  iframeUrl.searchParams.set('preload', 'metadata')
  iframeUrl.searchParams.set('primaryColor', primaryColor)

  if (item.posterUrl) {
    iframeUrl.searchParams.set('poster', item.posterUrl)
  }

  return iframeUrl.toString()
}

function getReelThumbnailItem(item: MediaViewerItem) {
  return item.relatedItems?.find((relatedItem) => relatedItem.kind === 'image') ?? null
}

function getReelVideoItem(item: MediaViewerItem) {
  if (isVideoMediaItem(item)) return item

  return item.relatedItems?.find(isVideoMediaItem) ?? null
}

function HeaderActionButton({
  children,
  disabled,
  icon,
  onClick,
}: {
  children: string
  disabled?: boolean
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      className="min-w-0"
      disabled={disabled}
      size="sm"
      type="button"
      variant="secondary"
      onClick={onClick}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </Button>
  )
}

function MediaMetaPanel({ item }: { item: MediaViewerItem }) {
  const rows = metadataRows(item)
  const warnings = item.warnings?.map(humanizeMediaCode).filter(Boolean)

  return (
    <aside className="flex min-h-0 flex-col gap-4 border-t border-border bg-surface p-4 lg:w-80 lg:border-l lg:border-t-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          Media details
        </p>
        <h3 className="mt-1 break-words text-base font-semibold text-foreground">
          {item.title}
        </h3>
        {item.description ? (
          <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
        ) : null}
      </div>

      {rows.length ? (
        <dl className="grid gap-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs font-semibold uppercase tracking-normal text-muted">
                {row.label}
              </dt>
              <dd className="mt-1 break-words text-sm text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {warnings?.length ? (
        <div className="rounded-[0.75rem] border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
          {warnings.join(', ')}
        </div>
      ) : null}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          disabled={!isOpenableMediaUrl(item.src)}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => openExternal(item.src)}
        >
          <ExternalLink className="mr-2 size-4" />
          Open
        </Button>
      </div>
    </aside>
  )
}

function EmptyPreview() {
  return (
    <div className="flex h-full min-h-[22rem] items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <Info className="mx-auto size-10 text-muted" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          Preview unavailable
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          This media record does not have a viewable URL yet.
        </p>
      </div>
    </div>
  )
}

function CloudflareVideoPreview({
  item,
  mode = 'standalone',
}: {
  item: MediaViewerItem
  mode?: 'fit' | 'standalone'
}) {
  const { theme } = useTheme()
  const cloudflareStreamSrc = resolveCloudflareStreamSrc(item)
  const isFitMode = mode === 'fit'
  const isPortrait = isPortraitMedia(item)

  if (cloudflareStreamSrc) {
    const cloudflareIframeSrc = buildCloudflareIframeSrc(
      cloudflareStreamSrc,
      item,
      theme.colors.primary,
    )

    return (
      <div
        className={cn(
          'mx-auto flex h-full w-full items-center justify-center overflow-hidden',
          isFitMode ? 'min-h-0' : 'min-h-[22rem]',
          !isFitMode && (isPortrait ? 'max-w-sm' : 'max-w-5xl'),
        )}
      >
        <iframe
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          className={cn(
            'rounded-[0.875rem] bg-black shadow-surface',
            isFitMode && isPortrait
              ? 'h-full max-h-full max-w-full'
              : 'max-h-full w-full',
          )}
          loading="lazy"
          src={cloudflareIframeSrc}
          style={{ aspectRatio: getMediaAspectRatio(item) }}
          title={item.title}
        />
      </div>
    )
  }

  if (isOpenableMediaUrl(item.src)) {
    return (
      <video
        className="mx-auto max-h-full max-w-full rounded-[0.875rem] bg-black"
        controls
        playsInline
        poster={item.posterUrl ?? undefined}
        preload="metadata"
        src={item.src}
      >
        <track kind="captions" />
      </video>
    )
  }

  return <EmptyPreview />
}

function CompactUnavailable({ label }: { label: string }) {
  return (
    <div className="flex min-h-[12rem] w-full items-center justify-center rounded-[0.875rem] border border-dashed border-border bg-surface p-4 text-center">
      <div>
        <Info className="mx-auto size-8 text-muted" />
        <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
      </div>
    </div>
  )
}

function ReelPanelHeader({
  label,
  title,
  url,
}: {
  label: string
  title: string
  url?: string | null
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-foreground">{title}</p>
      </div>
      <Button
        disabled={!isOpenableMediaUrl(url)}
        size="sm"
        type="button"
        variant="secondary"
        onClick={() => openExternal(url)}
      >
        <ExternalLink className="mr-2 size-4" />
        Open
      </Button>
    </div>
  )
}

function ReelMediaPreview({ item }: { item: MediaViewerItem }) {
  const thumbnailItem = getReelThumbnailItem(item)
  const videoItem = getReelVideoItem(item)

  return (
    <div className="grid h-full min-h-[32rem] gap-4 xl:grid-cols-[minmax(16rem,0.38fr)_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col gap-3">
        <ReelPanelHeader
          label="Thumbnail"
          title={thumbnailItem?.title ?? 'Thumbnail unavailable'}
          url={thumbnailItem?.src ?? thumbnailItem?.downloadUrl}
        />
        <div className="flex min-h-[18rem] flex-1 items-center justify-center overflow-hidden rounded-[0.875rem] border border-border bg-surface">
          {isOpenableMediaUrl(thumbnailItem?.src ?? thumbnailItem?.downloadUrl) ? (
            <img
              alt={thumbnailItem?.title ?? `${item.title} thumbnail`}
              className="h-full max-h-[34rem] w-full object-contain"
              src={thumbnailItem?.src ?? thumbnailItem?.downloadUrl ?? undefined}
              style={{
                aspectRatio: getMediaAspectRatio(thumbnailItem ?? item, '9 / 16'),
              }}
            />
          ) : (
            <CompactUnavailable label="Thumbnail unavailable" />
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-col gap-3">
        <ReelPanelHeader
          label="Video"
          title={videoItem?.title ?? 'Video unavailable'}
          url={videoItem?.src ?? videoItem?.downloadUrl}
        />
        <div className="flex min-h-[22rem] flex-1 items-center justify-center rounded-[0.875rem] border border-border bg-surface p-3">
          {videoItem ? (
            <CloudflareVideoPreview item={videoItem} mode="fit" />
          ) : (
            <CompactUnavailable label="Video unavailable" />
          )}
        </div>
      </section>
    </div>
  )
}

function PdfPreview({ item }: { item: MediaViewerItem }) {
  const { resolvedMode, theme } = useTheme()
  const src = item.src ?? item.downloadUrl

  if (!isOpenableMediaUrl(src)) {
    return <EmptyPreview />
  }

  return (
    <div className="h-full min-h-[28rem] w-full overflow-hidden rounded-[0.875rem] border border-border bg-surface">
      <PDFViewer
        config={{
          disabledCategories: ['annotation', 'redaction'],
          src,
          theme: {
            dark: {
              accent: {
                primary: theme.colors.primary,
              },
            },
            light: {
              accent: {
                primary: theme.colors.primary,
              },
            },
            preference: resolvedMode,
          },
        }}
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}

function DocumentPreview({ item }: { item: MediaViewerItem }) {
  return (
    <div className="flex h-full min-h-[22rem] items-center justify-center p-6 text-center">
      <div className="max-w-lg rounded-[1rem] border border-border bg-surface p-6 shadow-surface">
        <FileText className="mx-auto size-12 text-primary" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          Document preview
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          This file type cannot be previewed inline here. Open it in a new tab
          when a viewable link is available.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button
            disabled={!isOpenableMediaUrl(item.src)}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => openExternal(item.src)}
          >
            <ExternalLink className="mr-2 size-4" />
            Open
          </Button>
        </div>
      </div>
    </div>
  )
}

function PreviewCanvas({ item }: { item: MediaViewerItem }) {
  if (item.kind === 'reel') return <ReelMediaPreview item={item} />

  if (isVideoMediaItem(item)) {
    return <CloudflareVideoPreview item={item} />
  }

  if (item.kind === 'pdf') return <PdfPreview item={item} />
  if (item.kind === 'document') return <DocumentPreview item={item} />

  return <EmptyPreview />
}

export function MediaViewerDialog({
  items,
  onClose,
  startIndex,
}: MediaViewerDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex)
  const item = items[currentIndex]

  const lightboxEntries = useMemo<LightboxEntry[]>(
    () =>
      items.flatMap((mediaItem, originalIndex) => {
        if (!isLightboxItem(mediaItem)) return []

        const slide = toLightboxSlide(mediaItem)

        return slide ? [{ item: mediaItem, originalIndex, slide }] : []
      }),
    [items],
  )

  if (!item) return null

  if (isLightboxItem(item)) {
    const lightboxIndex = lightboxEntries.findIndex(
      (entry) => entry.originalIndex === currentIndex,
    )

    if (lightboxIndex >= 0) {
      return (
        <Lightbox
          captions={{ descriptionMaxLines: 3, showToggle: true }}
          carousel={{ finite: true, imageFit: 'contain' }}
          close={onClose}
          controller={{ closeOnBackdropClick: true }}
          index={lightboxIndex}
          labels={{
            'Hide captions': 'Hide media details',
            'Show captions': 'Show media details',
          }}
          open
          plugins={[Captions, Fullscreen, Thumbnails, Video, Zoom]}
          slides={lightboxEntries.map((entry) => entry.slide)}
          video={{
            controls: true,
            playsInline: true,
            preload: 'metadata',
          }}
          on={{
            view: ({ index }) => {
              const nextItem = lightboxEntries[index]
              if (nextItem) setCurrentIndex(nextItem.originalIndex)
            },
          }}
        />
      )
    }
  }

  const canGoPrevious = currentIndex > 0
  const canGoNext = currentIndex < items.length - 1
  const showNavigation = items.length > 1

  return (
    <div className="fixed inset-0 z-[95] bg-overlay p-1 sm:p-2">
      <div
        aria-modal="true"
        className="mx-auto flex h-full max-h-[calc(100vh-0.5rem)] w-full max-w-[96rem] flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-1rem)]"
        role="dialog"
      >
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.75rem] bg-secondary text-primary">
              {item.kind === 'pdf' || item.kind === 'document' ? (
                <FileText className="size-5" />
              ) : item.kind === 'image' ? (
                <ImageIcon className="size-5" />
              ) : (
                <Film className="size-5" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">
                {item.title}
              </h2>
              <p className="truncate text-sm text-muted">
                {mediaKindLabel(item.kind)}
                {items.length > 1 ? ` · ${currentIndex + 1} of ${items.length}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {showNavigation ? (
              <>
                <HeaderActionButton
                  disabled={!canGoPrevious}
                  icon={<ArrowLeft className="mr-0 size-4 sm:mr-2" />}
                  onClick={() =>
                    setCurrentIndex((index) => Math.max(index - 1, 0))
                  }
                >
                  Previous
                </HeaderActionButton>
                <HeaderActionButton
                  disabled={!canGoNext}
                  icon={<ArrowRight className="mr-0 size-4 sm:mr-2" />}
                  onClick={() =>
                    setCurrentIndex((index) =>
                      Math.min(index + 1, items.length - 1),
                    )
                  }
                >
                  Next
                </HeaderActionButton>
              </>
            ) : null}
            <button
              aria-label="Close media viewer"
              className="rounded-full p-2 text-muted transition-colors hover:bg-secondary hover:text-foreground"
              type="button"
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_auto]">
          <main
            className={cn(
              'min-h-0 overflow-auto bg-surface-muted/50 p-3 sm:p-4',
              item.kind === 'cloudflare-video' ? 'flex items-center' : '',
            )}
          >
            <PreviewCanvas item={item} />
          </main>
          <MediaMetaPanel item={item} />
        </div>
      </div>
    </div>
  )
}
