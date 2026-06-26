import { FilePlus2, X } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import type { StatusTone } from '../../../types/status.types'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { contentService } from '../services/content.service'
import type { ContentPage as ContentPageRecord } from '../types/content.types'

type ContentActionKind = 'PUBLISH' | 'ARCHIVE'

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
  return formatDate(value, true)
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

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-border bg-surface-muted/35 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-foreground">
        {value ?? 'Not available'}
      </p>
    </div>
  )
}

function SummaryCard({
  label,
  meta,
  tone,
  value,
}: {
  label: string
  meta: string
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning'
  value: string
}) {
  return (
    <article className="rounded-[0.875rem] border border-border bg-surface px-3 py-3 shadow-surface">
      <p className={cn('text-xs font-semibold uppercase tracking-normal', toneClass(tone))}>
        {label}
      </p>
      <p className={cn('mt-3 text-2xl font-semibold tracking-normal', toneClass(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{meta}</p>
    </article>
  )
}

function SectionShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode
  description?: string
  title: string
}) {
  return (
    <section className="rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
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

  const submit = () => {
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
            type="button"
            variant={isArchive ? 'danger' : 'primary'}
            onClick={submit}
          >
            {isArchive ? 'Archive' : 'Publish'}
          </Button>
        </div>
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

export function ContentDetailPage() {
  const { contentId } = useParams()
  const queryClient = useQueryClient()
  const can = useAuthStore((state) => state.can)
  const canCreateContent = can('content:update')
  const canPublishContent = can('content:publish')
  const canArchiveContent = can('content:update')
  const [selectedAction, setSelectedAction] = useState<ContentActionKind | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const contentQuery = useQuery({
    enabled: Boolean(contentId),
    queryKey: ['content-page-detail', contentId],
    queryFn: () => contentService.getPage(contentId ?? ''),
  })

  const contentPage = contentQuery.data?.data

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      reason,
    }: {
      action: ContentActionKind
      reason: string
    }) => {
      if (!contentPage) {
        throw new Error('Content page is not loaded yet.')
      }

      if (action === 'PUBLISH') {
        return contentService.publishPage(contentPage.pageId, { reason })
      }

      return contentService.archivePage(contentPage.pageId, { reason })
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setSelectedAction(null)
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['content-pages'] }),
        queryClient.invalidateQueries({ queryKey: ['content-page-detail', contentId] }),
      ])
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Content action failed.')
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

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canCreateContent ? (
              <Link to={`${routePaths.content}/new`}>
                <Button size="sm" type="button" variant="secondary">
                  <FilePlus2 className="mr-2 size-4" />
                  New Content
                </Button>
              </Link>
            ) : null}
            {canPublishContent && contentPage.availableActions.includes('PUBLISH') ? (
              <Button
                disabled={actionMutation.isPending}
                size="sm"
                type="button"
                onClick={() => {
                  setActionError(null)
                  setSelectedAction('PUBLISH')
                }}
              >
                Publish
              </Button>
            ) : null}
            {canArchiveContent && contentPage.availableActions.includes('ARCHIVE') ? (
              <Button
                disabled={actionMutation.isPending}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  setActionError(null)
                  setSelectedAction('ARCHIVE')
                }}
              >
                Archive
              </Button>
            ) : null}
          </div>
        }
        description={`${humanizeCode(contentPage.pageType)} content page`}
        listHref={routePaths.content}
        listLabel="Content"
        recordName={contentPage.title}
        titleMetaNode={<HeaderStatus contentPage={contentPage} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Status"
          meta={contentPage.nextRecommendedAction ? humanizeCode(contentPage.nextRecommendedAction) : 'No next action'}
          tone={contentPage.status === 'PUBLISHED' ? 'success' : contentPage.status === 'ARCHIVED' ? 'neutral' : 'warning'}
          value={humanizeCode(contentPage.status)}
        />
        <SummaryCard
          label="Version"
          meta={hasDraftDrift ? 'Draft differs from published' : 'Current editable version'}
          tone={hasDraftDrift ? 'warning' : 'info'}
          value={`v${contentPage.version}`}
        />
        <SummaryCard
          label="Visibility"
          meta="Customer-facing surfaces"
          tone={contentPage.isVisibleToCustomers ? 'success' : 'danger'}
          value={contentPage.isVisibleToCustomers ? 'Visible' : 'Hidden'}
        />
        <SummaryCard
          label="Signals"
          meta={`${contentPage.blockingReasons.length} blocking`}
          tone={contentPage.blockingReasons.length > 0 ? 'danger' : contentPage.warnings.length > 0 ? 'warning' : 'success'}
          value={String(contentPage.warnings.length + contentPage.blockingReasons.length)}
        />
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
        <div className="space-y-3">
          <SectionShell
            description="Core identity, lifecycle state, and publish visibility."
            title="Content information"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Slug" value={contentPage.slug} />
              <DetailField label="Type" value={humanizeCode(contentPage.pageType)} />
              <DetailField label="Format" value={humanizeCode(contentPage.contentFormat)} />
              <DetailField label="Published version" value={contentPage.publishedVersion ? `v${contentPage.publishedVersion}` : null} />
              <DetailField label="Excerpt" value={contentPage.excerpt} />
              <DetailField label="Metadata" value={metadataLabel(contentPage.metadata)} />
            </div>
          </SectionShell>

          <SectionShell
            description="Stored body is shown as plain text for safe admin review."
            title="Body"
          >
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-[0.75rem] border border-border bg-surface-muted/35 p-3 text-sm leading-6 text-foreground">
              {contentPage.body ?? contentPage.bodyPreview}
            </pre>
          </SectionShell>

          <SectionShell title="SEO">
            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="SEO title" value={contentPage.seo.title} />
              <DetailField label="SEO description" value={contentPage.seo.description} />
            </div>
          </SectionShell>
        </div>

        <div className="space-y-3">
          <SectionShell title="Timeline">
            <div className="grid gap-3">
              <DetailField label="Created" value={formatDateSafe(contentPage.lifecycle.createdAt)} />
              <DetailField label="Updated" value={formatDateSafe(contentPage.lifecycle.updatedAt)} />
              <DetailField label="Published" value={formatDateSafe(contentPage.lifecycle.publishedAt)} />
              <DetailField label="Archived" value={formatDateSafe(contentPage.lifecycle.archivedAt)} />
            </div>
          </SectionShell>

          <SectionShell
            description="Operational warnings and lifecycle blockers."
            title="Signals"
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Warnings
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contentPage.warnings.length > 0 ? (
                    contentPage.warnings.map((warning) => (
                      <Badge key={warning} tone="warning">
                        {warning}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No warnings</Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Blocking reasons
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contentPage.blockingReasons.length > 0 ? (
                    contentPage.blockingReasons.map((reason) => (
                      <Badge key={reason} tone="danger">
                        {reason}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="success">No blockers</Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-normal text-muted">
                  Available actions
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {contentPage.availableActions.length > 0 ? (
                    contentPage.availableActions.map((action) => (
                      <Badge key={action} tone="info">
                        {humanizeCode(action)}
                      </Badge>
                    ))
                  ) : (
                    <Badge tone="neutral">No action</Badge>
                  )}
                </div>
              </div>
            </div>
          </SectionShell>
        </div>
      </div>

      {selectedAction ? (
        <ActionModal
          action={selectedAction}
          error={actionError}
          isSubmitting={actionMutation.isPending}
          onClose={() => {
            if (!actionMutation.isPending) {
              setSelectedAction(null)
              setActionError(null)
            }
          }}
          onSubmit={(reason) =>
            actionMutation.mutate({
              action: selectedAction,
              reason,
            })
          }
        />
      ) : null}
    </PageContainer>
  )
}
