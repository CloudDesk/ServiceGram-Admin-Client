import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  EyeOff,
  FileJson,
  FilePlus2,
  FileText,
  Globe2,
  Layers3,
  Send,
  ShieldAlert,
  TriangleAlert,
  X,
} from 'lucide-react'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { contentService } from '../services/content.service'
import type {
  ContentFormat,
  ContentPage as ContentPageRecord,
  ContentPageResponse,
  ContentPageType,
  UpdateContentPagePayload,
} from '../types/content.types'

type ContentActionKind = 'PUBLISH' | 'ARCHIVE'
type ContentModalKind = 'EDIT' | ContentActionKind

const pageTypes: ContentPageType[] = [
  'LEGAL',
  'FAQ',
  'SUPPORT',
  'ONBOARDING',
  'POLICY',
  'MARKETING',
]
const contentFormats: ContentFormat[] = ['MARKDOWN', 'HTML', 'PLAIN_TEXT']

const contentSectionIds = {
  body: 'content-body',
  information: 'content-information',
  lifecycle: 'content-lifecycle',
  metadata: 'content-metadata',
  seo: 'content-seo',
  signals: 'content-signals',
} as const

type ContentSectionId = (typeof contentSectionIds)[keyof typeof contentSectionIds]

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return 'Not available'

  try {
    return formatDate(value, true)
  } catch {
    return 'Not available'
  }
}

function statusTone(status: ContentPageRecord['status']): StatusTone {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'neutral'
  return 'warning'
}

function toneClass(tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning') {
  if (tone === 'success') return 'text-success'
  if (tone === 'warning') return 'text-warning'
  if (tone === 'danger') return 'text-danger'
  if (tone === 'info') return 'text-primary'
  return 'text-muted'
}

function metadataLabel(metadata: Record<string, unknown>) {
  const keys = Object.keys(metadata)
  if (keys.length === 0) return 'No metadata'
  return `${keys.length} metadata ${keys.length === 1 ? 'field' : 'fields'}`
}

function parseJsonObject(raw: string) {
  if (!raw.trim()) return {}
  const value = JSON.parse(raw) as unknown

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Metadata must be a JSON object.')
  }

  return value as Record<string, unknown>
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
}

function canRunContentAction({
  action,
  canPublishContent,
  canUpdateContent,
  contentPage,
}: {
  action: 'ARCHIVE' | 'PUBLISH' | 'UPDATE'
  canPublishContent: boolean
  canUpdateContent: boolean
  contentPage: ContentPageRecord
}) {
  if (!contentPage.availableActions.includes(action)) return false
  if (action === 'PUBLISH') return canPublishContent
  return canUpdateContent
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </div>
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  meta,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning'
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <div className="flex items-center justify-between gap-3">
        <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
          {label}
        </p>
        <span className={toneClass(tone)}>{icon}</span>
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  actionNode,
  children,
  description,
  icon,
  id,
  title,
}: {
  actionNode?: ReactNode
  children: ReactNode
  description?: string
  icon?: ReactNode
  id?: string
  title: string
}) {
  return (
    <section
      className="scroll-mt-4 rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface"
      id={id}
    >
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

function HeaderStatus({ contentPage }: { contentPage: ContentPageRecord }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={statusTone(contentPage.status)}>
        {humanizeCode(contentPage.status)}
      </Badge>
      <Badge tone="info">{humanizeCode(contentPage.pageType)}</Badge>
      <Badge tone={contentPage.isVisibleToCustomers ? 'success' : 'danger'}>
        {contentPage.isVisibleToCustomers ? 'Visible' : 'Hidden'}
      </Badge>
    </div>
  )
}

function HeaderActions({
  canPublishContent,
  canUpdateContent,
  contentPage,
  isSubmitting,
  onSelect,
}: {
  canPublishContent: boolean
  canUpdateContent: boolean
  contentPage: ContentPageRecord
  isSubmitting: boolean
  onSelect: (action: ContentModalKind) => void
}) {
  const canEdit = canRunContentAction({
    action: 'UPDATE',
    canPublishContent,
    canUpdateContent,
    contentPage,
  })
  const canPublish = canRunContentAction({
    action: 'PUBLISH',
    canPublishContent,
    canUpdateContent,
    contentPage,
  })
  const canArchive = canRunContentAction({
    action: 'ARCHIVE',
    canPublishContent,
    canUpdateContent,
    contentPage,
  })

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link to={`${routePaths.content}/new`}>
        <Button
          disabled={!canUpdateContent}
          size="sm"
          type="button"
          variant="secondary"
        >
          <FilePlus2 className="mr-2 size-4" />
          New
        </Button>
      </Link>
      {canEdit ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('EDIT')}
        >
          <Edit3 className="mr-2 size-4" />
          Edit
        </Button>
      ) : null}
      {canPublish ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          onClick={() => onSelect('PUBLISH')}
        >
          <Send className="mr-2 size-4" />
          Publish
        </Button>
      ) : null}
      {canArchive ? (
        <Button
          disabled={isSubmitting}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onSelect('ARCHIVE')}
        >
          <Archive className="mr-2 size-4" />
          Archive
        </Button>
      ) : null}
    </div>
  )
}

