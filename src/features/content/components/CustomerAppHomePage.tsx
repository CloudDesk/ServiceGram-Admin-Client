import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  ImageIcon,
  ImageUp,
  PauseCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Send,
  SlidersHorizontal,
  Smartphone,
  X,
} from 'lucide-react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import {
  QuickPreviewActions,
  QuickPreviewFact,
  QuickPreviewFactGrid,
  QuickPreviewTabs,
  type QuickPreviewAction,
} from '../../../components/ui/QuickPreview'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import { contentService } from '../services/content.service'
import type {
  CreateCustomerHomeCarouselSlidePayload,
  CustomerHomeCarouselSummary,
  CustomerHomeCarouselSlide,
  CustomerHomeCarouselSlideStatus,
  CustomerHomeCtaActionType,
  CustomerHomeSection,
  UpdateCustomerHomeCarouselSlidePayload,
} from '../types/content.types'

type CarouselQueueKey =
  | 'all'
  | 'draft'
  | 'scheduled'
  | 'published'
  | 'paused'
  | 'archived'
type CarouselPreviewTab = 'summary' | 'artwork' | 'actions'
type CarouselActionKind = 'ARCHIVE' | 'PAUSE' | 'PUBLISH' | 'REMOVE_IMAGE'

interface CarouselActionTarget {
  kind: CarouselActionKind
  slide: CustomerHomeCarouselSlide
}

interface SlideFormTarget {
  mode: 'create' | 'edit'
  slide?: CustomerHomeCarouselSlide
}

interface SlideFormValues {
  categoryId: string
  ctaActionType: CustomerHomeCtaActionType
  ctaLabel: string
  description: string
  displayOrder: number
  endsAt: string
  externalUrl: string
  headline: string
  label: string
  reason: string
  startsAt: string
}

const DEFAULT_PAGE_SIZE = 50
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const ctaActionOptions: { label: string; value: CustomerHomeCtaActionType }[] = [
  { label: 'Open service category', value: 'SERVICE_CATEGORY' },
  { label: 'Open support', value: 'SUPPORT' },
  { label: 'Open profile', value: 'PROFILE' },
  { label: 'Open orders', value: 'ORDERS' },
  { label: 'Open website link', value: 'EXTERNAL_LINK' },
  { label: 'No button action', value: 'NONE' },
]
const queueItems: { key: CarouselQueueKey; label: string }[] = [
  { key: 'all', label: 'All slides' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'paused', label: 'Paused' },
  { key: 'archived', label: 'Archived' },
]
const previewTabs = [
  { key: 'summary' as const, label: 'Summary' },
  { key: 'artwork' as const, label: 'Artwork' },
  { key: 'actions' as const, label: 'Actions' },
] as const

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not set'

  try {
    return formatDate(value, true)
  } catch {
    return 'Not set'
  }
}

function statusTone(status: CustomerHomeCarouselSlideStatus): StatusTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  if (status === 'PAUSED') return 'danger'
  if (status === 'SCHEDULED') return 'info'
  return 'warning'
}

function queueStatuses(queueKey: CarouselQueueKey) {
  if (queueKey === 'all') return undefined
  return [queueKey.toUpperCase() as CustomerHomeCarouselSlideStatus]
}

function slideDetailPath(slideId: string) {
  return routePaths.customerAppHomeCarouselSlide.replace(':slideId', slideId)
}

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function fromLocalDateTimeInput(value: string) {
  if (!value.trim()) return null
  return new Date(value).toISOString()
}

function getSlideStatusCount(
  summary: CustomerHomeCarouselSummary | undefined,
  queueKey: CarouselQueueKey,
) {
  if (!summary) return undefined
  if (queueKey === 'all') return summary.total
  return summary[queueKey]
}

function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      const dimensions = {
        height: image.naturalHeight,
        width: image.naturalWidth,
      }
      URL.revokeObjectURL(imageUrl)
      resolve(dimensions)
    }

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('Could not read the image dimensions.'))
    }

    image.src = imageUrl
  })
}

function defaultSlideFormValues(slide?: CustomerHomeCarouselSlide): SlideFormValues {
  const actionPayload = slide?.cta.actionPayload ?? {}
  const externalUrl =
    typeof actionPayload.url === 'string' ? actionPayload.url : ''

  return {
    categoryId: slide?.category?.categoryId ?? '',
    ctaActionType: slide?.cta.actionType ?? 'SERVICE_CATEGORY',
    ctaLabel: slide?.cta.label ?? 'Book now',
    description: slide?.description ?? '',
    displayOrder: slide?.displayOrder ?? 100,
    endsAt: toLocalDateTimeInput(slide?.schedule.endsAt),
    externalUrl,
    headline: slide?.headline ?? '',
    label: slide?.label ?? '',
    reason: '',
    startsAt: toLocalDateTimeInput(slide?.schedule.startsAt),
  }
}

