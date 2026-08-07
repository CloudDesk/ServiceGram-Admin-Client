import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ImageIcon,
  ImageUp,
  PauseCircle,
  Pencil,
  Send,
  Smartphone,
  X,
} from 'lucide-react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  DetailPageHeader,
  DetailPageHeaderSkeleton,
} from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { LookupSelect } from '../../../components/ui/LookupSelect'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { searchCategoryLookupOptions } from '../../lookups/adminLookups'
import { contentService } from '../services/content.service'
import type {
  CustomerHomeCarouselSlide,
  CustomerHomeCarouselSlideStatus,
  CustomerHomeCtaActionType,
  UpdateCustomerHomeCarouselSlidePayload,
} from '../types/content.types'

type DetailActionKind = 'ARCHIVE' | 'PAUSE' | 'PUBLISH' | 'REMOVE_IMAGE'

interface DetailActionTarget {
  kind: DetailActionKind
  slide: CustomerHomeCarouselSlide
}

interface SlideEditValues {
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

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ctaActionOptions: { label: string; value: CustomerHomeCtaActionType }[] = [
  { label: 'Open service category', value: 'SERVICE_CATEGORY' },
  { label: 'Open support', value: 'SUPPORT' },
  { label: 'Open profile', value: 'PROFILE' },
  { label: 'Open orders', value: 'ORDERS' },
  { label: 'Open website link', value: 'EXTERNAL_LINK' },
  { label: 'No button action', value: 'NONE' },
]

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

function editValuesFromSlide(slide: CustomerHomeCarouselSlide): SlideEditValues {
  const actionPayload = slide.cta.actionPayload ?? {}

  return {
    categoryId: slide.category?.categoryId ?? '',
    ctaActionType: slide.cta.actionType,
    ctaLabel: slide.cta.label,
    description: slide.description,
    displayOrder: slide.displayOrder,
    endsAt: toLocalDateTimeInput(slide.schedule.endsAt),
    externalUrl: typeof actionPayload.url === 'string' ? actionPayload.url : '',
    headline: slide.headline,
    label: slide.label,
    reason: '',
    startsAt: toLocalDateTimeInput(slide.schedule.startsAt),
  }
}

function buildUpdatePayload(values: SlideEditValues): UpdateCustomerHomeCarouselSlidePayload {
  return {
    categoryId:
      values.ctaActionType === 'SERVICE_CATEGORY'
        ? values.categoryId || null
        : null,
    ctaActionPayload:
      values.ctaActionType === 'EXTERNAL_LINK' && values.externalUrl.trim()
        ? { url: values.externalUrl.trim() }
        : {},
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

function DetailField({
  label,
  tone = 'neutral',
  value,
}: {
  label: string
  tone?: StatusTone
  value: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3',
        tone === 'danger' && 'border-danger/20 bg-danger/5',
        tone === 'success' && 'border-success/20 bg-success/5',
        tone === 'warning' && 'border-warning/20 bg-warning/5',
        tone === 'info' && 'border-info/20 bg-info/5',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-2 min-w-0 break-words text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-muted">{description}</p>
          ) : null}
        </div>
        {actionNode ? <div className="shrink-0">{actionNode}</div> : null}
      </div>
      {children}
    </section>
  )
}

function HeroPreview({ slide }: { slide: CustomerHomeCarouselSlide }) {
  return (
    <div className="overflow-hidden rounded-[1rem] border border-border bg-[#f7f8fc]">
      <div className="grid min-h-[15rem] grid-cols-[minmax(0,1fr)_12rem]">
        <div className="min-w-0 p-5">
          <p className="text-sm font-semibold text-primary">{slide.label}</p>
          <h2 className="mt-3 max-w-lg text-2xl font-semibold leading-8 text-foreground">
            {slide.headline}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            {slide.description}
          </p>
          <div className="mt-4 inline-flex max-w-full items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <span className="truncate">{slide.cta.label}</span>
          </div>
        </div>
        <div className="flex items-center justify-center bg-white/60 p-4">
          {slide.image.url ? (
            <img alt="" className="max-h-44 max-w-full object-contain" src={slide.image.url} />
          ) : (
            <div className="flex size-32 items-center justify-center rounded-[0.9rem] border border-dashed border-border text-muted">
              <ImageIcon className="size-10" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SlideEditPanel({
  error,
  isSaving,
  onSubmit,
  slide,
}: {
  error: string | null
  isSaving: boolean
  onSubmit: (values: SlideEditValues) => void
  slide: CustomerHomeCarouselSlide
}) {
  const [values, setValues] = useState(() => editValuesFromSlide(slide))
  const [categoryLabel, setCategoryLabel] = useState(slide.category?.name ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const updateValue = <TKey extends keyof SlideEditValues>(
    key: TKey,
    value: SlideEditValues[TKey],
  ) => setValues((current) => ({ ...current, [key]: value }))

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (values.headline.trim().length < 2) {
      setFormError('Add the headline shown on the home screen.')
      return
    }

    if (values.description.trim().length < 2) {
      setFormError('Add a short description.')
      return
    }

    if (values.ctaActionType === 'SERVICE_CATEGORY' && !values.categoryId) {
      setFormError('Choose the service category this slide should open.')
      return
    }

    if (values.reason.trim().length < 5) {
      setFormError('Add a short change note for audit history.')
      return
    }

    onSubmit(values)
  }

  return (
    <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]" onSubmit={submit}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-foreground">Label</span>
            <Input
              disabled={!slide.availableActions.includes('UPDATE')}
              value={values.label}
              onChange={(event) => updateValue('label', event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-foreground">Display order</span>
            <Input
              disabled={!slide.availableActions.includes('UPDATE')}
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
            disabled={!slide.availableActions.includes('UPDATE')}
            value={values.headline}
            onChange={(event) => updateValue('headline', event.target.value)}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-semibold text-foreground">Description</span>
          <textarea
            className="form-input min-h-24 resize-y"
            disabled={!slide.availableActions.includes('UPDATE')}
            value={values.description}
            onChange={(event) => updateValue('description', event.target.value)}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-foreground">Button text</span>
            <Input
              disabled={!slide.availableActions.includes('UPDATE')}
              value={values.ctaLabel}
              onChange={(event) => updateValue('ctaLabel', event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-semibold text-foreground">Button opens</span>
            <select
              className="form-input"
              disabled={!slide.availableActions.includes('UPDATE')}
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
            disabled={!slide.availableActions.includes('UPDATE')}
            fetchOptions={searchCategoryLookupOptions}
            label="Service category"
            placeholder="Search category"
            queryKey={['lookup', 'categories', 'home-slide-detail']}
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
              disabled={!slide.availableActions.includes('UPDATE')}
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
            disabled={!slide.availableActions.includes('UPDATE')}
            type="datetime-local"
            value={values.startsAt}
            onChange={(event) => updateValue('startsAt', event.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-muted">Ends</span>
          <Input
            disabled={!slide.availableActions.includes('UPDATE')}
            type="datetime-local"
            value={values.endsAt}
            onChange={(event) => updateValue('endsAt', event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-muted">Change note *</span>
          <textarea
            className="form-input min-h-28 resize-y"
            disabled={!slide.availableActions.includes('UPDATE')}
            placeholder="Updated customer app home slide."
            value={values.reason}
            onChange={(event) => updateValue('reason', event.target.value)}
          />
        </label>
        {formError || error ? (
          <div className="rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
            {formError ?? error}
          </div>
        ) : null}
        <Button
          className="w-full"
          disabled={!slide.availableActions.includes('UPDATE')}
          isLoading={isSaving}
          type="submit"
        >
          <Pencil className="mr-2 size-4" />
          Save changes
        </Button>
      </div>
    </form>
  )
}

function DetailActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: DetailActionTarget
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const actionCopy: Record<DetailActionKind, { button: string; title: string; variant: 'danger' | 'primary' | 'secondary' }> = {
    ARCHIVE: { button: 'Archive', title: 'Archive home slide', variant: 'danger' },
    PAUSE: { button: 'Pause', title: 'Pause home slide', variant: 'secondary' },
    PUBLISH: { button: 'Publish', title: 'Publish home slide', variant: 'primary' },
    REMOVE_IMAGE: { button: 'Remove image', title: 'Remove slide image', variant: 'danger' },
  }
  const copy = actionCopy[action.kind]

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (reason.trim().length < 5) {
      setFormError('Add a short reason for audit history.')
      return
    }

    onSubmit(reason.trim())
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
            aria-label="Close action"
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
              placeholder="Reviewed and ready for customer app home."
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
            <Button isLoading={isSubmitting} size="sm" type="submit" variant={copy.variant}>
              {copy.button}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function CustomerAppHomeSlideDetailPage() {
  const { slideId } = useParams()
  const queryClient = useQueryClient()
  const canUpdateContent = usePermission('content:update')
  const canPublishContent = usePermission('content:publish')
  const [formError, setFormError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [actionTarget, setActionTarget] = useState<DetailActionTarget | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const slideQuery = useQuery({
    enabled: Boolean(slideId),
    queryKey: ['content', 'customer-app-home', 'slides', 'detail', slideId],
    queryFn: () => contentService.getCarouselSlide(slideId ?? ''),
  })
  const slide = slideQuery.data?.data ?? null

  const invalidateHomeQueries = () => {
    void queryClient.invalidateQueries({
      queryKey: ['content', 'customer-app-home'],
    })
    if (slideId) {
      void queryClient.invalidateQueries({
        queryKey: ['content', 'customer-app-home', 'slides', 'detail', slideId],
      })
    }
  }

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateCustomerHomeCarouselSlidePayload) =>
      contentService.updateCarouselSlide(slideId ?? '', payload),
    onSuccess: () => {
      setFormError(null)
      setActionMessage('Home slide saved.')
      invalidateHomeQueries()
    },
    onError: (error: Error) => setFormError(error.message),
  })
  const actionMutation = useMutation({
    mutationFn: ({
      kind,
      reason,
    }: {
      kind: DetailActionKind
      reason: string
    }) => {
      const id = slideId ?? ''

      if (kind === 'PUBLISH') return contentService.publishCarouselSlide(id, { reason })
      if (kind === 'PAUSE') return contentService.pauseCarouselSlide(id, { reason })
      if (kind === 'REMOVE_IMAGE') return contentService.removeCarouselImage(id, { reason })
      return contentService.archiveCarouselSlide(id, { reason })
    },
    onSuccess: (_, variables) => {
      setActionTarget(null)
      setActionError(null)
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
    mutationFn: async (file: File) => {
      if (!slide) throw new Error('Slide is not loaded yet.')
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
    onSuccess: () => {
      setUploadError(null)
      setActionMessage('Slide image uploaded.')
      invalidateHomeQueries()
    },
    onError: (error: Error) => setUploadError(error.message),
  })

  const handleImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setUploadError(null)
    setActionMessage(null)
    uploadMutation.mutate(file)
  }

  const runAction = (reason: string) => {
    if (!actionTarget) return
    setActionError(null)
    setActionMessage(null)
    actionMutation.mutate({ kind: actionTarget.kind, reason })
  }

  if (slideQuery.isLoading) {
    return (
      <PageContainer className="space-y-4">
        <DetailPageHeaderSkeleton />
        <Skeleton className="h-64 rounded-[0.875rem]" />
        <Skeleton className="h-80 rounded-[0.875rem]" />
      </PageContainer>
    )
  }

  if (slideQuery.isError || !slide) {
    return (
      <PageContainer className="space-y-4">
        <DetailPageHeader
          listHref={routePaths.customerAppHome}
          listLabel="Customer App Home"
          recordName="Home slide"
          title="Home slide"
        />
        <ErrorState
          description="We could not load this home carousel slide."
          title="Slide unavailable"
          onRetry={() => void slideQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const canPublish = canPublishContent && canRunSlideAction(slide, 'PUBLISH')
  const canPause = canUpdateContent && canRunSlideAction(slide, 'PAUSE')
  const canArchive = canUpdateContent && canRunSlideAction(slide, 'ARCHIVE')
  const canUpload = canUpdateContent && canRunSlideAction(slide, 'UPLOAD_IMAGE')

  return (
    <PageContainer className="space-y-4">
      <DetailPageHeader
        actionNode={
          <>
            {canPublish ? (
              <Button
                size="sm"
                type="button"
                onClick={() => setActionTarget({ kind: 'PUBLISH', slide })}
              >
                <Send className="mr-2 size-4" />
                Publish
              </Button>
            ) : null}
            {canPause ? (
              <Button
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setActionTarget({ kind: 'PAUSE', slide })}
              >
                <PauseCircle className="mr-2 size-4" />
                Pause
              </Button>
            ) : null}
            <Button
              disabled={!canUpload || uploadMutation.isPending}
              isLoading={uploadMutation.isPending}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="mr-2 size-4" />
              Upload image
            </Button>
            {canArchive ? (
              <Button
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setActionTarget({ kind: 'ARCHIVE', slide })}
              >
                <Archive className="mr-2 size-4" />
                Archive
              </Button>
            ) : null}
          </>
        }
        backHref={routePaths.customerAppHome}
        backLabel="Back to customer app home"
        description="Preview, edit, publish, and manage artwork for this customer app home slide."
        listHref={routePaths.customerAppHome}
        listLabel="Customer App Home"
        recordName={slide.headline}
        title={slide.headline}
        titleMetaNode={<Badge tone={statusTone(slide.status)}>{humanizeCode(slide.status)}</Badge>}
      />

      {actionMessage ? (
        <div className="rounded-[0.875rem] border border-success/25 bg-success/10 p-3 text-sm text-success">
          {actionMessage}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SectionShell
            description="This is the customer-facing card layout, using the uploaded artwork when available."
            icon={<Smartphone className="size-4" />}
            title="Customer preview"
          >
            <HeroPreview slide={slide} />
          </SectionShell>

          <SectionShell
            description="Edit the visible words, category destination, button behavior, and schedule."
            icon={<Pencil className="size-4" />}
            title="Slide setup"
          >
            <SlideEditPanel
              error={formError}
              isSaving={updateMutation.isPending}
              key={`${slide.slideId}-${slide.lifecycle.version}`}
              slide={slide}
              onSubmit={(values) => {
                setFormError(null)
                setActionMessage(null)
                updateMutation.mutate(buildUpdatePayload(values))
              }}
            />
          </SectionShell>
        </div>

        <div className="space-y-4">
          <SectionShell
            actionNode={
              <Button
                disabled={!canUpload || uploadMutation.isPending}
                isLoading={uploadMutation.isPending}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageUp className="mr-2 size-4" />
                Upload
              </Button>
            }
            description="Artwork is required before this slide can be published."
            icon={<ImageIcon className="size-4" />}
            title="Artwork"
          >
            <div className="flex aspect-square items-center justify-center rounded-[0.875rem] border border-border bg-surface-muted/35 p-3">
              {slide.image.url ? (
                <img alt="" className="max-h-full max-w-full object-contain" src={slide.image.url} />
              ) : (
                <div className="text-center text-muted">
                  <ImageIcon className="mx-auto size-10" />
                  <p className="mt-2 text-sm font-semibold">No image uploaded</p>
                </div>
              )}
            </div>
            {uploadError ? (
              <div className="mt-3 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {uploadError}
              </div>
            ) : null}
            {slide.image.width && slide.image.height ? (
              <p className="mt-3 text-xs text-muted">
                {slide.image.width} x {slide.image.height}px
              </p>
            ) : null}
          </SectionShell>

          <SectionShell icon={<CheckCircle2 className="size-4" />} title="Readiness">
            <div className="grid gap-2">
              {slide.blockingReasons.length === 0 ? (
                <DetailField
                  label="Publishing"
                  tone="success"
                  value="Ready to publish"
                />
              ) : (
                slide.blockingReasons.map((reason) => (
                  <DetailField
                    key={reason}
                    label="Needs attention"
                    tone="danger"
                    value={reason}
                  />
                ))
              )}
              {slide.warnings.map((warning) => (
                <DetailField
                  key={warning}
                  label="Warning"
                  tone="warning"
                  value={warning}
                />
              ))}
            </div>
          </SectionShell>

          <SectionShell icon={<CalendarClock className="size-4" />} title="Lifecycle">
            <div className="grid gap-2">
              <DetailField label="Created" value={formatDateSafe(slide.lifecycle.createdAt)} />
              <DetailField label="Updated" value={formatDateSafe(slide.lifecycle.updatedAt)} />
              <DetailField label="Published" value={formatDateSafe(slide.lifecycle.publishedAt)} />
              <DetailField label="Paused" value={formatDateSafe(slide.lifecycle.pausedAt)} />
              <DetailField label="Archived" value={formatDateSafe(slide.lifecycle.archivedAt)} />
            </div>
          </SectionShell>
        </div>
      </section>

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        ref={fileInputRef}
        type="file"
        onChange={handleImageSelected}
      />

      {actionTarget ? (
        <DetailActionModal
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