function EditContentModal({
  contentPage,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  contentPage: ContentPageRecord
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (payload: UpdateContentPagePayload) => void
}) {
  const [body, setBody] = useState(contentPage.body ?? contentPage.bodyPreview)
  const [contentFormat, setContentFormat] = useState<ContentFormat>(
    contentPage.contentFormat,
  )
  const [excerpt, setExcerpt] = useState(contentPage.excerpt ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [isVisibleToCustomers, setIsVisibleToCustomers] = useState(
    contentPage.isVisibleToCustomers,
  )
  const [metadataJson, setMetadataJson] = useState(formatJson(contentPage.metadata))
  const [pageType, setPageType] = useState<ContentPageType>(contentPage.pageType)
  const [reason, setReason] = useState('')
  const [seoDescription, setSeoDescription] = useState(
    contentPage.seo.description ?? '',
  )
  const [seoTitle, setSeoTitle] = useState(contentPage.seo.title ?? '')
  const [slug, setSlug] = useState(contentPage.slug)
  const [title, setTitle] = useState(contentPage.title)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedReason = reason.trim()
    const trimmedTitle = title.trim()
    const trimmedSlug = slug.trim()
    const trimmedBody = body.trim()

    if (!trimmedSlug || !trimmedTitle || !trimmedBody) {
      setFormError('Slug, title, and body are required.')
      return
    }

    if (trimmedReason.length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    try {
      onSubmit({
        slug: trimmedSlug,
        title: trimmedTitle,
        pageType,
        contentFormat,
        body,
        excerpt: excerpt.trim() || null,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        isVisibleToCustomers,
        metadata: parseJsonObject(metadataJson),
        reason: trimmedReason,
      })
    } catch (parseError) {
      setFormError(
        parseError instanceof Error
          ? parseError.message
          : 'Metadata must be valid JSON.',
      )
    }
  }

  return (
    <div className="premium-overlay flex items-start justify-center overflow-y-auto p-3 sm:p-6 lg:items-center">
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-[var(--shadow-overlay)] sm:max-h-[calc(100vh-3rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Edit content</h2>
            <p className="mt-1 text-sm text-muted">
              Saving changes creates a new content version and records an audit reason.
            </p>
          </div>
          <button
            aria-label="Close edit content"
            className="rounded-full p-2 text-muted transition hover:bg-surface-muted hover:text-foreground"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">Title</span>
                <input
                  className="form-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">Slug</span>
                <input
                  className="form-input"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Type</span>
                <select
                  className="form-input"
                  value={pageType}
                  onChange={(event) => setPageType(event.target.value as ContentPageType)}
                >
                  {pageTypes.map((item) => (
                    <option key={item} value={item}>
                      {humanizeCode(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Format</span>
                <select
                  className="form-input"
                  value={contentFormat}
                  onChange={(event) => setContentFormat(event.target.value as ContentFormat)}
                >
                  {contentFormats.map((item) => (
                    <option key={item} value={item}>
                      {humanizeCode(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface-muted/45 px-3 text-sm font-medium text-foreground md:col-span-2">
                <input
                  checked={isVisibleToCustomers}
                  type="checkbox"
                  onChange={(event) => setIsVisibleToCustomers(event.target.checked)}
                />
                Visible to customers
              </label>
              <label className="block space-y-2 md:col-span-2 xl:col-span-4">
                <span className="text-sm font-semibold text-foreground">Excerpt</span>
                <input
                  className="form-input"
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">SEO title</span>
                <input
                  className="form-input"
                  value={seoTitle}
                  onChange={(event) => setSeoTitle(event.target.value)}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">
                  SEO description
                </span>
                <textarea
                  className="form-input min-h-20 resize-y"
                  value={seoDescription}
                  onChange={(event) => setSeoDescription(event.target.value)}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">Body</span>
                <textarea
                  className="form-input min-h-72 resize-y font-mono text-xs leading-5"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-foreground">
                  Metadata JSON
                </span>
                <textarea
                  className="form-input min-h-72 resize-y font-mono text-xs leading-5"
                  value={metadataJson}
                  onChange={(event) => setMetadataJson(event.target.value)}
                />
              </label>
              <label className="block space-y-2 md:col-span-2 xl:col-span-4">
                <span className="text-sm font-semibold text-foreground">
                  Reason <span className="text-danger">*</span>
                </span>
                <textarea
                  className="form-input min-h-20 resize-y"
                  placeholder="Updated after content review."
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            </div>

            {formError || error ? (
              <div className="mt-4 rounded-[0.75rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
                {formError ?? error}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
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
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ActionModal({
  action,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  action: ContentActionKind
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const isArchive = action === 'ARCHIVE'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedReason = reason.trim()
    setFormError(null)

    if (trimmedReason.length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    onSubmit(trimmedReason)
  }

  return (
    <div className="premium-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-[0.875rem] border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isArchive ? 'Archive content' : 'Publish content'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isArchive
                ? 'Archived pages are removed from customer-facing surfaces.'
                : 'The current version will become customer-facing.'}
            </p>
          </div>
          <button
            aria-label="Close content action"
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
              placeholder={
                isArchive
                  ? 'Replacing this content with the updated page.'
                  : 'Approved after final content review.'
              }
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
              variant={isArchive ? 'danger' : 'primary'}
            >
              {isArchive ? 'Archive' : 'Publish'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="h-16 w-full rounded-[0.875rem]" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-28 rounded-[0.875rem]" key={index} />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-[0.875rem]" />
    </PageContainer>
  )
}

function SignalBadgeGroup({
  emptyLabel,
  items,
  tone,
}: {
  emptyLabel: string
  items: string[]
  tone: StatusTone
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <Badge key={item} tone={tone}>
            {humanizeCode(item)}
          </Badge>
        ))
      ) : (
        <Badge tone="success">{emptyLabel}</Badge>
      )}
    </div>
  )
}

function JsonPanel({
  id,
  title,
  value,
}: {
  id?: string
  title: string
  value: unknown
}) {
  return (
    <SectionShell id={id} icon={<FileJson className="size-4" />} title={title}>
      <pre className="max-h-[28rem] overflow-auto rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-xs leading-5 text-foreground">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </SectionShell>
  )
}

function RelatedRecordRow({
  actionLabel = 'Open',
  canOpen,
  icon,
  label,
  meta,
  onOpen,
  value,
}: {
  actionLabel?: string
  canOpen: boolean
  icon: ReactNode
  label: string
  meta: string
  onOpen?: () => void
  value: string
}) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted">{meta}</p>
        </div>
      </div>
      {canOpen && onOpen ? (
        <Button className="shrink-0" size="sm" type="button" variant="secondary" onClick={onOpen}>
          <ArrowUpRight className="mr-2 size-4" />
          {actionLabel}
        </Button>
      ) : (
        <Badge tone="neutral">View only</Badge>
      )}
    </div>
  )
}

function RelatedRecordsPanel({
  canEditContent,
  canReadAudit,
  contentPage,
  onEdit,
  onNavigate,
  onOpenSection,
}: {
  canEditContent: boolean
  canReadAudit: boolean
  contentPage: ContentPageRecord
  onEdit: () => void
  onNavigate: (path: string) => void
  onOpenSection: (sectionId: ContentSectionId) => void
}) {
  return (
    <SectionShell
      description="Records, audit trail, and child sections for this content page."
      icon={<ArrowUpRight className="size-4" />}
      title="Related records"
    >
      <div className="divide-y divide-border">
        <RelatedRecordRow
          actionLabel="Library"
          canOpen
          icon={<FileText className="size-4" />}
          label="Content library"
          meta={`${humanizeCode(contentPage.status)} | ${humanizeCode(contentPage.pageType)}`}
          value={contentPage.slug}
          onOpen={() => onNavigate(buildContentLibraryPath(contentPage))}
        />
        <RelatedRecordRow
          actionLabel="Edit"
          canOpen={canEditContent}
          icon={<Edit3 className="size-4" />}
          label="Editable record"
          meta="Updates create a new version and audit event"
          value={`v${contentPage.version}`}
          onOpen={onEdit}
        />
        <RelatedRecordRow
          actionLabel="Body"
          canOpen
          icon={<FileText className="size-4" />}
          label="Body"
          meta={humanizeCode(contentPage.contentFormat)}
          value={contentPage.bodyPreview}
          onOpen={() => onOpenSection(contentSectionIds.body)}
        />
        <RelatedRecordRow
          actionLabel="SEO"
          canOpen
          icon={<Globe2 className="size-4" />}
          label="SEO"
          meta={contentPage.seo.title ? 'Search preview fields present' : 'Needs SEO title'}
          value={contentPage.seo.title ?? contentPage.title}
          onOpen={() => onOpenSection(contentSectionIds.seo)}
        />
        <RelatedRecordRow
          actionLabel="Metadata"
          canOpen
          icon={<FileJson className="size-4" />}
          label="Metadata"
          meta={metadataLabel(contentPage.metadata)}
          value={contentPage.pageId}
          onOpen={() => onOpenSection(contentSectionIds.metadata)}
        />
        <RelatedRecordRow
          actionLabel="Lifecycle"
          canOpen
          icon={<CalendarClock className="size-4" />}
          label="Lifecycle"
          meta={`Updated ${formatDateSafe(contentPage.lifecycle.updatedAt)}`}
          value={
            contentPage.publishedVersion
              ? `Published v${contentPage.publishedVersion}`
              : 'Not published'
          }
          onOpen={() => onOpenSection(contentSectionIds.lifecycle)}
        />
        <RelatedRecordRow
          actionLabel="Audit"
          canOpen={canReadAudit}
          icon={<ClipboardList className="size-4" />}
          label="Audit trail"
          meta="Filtered by module, entity type, and page id"
          value={contentPage.pageId}
          onOpen={() => onNavigate(buildContentAuditPath(contentPage))}
        />
        <RelatedRecordRow
          actionLabel="Signals"
          canOpen
          icon={<Globe2 className="size-4" />}
          label="Customer visibility"
          meta={
            contentPage.status === 'PUBLISHED'
              ? 'Published content page'
              : 'Not customer-facing until published'
          }
          value={contentPage.isVisibleToCustomers ? 'Visible' : 'Hidden'}
          onOpen={() => onOpenSection(contentSectionIds.signals)}
        />
      </div>
    </SectionShell>
  )
}

function buildContentLibraryPath(contentPage: ContentPageRecord) {
  const params = new URLSearchParams({
    contentFormat: contentPage.contentFormat,
    isVisibleToCustomers: String(contentPage.isVisibleToCustomers),
    pageType: contentPage.pageType,
    search: contentPage.slug,
    status: contentPage.status,
  })

  return `${routePaths.content}?${params.toString()}#content-pages`
}

function buildContentAuditPath(contentPage: ContentPageRecord) {
  const params = new URLSearchParams({
    moduleCode: 'content',
    entityType: 'content_page',
    entityId: contentPage.pageId,
  })

  return `${routePaths.audit}?${params.toString()}`
}

function LifecyclePanel({ contentPage }: { contentPage: ContentPageRecord }) {
  return (
    <SectionShell
      description="Version ownership and content lifecycle timestamps."
      id={contentSectionIds.lifecycle}
      icon={<CalendarClock className="size-4" />}
      title="Lifecycle"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailField label="Created" value={formatDateSafe(contentPage.lifecycle.createdAt)} />
        <DetailField label="Updated" value={formatDateSafe(contentPage.lifecycle.updatedAt)} />
        <DetailField
          label="Published"
          value={formatDateSafe(contentPage.lifecycle.publishedAt)}
        />
        <DetailField
          label="Archived"
          value={formatDateSafe(contentPage.lifecycle.archivedAt)}
        />
        <DetailField
          label="Updated by"
          value={contentPage.lifecycle.updatedByAdminId ?? 'System'}
        />
        <DetailField
          label="Published by"
          value={contentPage.lifecycle.publishedByAdminId ?? 'Not published'}
        />
      </div>
    </SectionShell>
  )
}

function SignalsPanel({
  canPublishContent,
  canUpdateContent,
  contentPage,
}: {
  canPublishContent: boolean
  canUpdateContent: boolean
  contentPage: ContentPageRecord
}) {
  const permittedActions = contentPage.availableActions.filter((action) =>
    canRunContentAction({
      action: action as 'ARCHIVE' | 'PUBLISH' | 'UPDATE',
      canPublishContent,
      canUpdateContent,
      contentPage,
    }),
  )

  return (
    <SectionShell
      description="Backend workflow signals and actions permitted for this admin."
      id={contentSectionIds.signals}
      icon={<TriangleAlert className="size-4" />}
      title="Signals"
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Warnings
          </p>
          <SignalBadgeGroup
            emptyLabel="No warnings"
            items={contentPage.warnings}
            tone="warning"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Blocking reasons
          </p>
          <SignalBadgeGroup
            emptyLabel="No blockers"
            items={contentPage.blockingReasons}
            tone="danger"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted">
            Available to you
          </p>
          <SignalBadgeGroup
            emptyLabel="No permitted actions"
            items={permittedActions}
            tone="neutral"
          />
        </div>
        <DetailField
          label="Recommended next"
          value={humanizeCode(contentPage.nextRecommendedAction)}
        />
      </div>
    </SectionShell>
  )
}

export function ContentDetailPage() {
  const { contentId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canReadAudit = usePermission('audit:read')
  const canPublishContent = usePermission('content:publish')
  const canUpdateContent = usePermission('content:update')
  const [selectedModal, setSelectedModal] = useState<ContentModalKind | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  const contentQuery = useQuery({
    enabled: Boolean(contentId),
    queryKey: ['content-page-detail', contentId],
    queryFn: () => contentService.getPage(contentId ?? ''),
  })

  const contentPage = contentQuery.data?.data

  const updateMutation = useMutation<ContentPageResponse, Error, UpdateContentPagePayload>({
    mutationFn: (payload) => {
      if (!contentPage) throw new Error('Content page is not loaded yet.')
      return contentService.updatePage(contentPage.pageId, payload)
    },
    onMutate: () => setModalError(null),
    onSuccess: () => {
      setSelectedModal(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['content-pages'] }),
        queryClient.invalidateQueries({ queryKey: ['content-page-detail', contentId] }),
      ])
    },
    onError: (error) => {
      setModalError(error instanceof Error ? error.message : 'Content update failed.')
    },
  })

  const actionMutation = useMutation<ContentPageResponse, Error, {
    action: ContentActionKind
    reason: string
  }>({
    mutationFn: async ({ action, reason }) => {
      if (!contentPage) {
        throw new Error('Content page is not loaded yet.')
      }

      if (action === 'PUBLISH') {
        return contentService.publishPage(contentPage.pageId, { reason })
      }

      return contentService.archivePage(contentPage.pageId, { reason })
    },
    onMutate: () => setModalError(null),
    onSuccess: () => {
      setSelectedModal(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['content-pages'] }),
        queryClient.invalidateQueries({ queryKey: ['content-page-detail', contentId] }),
      ])
    },
    onError: (error) => {
      setModalError(error instanceof Error ? error.message : 'Content action failed.')
    },
  })

  if (!contentId) {
    return (
      <PageContainer>
        <ErrorState description="The content route is missing a content id." title="Content not found" />
      </PageContainer>
    )
  }

  if (contentQuery.isLoading) {
    return <DetailSkeleton />
  }

  if (contentQuery.isError || !contentPage) {
    return (
      <PageContainer>
        <ErrorState
          description={
            contentQuery.error instanceof Error
              ? contentQuery.error.message
              : 'We could not load this content page.'
          }
          title="Content unavailable"
          onRetry={() => void contentQuery.refetch()}
        />
      </PageContainer>
    )
  }

  const hasDraftDrift =
    contentPage.publishedVersion !== null &&
    contentPage.version !== contentPage.publishedVersion
  const isSubmitting = updateMutation.isPending || actionMutation.isPending
  const canEditContent = canRunContentAction({
    action: 'UPDATE',
    canPublishContent,
    canUpdateContent,
    contentPage,
  })
  const openEditContent = () => {
    if (!canEditContent) return

    setModalError(null)
    setSelectedModal('EDIT')
  }
  const openSection = (sectionId: ContentSectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <HeaderActions
            canPublishContent={canPublishContent}
            canUpdateContent={canUpdateContent}
            contentPage={contentPage}
            isSubmitting={isSubmitting}
            onSelect={(action) => {
              setModalError(null)
              setSelectedModal(action)
            }}
          />
        }
        description={`${humanizeCode(contentPage.pageType)} content page`}
        listHref={routePaths.content}
        listLabel="Content"
        recordName={contentPage.title}
        titleMetaNode={<HeaderStatus contentPage={contentPage} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="Status"
          meta={
            contentPage.nextRecommendedAction
              ? humanizeCode(contentPage.nextRecommendedAction)
              : 'No next action'
          }
          tone={
            contentPage.status === 'PUBLISHED'
              ? 'success'
              : contentPage.status === 'ARCHIVED'
                ? 'neutral'
                : 'warning'
          }
          value={humanizeCode(contentPage.status)}
        />
        <SummaryCard
          icon={<Layers3 className="size-4" />}
          label="Version"
          meta={hasDraftDrift ? 'Draft differs from published' : 'Current version'}
          tone={hasDraftDrift ? 'warning' : 'info'}
          value={`v${contentPage.version}`}
        />
        <SummaryCard
          icon={
            contentPage.isVisibleToCustomers ? (
              <Eye className="size-4" />
            ) : (
              <EyeOff className="size-4" />
            )
          }
          label="Visibility"
          meta="Customer-facing surfaces"
          tone={contentPage.isVisibleToCustomers ? 'success' : 'danger'}
          value={contentPage.isVisibleToCustomers ? 'Visible' : 'Hidden'}
        />
        <SummaryCard
          icon={<ShieldAlert className="size-4" />}
          label="Signals"
          meta={`${contentPage.blockingReasons.length} blocking`}
          tone={
            contentPage.blockingReasons.length > 0
              ? 'danger'
              : contentPage.warnings.length > 0
                ? 'warning'
                : 'success'
          }
          value={String(contentPage.warnings.length + contentPage.blockingReasons.length)}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <LifecyclePanel contentPage={contentPage} />
        <SignalsPanel
          canPublishContent={canPublishContent}
          canUpdateContent={canUpdateContent}
          contentPage={contentPage}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.55fr)]">
        <div className="space-y-3">
          <SectionShell
            description="Core identity, lifecycle state, and publish visibility."
            id={contentSectionIds.information}
            icon={<FileText className="size-4" />}
            title="Content information"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Slug" value={contentPage.slug} />
              <DetailField label="Type" value={humanizeCode(contentPage.pageType)} />
              <DetailField label="Format" value={humanizeCode(contentPage.contentFormat)} />
              <DetailField
                label="Published version"
                value={
                  contentPage.publishedVersion
                    ? `v${contentPage.publishedVersion}`
                    : 'Not published'
                }
              />
              <DetailField label="Excerpt" value={contentPage.excerpt ?? 'Not available'} />
              <DetailField label="Metadata" value={metadataLabel(contentPage.metadata)} />
            </div>
          </SectionShell>

          <SectionShell
            description="Stored body is shown as plain text for safe admin review."
            id={contentSectionIds.body}
            icon={<FileText className="size-4" />}
            title="Body"
          >
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-sm leading-6 text-foreground">
              {contentPage.body ?? contentPage.bodyPreview}
            </pre>
          </SectionShell>

          <SectionShell
            id={contentSectionIds.seo}
            icon={<Globe2 className="size-4" />}
            title="SEO"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField
                label="SEO title"
                value={contentPage.seo.title ?? 'Not available'}
              />
              <DetailField
                label="SEO description"
                value={contentPage.seo.description ?? 'Not available'}
              />
            </div>
          </SectionShell>

          <JsonPanel
            id={contentSectionIds.metadata}
            title="Metadata"
            value={contentPage.metadata}
          />
        </div>

        <RelatedRecordsPanel
          canEditContent={canEditContent}
          canReadAudit={canReadAudit}
          contentPage={contentPage}
          onEdit={openEditContent}
          onNavigate={navigate}
          onOpenSection={openSection}
        />
      </section>

      {selectedModal === 'EDIT' ? (
        <EditContentModal
          contentPage={contentPage}
          error={modalError}
          isSubmitting={updateMutation.isPending}
          onClose={() => {
            if (!updateMutation.isPending) {
              setSelectedModal(null)
              setModalError(null)
            }
          }}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />
      ) : null}

      {selectedModal === 'PUBLISH' || selectedModal === 'ARCHIVE' ? (
        <ActionModal
          action={selectedModal}
          error={modalError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedModal(null)
              setModalError(null)
            }
          }}
          onSubmit={(reason) =>
            actionMutation.mutate({
              action: selectedModal,
              reason,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