function buildSlidePayload(
  values: SlideFormValues,
): CreateCustomerHomeCarouselSlidePayload {
  const actionPayload =
    values.ctaActionType === 'EXTERNAL_LINK' && values.externalUrl.trim()
      ? { url: values.externalUrl.trim() }
      : {}

  return {
    categoryId:
      values.ctaActionType === 'SERVICE_CATEGORY'
        ? values.categoryId || null
        : null,
    ctaActionPayload: actionPayload,
    ctaActionType: values.ctaActionType,
    ctaLabel: values.ctaLabel.trim() || 'Open',
    description: values.description.trim(),
    displayOrder: Number.isFinite(values.displayOrder)
      ? values.displayOrder
      : 100,
    endsAt: fromLocalDateTimeInput(values.endsAt),
    headline: values.headline.trim(),
    label: values.label.trim(),
    reason: values.reason.trim(),
    startsAt: fromLocalDateTimeInput(values.startsAt),
  }
}

function canRunSlideAction(
  slide: CustomerHomeCarouselSlide,
  action: 'ARCHIVE' | 'PAUSE' | 'PUBLISH' | 'UPDATE' | 'UPLOAD_IMAGE',
) {
  return slide.availableActions.includes(action)
}

function SignalList({
  blockingReasons,
  warnings,
}: {
  blockingReasons: string[]
  warnings: string[]
}) {
  const signals = [
    ...blockingReasons.map((message) => ({ message, tone: 'danger' as const })),
    ...warnings.map((message) => ({ message, tone: 'warning' as const })),
  ]

  if (signals.length === 0) {
    return <Badge tone="success">Ready</Badge>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.slice(0, 3).map((signal) => (
        <Badge key={signal.message} tone={signal.tone}>
          {signal.message}
        </Badge>
      ))}
      {signals.length > 3 ? (
        <Badge tone="neutral">+{signals.length - 3}</Badge>
      ) : null}
    </div>
  )
}

function HeroPhonePreview({ slide }: { slide: CustomerHomeCarouselSlide | null }) {
  return (
    <div className="border-b border-border bg-surface-muted/35 p-3">
      <div className="mx-auto w-full max-w-[18rem] rounded-[1.2rem] border border-border bg-surface p-2 shadow-surface">
        <div className="overflow-hidden rounded-[0.9rem] border border-border bg-[#f7f8fc]">
          <div className="flex min-h-[10.5rem] items-stretch">
            <div className="min-w-0 flex-1 p-4">
              <p className="text-xs font-semibold text-primary">
                {slide?.label || 'Home slide'}
              </p>
              <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-foreground">
                {slide?.headline || 'Add a customer-facing headline'}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">
                {slide?.description || 'Describe the offer or service in a short sentence.'}
              </p>
              <div className="mt-3 inline-flex max-w-full items-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                <span className="truncate">{slide?.cta.label || 'Book now'}</span>
              </div>
            </div>
            <div className="flex w-[7.5rem] items-center justify-center bg-white/60 p-2">
              {slide?.image.url ? (
                <img
                  alt=""
                  className="max-h-28 max-w-full object-contain"
                  src={slide.image.url}
                />
              ) : (
                <div className="flex size-24 items-center justify-center rounded-[0.9rem] border border-dashed border-border text-muted">
                  <ImageIcon className="size-8" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionStatusPanel({
  isSaving,
  onSaveTiming,
  onToggle,
  section,
}: {
  isSaving: boolean
  onSaveTiming: (autoplayIntervalMs: number) => void
  onToggle: () => void
  section: CustomerHomeSection | null
}) {
  const [intervalValue, setIntervalValue] = useState(() =>
    String(section?.autoplayIntervalMs ?? 3000),
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number(intervalValue)

    if (!Number.isFinite(parsed)) return
    onSaveTiming(Math.round(parsed))
  }

  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-3 shadow-surface">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-[0.75rem] bg-primary/10 text-primary">
              <Smartphone className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                Home hero carousel
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Controls the first carousel customers see on the app home screen.
              </p>
            </div>
          </div>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={submit}>
          <label className="min-w-[10rem] space-y-1">
            <span className="text-xs font-semibold text-muted">Slide speed</span>
            <Input
              className="h-9"
              inputMode="numeric"
              max={15000}
              min={1500}
              step={500}
              type="number"
              value={intervalValue}
              onChange={(event) => setIntervalValue(event.target.value)}
            />
          </label>
          <Button
            disabled={isSaving}
            size="sm"
            type="submit"
            variant="secondary"
          >
            <SlidersHorizontal className="mr-2 size-4" />
            Save timing
          </Button>
          <Button
            isLoading={isSaving}
            size="sm"
            type="button"
            variant={section?.isEnabled ? 'secondary' : 'primary'}
            onClick={onToggle}
          >
            {section?.isEnabled ? (
              <EyeOff className="mr-2 size-4" />
            ) : (
              <Eye className="mr-2 size-4" />
            )}
            {section?.isEnabled ? 'Hide from app' : 'Show in app'}
          </Button>
        </form>
      </div>
    </section>
  )
}

function SlideRow({
  canPublishContent,
  canUpdateContent,
  isSelected,
  onAction,
  onEdit,
  onSelect,
  slide,
}: {
  canPublishContent: boolean
  canUpdateContent: boolean
  isSelected: boolean
  onAction: (kind: CarouselActionKind, slide: CustomerHomeCarouselSlide) => void
  onEdit: (slide: CustomerHomeCarouselSlide) => void
  onSelect: () => void
  slide: CustomerHomeCarouselSlide
}) {
  const canPublish = canPublishContent && canRunSlideAction(slide, 'PUBLISH')
  const canPause = canUpdateContent && canRunSlideAction(slide, 'PAUSE')
  const canArchive = canUpdateContent && canRunSlideAction(slide, 'ARCHIVE')
  const canEdit = canUpdateContent && canRunSlideAction(slide, 'UPDATE')

  return (
    <article
      className={cn(
        'grid gap-3 border-b border-border px-3 py-3 transition hover:bg-surface-muted/45 lg:grid-cols-[5rem_minmax(0,1fr)_9rem_10rem_17rem] lg:items-center',
        isSelected && 'bg-primary/5',
      )}
    >
      <button
        className="flex size-20 items-center justify-center overflow-hidden rounded-[0.8rem] border border-border bg-surface-muted"
        type="button"
        onClick={onSelect}
      >
        {slide.image.url ? (
          <img alt="" className="h-full w-full object-contain p-1.5" src={slide.image.url} />
        ) : (
          <ImageIcon className="size-7 text-muted" />
        )}
      </button>
      <button
        className="min-w-0 text-left"
        type="button"
        onClick={onSelect}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">
            {slide.headline}
          </p>
          <Badge tone={statusTone(slide.status)}>{humanizeCode(slide.status)}</Badge>
        </div>
        <p className="mt-1 truncate text-xs font-medium text-muted">
          {slide.label} · {slide.category?.name ?? 'No category linked'}
        </p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
          {slide.description}
        </p>
      </button>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          Order
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">
          {slide.displayOrder}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          Button
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">
          {slide.cta.label}
        </p>
      </div>
      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
        {canPublish ? (
          <Button size="sm" type="button" onClick={() => onAction('PUBLISH', slide)}>
            <Send className="mr-2 size-4" />
            Publish
          </Button>
        ) : null}
        {canPause ? (
          <Button
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => onAction('PAUSE', slide)}
          >
            <PauseCircle className="mr-2 size-4" />
            Pause
          </Button>
        ) : null}
        {canEdit ? (
          <Button size="sm" type="button" variant="secondary" onClick={() => onEdit(slide)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        ) : null}
        {canArchive ? (
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => onAction('ARCHIVE', slide)}
          >
            <Archive className="mr-2 size-4" />
            Archive
          </Button>
        ) : null}
      </div>
    </article>
  )
}

function SlidePreviewRail({
  canPublishContent,
  canUpdateContent,
  isUploading,
  onAction,
  onEdit,
  onUploadClick,
  selectedTab,
  setSelectedTab,
  slide,
  uploadError,
}: {
  canPublishContent: boolean
  canUpdateContent: boolean
  isUploading: boolean
  onAction: (kind: CarouselActionKind, slide: CustomerHomeCarouselSlide) => void
  onEdit: (slide: CustomerHomeCarouselSlide) => void
  onUploadClick: () => void
  selectedTab: CarouselPreviewTab
  setSelectedTab: (tab: CarouselPreviewTab) => void
  slide: CustomerHomeCarouselSlide | null
  uploadError: string | null
}) {
  const navigate = useNavigate()
  const primaryAction: QuickPreviewAction | null = slide?.availableActions.includes('PUBLISH')
    ? {
        disabled: !canPublishContent,
        icon: <Send className="size-4" />,
        key: 'publish',
        label: 'Publish',
        onClick: () => onAction('PUBLISH', slide),
        title: 'Publish to the customer app',
      }
    : slide?.availableActions.includes('PAUSE')
      ? {
          disabled: !canUpdateContent,
          icon: <PauseCircle className="size-4" />,
          key: 'pause',
          label: 'Pause',
          onClick: () => onAction('PAUSE', slide),
          title: 'Hide this slide from the customer app',
          variant: 'secondary',
        }
      : null
  const detailAction: QuickPreviewAction | null = slide
    ? {
        icon: <ArrowUpRight className="size-4" />,
        key: 'detail',
        label: 'Open detail',
        onClick: () => navigate(slideDetailPath(slide.slideId)),
        title: 'Open slide detail',
        variant: 'secondary',
      }
    : null
  const secondaryActions: QuickPreviewAction[] = slide
    ? [
        {
          disabled: !canUpdateContent || !slide.availableActions.includes('UPDATE'),
          icon: <Pencil className="size-4" />,
          key: 'edit',
          label: 'Edit slide',
          onClick: () => onEdit(slide),
          title: 'Edit slide copy and action',
        },
        {
          disabled:
            !canUpdateContent || !slide.availableActions.includes('UPLOAD_IMAGE'),
          icon: <ImageUp className="size-4" />,
          key: 'upload',
          label: 'Upload image',
          onClick: onUploadClick,
          title: 'Upload customer app artwork',
        },
        {
          disabled: !canUpdateContent || !slide.image.mediaAssetId,
          icon: <X className="size-4" />,
          key: 'remove-image',
          label: 'Remove image',
          onClick: () => onAction('REMOVE_IMAGE', slide),
          title: 'Remove this slide artwork',
          variant: 'danger',
        },
        {
          disabled: !canUpdateContent || !slide.availableActions.includes('ARCHIVE'),
          icon: <Archive className="size-4" />,
          key: 'archive',
          label: 'Archive slide',
          onClick: () => onAction('ARCHIVE', slide),
          title: 'Archive this slide',
          variant: 'danger',
        },
      ]
    : []

  if (!slide) {
    return (
      <aside className="flex min-h-[32rem] flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface">
        <div className="flex flex-1 items-center justify-center p-5">
          <EmptyState
            description="Create a slide to preview how the app home will look."
            title="No slide selected"
          />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex min-h-[32rem] flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
      <HeroPhonePreview slide={slide} />
      <QuickPreviewTabs
        activeTab={selectedTab}
        ariaLabel="Customer home slide preview"
        tabs={previewTabs}
        onChange={setSelectedTab}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {selectedTab === 'summary' ? (
          <div className="space-y-3">
            <QuickPreviewFactGrid>
              <QuickPreviewFact label="State" tone={statusTone(slide.status)} value={humanizeCode(slide.status)} />
              <QuickPreviewFact label="Order" value={slide.displayOrder} />
              <QuickPreviewFact
                label="Category"
                tone={slide.category?.isActive === false ? 'danger' : 'neutral'}
                value={slide.category?.name ?? 'Not linked'}
              />
              <QuickPreviewFact label="Button" value={slide.cta.label} />
            </QuickPreviewFactGrid>
            <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Signals
              </p>
              <div className="mt-2">
                <SignalList
                  blockingReasons={slide.blockingReasons}
                  warnings={slide.warnings}
                />
              </div>
            </div>
            <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Customer copy
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {slide.headline}
              </p>
              <p className="mt-1 text-sm leading-5 text-muted">{slide.description}</p>
            </div>
          </div>
        ) : null}

        {selectedTab === 'artwork' ? (
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center rounded-[0.85rem] border border-border bg-surface-muted/35 p-3">
              {slide.image.url ? (
                <img alt="" className="max-h-full max-w-full object-contain" src={slide.image.url} />
              ) : (
                <div className="text-center text-muted">
                  <ImageIcon className="mx-auto size-9" />
                  <p className="mt-2 text-sm font-semibold">Artwork missing</p>
                </div>
              )}
            </div>
            <QuickPreviewFactGrid>
              <QuickPreviewFact
                label="Size"
                value={
                  slide.image.width && slide.image.height
                    ? `${slide.image.width} x ${slide.image.height}`
                    : 'Not uploaded'
                }
              />
              <QuickPreviewFact
                label="Recommended"
                value={`${slide.image.recommended.minWidth}+ px`}
              />
            </QuickPreviewFactGrid>
            <Button
              className="w-full"
              disabled={isUploading || !canUpdateContent}
              isLoading={isUploading}
              type="button"
              variant="secondary"
              onClick={onUploadClick}
            >
              <ImageUp className="mr-2 size-4" />
              Upload image
            </Button>
            {uploadError ? (
              <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {uploadError}
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedTab === 'actions' ? (
          <div className="space-y-3">
            <QuickPreviewFactGrid>
              <QuickPreviewFact
                label="Action"
                value={humanizeCode(slide.cta.actionType)}
              />
              <QuickPreviewFact
                label="Next step"
                tone={slide.nextRecommendedAction === 'FIX_BLOCKERS' ? 'warning' : 'neutral'}
                value={humanizeCode(slide.nextRecommendedAction)}
              />
              <QuickPreviewFact
                label="Starts"
                value={formatDateSafe(slide.schedule.startsAt)}
              />
              <QuickPreviewFact label="Ends" value={formatDateSafe(slide.schedule.endsAt)} />
            </QuickPreviewFactGrid>
            <div className="rounded-[0.75rem] border border-border bg-surface-muted/35 p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                Last updated
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {formatDateSafe(slide.lifecycle.updatedAt)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
      <QuickPreviewActions
        detailAction={detailAction}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
    </aside>
  )
}

function SlideFormModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  target,
}: {
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (values: SlideFormValues) => void
  target: SlideFormTarget
}) {
  const [values, setValues] = useState(() => defaultSlideFormValues(target.slide))
  const [categoryLabel, setCategoryLabel] = useState(target.slide?.category?.name ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const isEdit = target.mode === 'edit'

  const updateValue = <TKey extends keyof SlideFormValues>(
    key: TKey,
    value: SlideFormValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (values.label.trim().length < 2) {
      setFormError('Add a short label customers can recognize.')
      return
    }

    if (values.headline.trim().length < 2) {
      setFormError('Add the headline shown on the home screen.')
      return
    }

    if (values.description.trim().length < 2) {
      setFormError('Add a short description for the slide.')
      return
    }

    if (values.ctaActionType === 'SERVICE_CATEGORY' && !values.categoryId) {
      setFormError('Choose the service category this slide should open.')
      return
    }

    if (values.ctaActionType === 'EXTERNAL_LINK' && !values.externalUrl.trim()) {
      setFormError('Add the website link this button should open.')
      return
    }

    if (values.reason.trim().length < 5) {
      setFormError('Add a short change note for audit history.')
      return
    }

    onSubmit(values)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {isEdit ? 'Edit home slide' : 'Create home slide'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Make one carousel card for the customer app home screen.
            </p>
          </div>
          <button
            aria-label="Close slide form"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="min-h-0 flex-1 overflow-y-auto p-5" onSubmit={submit}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Label</span>
                  <Input
                    placeholder="Laundry"
                    value={values.label}
                    onChange={(event) => updateValue('label', event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Display order</span>
                  <Input
                    inputMode="numeric"
                    min={0}
                    type="number"
                    value={values.displayOrder}
                    onChange={(event) =>
                      updateValue('displayOrder', Number(event.target.value))
                    }
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-foreground">Headline</span>
                <Input
                  placeholder="Laundry picked up today"
                  value={values.headline}
                  onChange={(event) => updateValue('headline', event.target.value)}
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-semibold text-foreground">Description</span>
                <textarea
                  className="form-input min-h-24 resize-y"
                  placeholder="Pickup, wash, and delivery handled by nearby pros."
                  value={values.description}
                  onChange={(event) => updateValue('description', event.target.value)}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Button text</span>
                  <Input
                    placeholder="Book now"
                    value={values.ctaLabel}
                    onChange={(event) => updateValue('ctaLabel', event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Button opens</span>
                  <select
                    className="form-input"
                    value={values.ctaActionType}
                    onChange={(event) =>
                      updateValue(
                        'ctaActionType',
                        event.target.value as CustomerHomeCtaActionType,
                      )
                    }
                  >
                    {ctaActionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {values.ctaActionType === 'SERVICE_CATEGORY' ? (
                <LookupSelect
                  fetchOptions={searchCategoryLookupOptions}
                  label="Service category"
                  placeholder="Search category"
                  queryKey={['lookup', 'categories', 'home-carousel-form']}
                  selectedLabel={categoryLabel}
                  value={values.categoryId}
                  onChange={(value, option) => {
                    updateValue('categoryId', value)
                    setCategoryLabel(option?.label ?? '')
                  }}
                />
              ) : null}

              {values.ctaActionType === 'EXTERNAL_LINK' ? (
                <label className="space-y-1">
                  <span className="text-sm font-semibold text-foreground">Website link</span>
                  <Input
                    placeholder="https://servicegram.in"
                    value={values.externalUrl}
                    onChange={(event) => updateValue('externalUrl', event.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <div className="space-y-3 rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
              <h3 className="text-sm font-semibold text-foreground">Visibility window</h3>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">Starts</span>
                <Input
                  type="datetime-local"
                  value={values.startsAt}
                  onChange={(event) => updateValue('startsAt', event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-muted">Ends</span>
                <Input
                  type="datetime-local"
                  value={values.endsAt}
                  onChange={(event) => updateValue('endsAt', event.target.value)}
                />
              </label>
              <div className="rounded-[0.75rem] border border-border bg-surface p-3">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Publishing
                </p>
                <p className="mt-1 text-sm leading-5 text-muted">
                  Save creates a draft. Publish after artwork and category are ready.
                </p>
              </div>
            </div>
          </div>

          <label className="mt-4 block space-y-1">
            <span className="text-sm font-semibold text-foreground">Change note *</span>
            <textarea
              className="form-input min-h-24 resize-y"
              placeholder="Updated customer app home carousel slide."
              value={values.reason}
              onChange={(event) => updateValue('reason', event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button isLoading={isSubmitting} size="sm" type="submit">
              {isEdit ? 'Save slide' : 'Create slide'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CarouselActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: CarouselActionTarget
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const actionCopy: Record<CarouselActionKind, { button: string; title: string; tone: 'danger' | 'primary' | 'secondary' }> = {
    ARCHIVE: { button: 'Archive', title: 'Archive home slide', tone: 'danger' },
    PAUSE: { button: 'Pause', title: 'Pause home slide', tone: 'secondary' },
    PUBLISH: { button: 'Publish', title: 'Publish home slide', tone: 'primary' },
    REMOVE_IMAGE: { button: 'Remove image', title: 'Remove slide image', tone: 'danger' },
  }
  const copy = actionCopy[action.kind]

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    setFormError(null)

    if (trimmedReason.length < 5) {
      setFormError('Add a short reason for audit history.')
      return
    }

    onSubmit(trimmedReason)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
            <p className="mt-1 truncate text-sm text-muted">{action.slide.headline}</p>
          </div>
          <button
            aria-label="Close slide action"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit}>
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-semibold text-foreground">Reason *</span>
            <textarea
              className="form-input min-h-28 resize-y"
              placeholder="Reviewed and ready for the customer app."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {formError || error ? (
            <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
            <Button
              disabled={isSubmitting}
              size="sm"
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              isLoading={isSubmitting}
              size="sm"
              type="submit"
              variant={copy.tone}
            >
              {copy.button}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  tone: StatusTone
  value: number | string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted">
          {label}
        </p>
        <span
          className={cn(
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'danger' && 'text-danger',
            tone === 'info' && 'text-primary',
            tone === 'neutral' && 'text-muted',
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
        {value}
      </p>
    </article>
  )
}

export function CustomerAppHomePage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const canUpdateContent = usePermission('content:update')
  const canPublishContent = usePermission('content:publish')
  const initialQueue = queueItems.some((item) => item.key === searchParams.get('queue'))
    ? (searchParams.get('queue') as CarouselQueueKey)
    : 'all'
  const [queueKey, setQueueKey] = useState<CarouselQueueKey>(initialQueue)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<CarouselPreviewTab>('summary')
  const [formTarget, setFormTarget] = useState<SlideFormTarget | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<CarouselActionTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const next = new URLSearchParams()

    if (queueKey !== 'all') next.set('queue', queueKey)
    if (search.trim()) next.set('search', search.trim())

    setSearchParams(next, { replace: true })
  }, [queueKey, search, setSearchParams])

  const homeQuery = useQuery({
    queryKey: ['content', 'customer-app-home'],
    queryFn: () => contentService.getCustomerAppHome(),
    staleTime: 30_000,
  })
  const slidesQuery = useQuery({
    queryKey: ['content', 'customer-app-home', 'slides', queueKey, search],
    queryFn: () =>
      contentService.getCarouselSlides({
        limit: DEFAULT_PAGE_SIZE,
        page: 1,
        search: search.trim() || undefined,
        status: queueStatuses(queueKey),
      }),
    placeholderData: (previousData) => previousData,
  })
  const slides = useMemo(() => slidesQuery.data?.data ?? [], [slidesQuery.data?.data])
  const summary = slidesQuery.data?.summary ?? homeQuery.data?.data.carousel.summary
  const section = homeQuery.data?.data.section ?? null
  const selectedSlide = useMemo(
    () =>
      slides.find((slide) => slide.slideId === selectedSlideId) ??
      slides[0] ??
      null,
    [selectedSlideId, slides],
  )
  const blockedCount = slides.filter((slide) => slide.blockingReasons.length > 0).length

  const invalidateHomeQueries = () => {
    void queryClient.invalidateQueries({
      queryKey: ['content', 'customer-app-home'],
    })
  }

  const sectionMutation = useMutation({
    mutationFn: contentService.updateCustomerAppHomeSection,
    onSuccess: () => {
      invalidateHomeQueries()
      setActionMessage('Customer app home carousel updated.')
    },
    onError: (error: Error) => {
      setActionMessage(null)
      setActionError(error.message)
    },
  })
  const createMutation = useMutation({
    mutationFn: contentService.createCarouselSlide,
    onSuccess: (response) => {
      setFormTarget(null)
      setFormError(null)
      setSelectedSlideId(response.data.slideId)
      setActionMessage('Home slide created as a draft.')
      invalidateHomeQueries()
    },
    onError: (error: Error) => setFormError(error.message),
  })
  const updateMutation = useMutation({
    mutationFn: ({
      payload,
      slideId,
    }: {
      payload: UpdateCustomerHomeCarouselSlidePayload
      slideId: string
    }) => contentService.updateCarouselSlide(slideId, payload),
    onSuccess: (response) => {
      setFormTarget(null)
      setFormError(null)
      setSelectedSlideId(response.data.slideId)
      setActionMessage('Home slide saved.')
      invalidateHomeQueries()
    },
    onError: (error: Error) => setFormError(error.message),
  })
  const actionMutation = useMutation({
    mutationFn: ({
      kind,
      reason,
      slideId,
    }: {
      kind: CarouselActionKind
      reason: string
      slideId: string
    }) => {
      if (kind === 'PUBLISH') {
        return contentService.publishCarouselSlide(slideId, { reason })
      }
      if (kind === 'PAUSE') {
        return contentService.pauseCarouselSlide(slideId, { reason })
      }
      if (kind === 'REMOVE_IMAGE') {
        return contentService.removeCarouselImage(slideId, { reason })
      }
      return contentService.archiveCarouselSlide(slideId, { reason })
    },
    onSuccess: (response, variables) => {
      setActionTarget(null)
      setActionError(null)
      setSelectedSlideId(response.data.slideId)
      setActionMessage(
        variables.kind === 'REMOVE_IMAGE'
          ? 'Slide image removed.'
          : `Slide ${humanizeCode(variables.kind).toLowerCase()}.`,
      )
      invalidateHomeQueries()
    },
    onError: (error: Error) => setActionError(error.message),
  })
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      slide,
    }: {
      file: File
      slide: CustomerHomeCarouselSlide
    }) => {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
        throw new Error('Use a JPG, PNG, or WEBP image.')
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error('Use an image under 5 MB.')
      }

      const dimensions = await getImageDimensions(file)

      if (dimensions.width < 256 || dimensions.height < 256) {
        throw new Error('Use artwork at least 256 x 256 px.')
      }

      const intentResponse = await contentService.createCarouselImageUploadIntent(
        slide.slideId,
        {
          fileName: file.name,
          metadata: {
            height: dimensions.height,
            source: 'admin_portal',
            width: dimensions.width,
          },
          mimeType: file.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
          sizeBytes: file.size,
        },
      )
      const intent = intentResponse.data

      if (!intent.uploadUrl) {
        throw new Error(
          intent.warnings.includes('GCS_SIGNED_URL_CREATION_FAILED')
            ? 'Upload URL is unavailable. Check the backend GCS signing configuration.'
            : 'Upload URL is unavailable for this image.',
        )
      }

      const uploadResponse = await fetch(intent.uploadUrl, {
        body: file,
        headers: intent.headers,
        method: 'PUT',
      })

      if (!uploadResponse.ok) {
        throw new Error('GCS rejected the upload. Try again with a smaller image.')
      }

      return contentService.confirmCarouselImageUpload(slide.slideId, {
        height: dimensions.height,
        mediaAssetId: intent.mediaAssetId,
        reason: 'Uploaded customer app home carousel image.',
        uploadedAt: new Date().toISOString(),
        width: dimensions.width,
      })
    },
    onSuccess: (response) => {
      setSelectedSlideId(response.data.slideId)
      setUploadError(null)
      setActionMessage('Slide image uploaded.')
      invalidateHomeQueries()
    },
    onError: (error: Error) => setUploadError(error.message),
  })

  const isSavingForm = createMutation.isPending || updateMutation.isPending
  const isRefreshing = slidesQuery.isFetching || homeQuery.isFetching

  const submitForm = (values: SlideFormValues) => {
    const payload = buildSlidePayload(values)

    setFormError(null)
    setActionMessage(null)

    if (formTarget?.mode === 'edit' && formTarget.slide) {
      updateMutation.mutate({
        payload,
        slideId: formTarget.slide.slideId,
      })
      return
    }

    createMutation.mutate(payload)
  }

  const runAction = (reason: string) => {
    if (!actionTarget) return
    setActionError(null)
    setActionMessage(null)
    actionMutation.mutate({
      kind: actionTarget.kind,
      reason,
      slideId: actionTarget.slide.slideId,
    })
  }

  const handleImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file || !selectedSlide) return

    setUploadError(null)
    setActionMessage(null)
    uploadMutation.mutate({ file, slide: selectedSlide })
  }

  const toggleSection = () => {
    if (!section) return

    sectionMutation.mutate({
      isEnabled: !section.isEnabled,
      reason: section.isEnabled
        ? 'Paused customer app home carousel from admin portal.'
        : 'Enabled customer app home carousel from admin portal.',
    })
  }

  const saveTiming = (autoplayIntervalMs: number) => {
    sectionMutation.mutate({
      autoplayIntervalMs,
      reason: 'Updated customer app home carousel slide speed.',
    })
  }

  return (
    <PageContainer className="flex min-h-full flex-col gap-3 !px-3 !py-3 space-y-0 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        description="Configure the customer app home screen hero carousel."
        layout="workspace"
        placement="topbar"
        title="Customer App Home"
      />

      <SectionStatusPanel
        isSaving={sectionMutation.isPending}
        key={section?.autoplayIntervalMs ?? 'loading'}
        section={section}
        onSaveTiming={saveTiming}
        onToggle={toggleSection}
      />

      <section className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Live"
          tone="success"
          value={summary?.published ?? 0}
        />
        <SummaryCard
          icon={<Clock3 className="size-4" />}
          label="Drafts"
          tone="warning"
          value={summary?.draft ?? 0}
        />
        <SummaryCard
          icon={<PauseCircle className="size-4" />}
          label="Paused"
          tone="danger"
          value={summary?.paused ?? 0}
        />
        <SummaryCard
          icon={<SlidersHorizontal className="size-4" />}
          label="Needs work"
          tone={blockedCount > 0 ? 'warning' : 'neutral'}
          value={blockedCount}
        />
      </section>

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}
      {actionError && !actionTarget ? (
        <div className="rounded-[0.875rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
          {actionError}
        </div>
      ) : null}

      <section className="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_24rem] xl:overflow-hidden">
        <main className="flex min-w-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
          <div className="border-b border-border px-3 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Hero carousel slides
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Publish only slides with artwork and a clear destination.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  isLoading={isRefreshing}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void homeQuery.refetch()
                    void slidesQuery.refetch()
                  }}
                >
                  <RefreshCcw className="mr-2 size-4" />
                  Refresh
                </Button>
                <Button
                  disabled={!canUpdateContent}
                  size="sm"
                  type="button"
                  onClick={() => setFormTarget({ mode: 'create' })}
                >
                  <Plus className="mr-2 size-4" />
                  New slide
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
              <ListHeaderSearch
                className="min-w-0 flex-1"
                placeholder="Search label, headline, or category"
                value={search}
                onChange={setSearch}
              />
              <div className="flex gap-1 overflow-x-auto">
                {queueItems.map((item) => {
                  const isActive = queueKey === item.key
                  const count = getSlideStatusCount(summary, item.key)

                  return (
                    <button
                      className={cn(
                        'inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-foreground hover:bg-surface-muted',
                      )}
                      key={item.key}
                      type="button"
                      onClick={() => setQueueKey(item.key)}
                    >
                      <span>{item.label}</span>
                      {count !== undefined ? (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-xs',
                            isActive
                              ? 'bg-primary-foreground/15 text-primary-foreground'
                              : 'bg-surface-muted text-muted',
                          )}
                        >
                          {count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {slidesQuery.isError || homeQuery.isError ? (
            <div className="p-4">
              <ErrorState
                description="We could not load the customer app home configuration."
                title="Home configuration unavailable"
                onRetry={() => {
                  void homeQuery.refetch()
                  void slidesQuery.refetch()
                }}
              />
            </div>
          ) : null}

          {slidesQuery.isLoading || homeQuery.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton className="h-24 rounded-[0.875rem]" key={index} />
              ))}
            </div>
          ) : null}

          {!slidesQuery.isLoading && !slidesQuery.isError && slides.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                actionLabel={canUpdateContent ? 'Create first slide' : undefined}
                description="Create the first hero carousel slide for the customer app home screen."
                title="No home slides yet"
                onAction={
                  canUpdateContent
                    ? () => setFormTarget({ mode: 'create' })
                    : undefined
                }
              />
            </div>
          ) : null}

          {slides.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {slides.map((slide) => (
                <SlideRow
                  canPublishContent={canPublishContent}
                  canUpdateContent={canUpdateContent}
                  isSelected={selectedSlide?.slideId === slide.slideId}
                  key={slide.slideId}
                  slide={slide}
                  onAction={(kind, actionSlide) => {
                    setActionError(null)
                    setActionTarget({ kind, slide: actionSlide })
                  }}
                  onEdit={(editSlide) => {
                    setFormError(null)
                    setFormTarget({ mode: 'edit', slide: editSlide })
                  }}
                  onSelect={() => setSelectedSlideId(slide.slideId)}
                />
              ))}
            </div>
          ) : null}
        </main>

        <SlidePreviewRail
          canPublishContent={canPublishContent}
          canUpdateContent={canUpdateContent}
          isUploading={uploadMutation.isPending}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          slide={selectedSlide}
          uploadError={uploadError}
          onAction={(kind, slide) => {
            setActionError(null)
            setActionTarget({ kind, slide })
          }}
          onEdit={(slide) => {
            setFormError(null)
            setFormTarget({ mode: 'edit', slide })
          }}
          onUploadClick={() => fileInputRef.current?.click()}
        />
      </section>

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        ref={fileInputRef}
        type="file"
        onChange={handleImageSelected}
      />

      {formTarget ? (
        <SlideFormModal
          error={formError}
          isSubmitting={isSavingForm}
          target={formTarget}
          onClose={() => {
            setFormError(null)
            setFormTarget(null)
          }}
          onSubmit={submitForm}
        />
      ) : null}

      {actionTarget ? (
        <CarouselActionModal
          action={actionTarget}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            setActionError(null)
            setActionTarget(null)
          }}
          onSubmit={runAction}
        />
      ) : null}
    </PageContainer>
  )
}
