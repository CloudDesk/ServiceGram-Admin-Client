import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { contentService } from '../services/content.service'
import type { ContentPage } from '../types/content.types'

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="break-words text-sm text-foreground">{value ?? 'Not available'}</p>
    </div>
  )
}

function statusTone(status: ContentPage['status']) {
  if (status === 'PUBLISHED') {
    return 'success'
  }

  if (status === 'ARCHIVED') {
    return 'neutral'
  }

  return 'warning'
}

export function ContentDetailPage() {
  const { contentId } = useParams()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const pagesQuery = useQuery({
    enabled: Boolean(contentId),
    queryKey: ['content-page-detail', contentId],
    queryFn: () => contentService.getPages({ page: 1, limit: 100 }),
  })

  const contentPage = useMemo(
    () => pagesQuery.data?.data.find((page) => page.pageId === contentId),
    [contentId, pagesQuery.data?.data],
  )

  const actionMutation = useMutation({
    mutationFn: async (action: 'PUBLISH' | 'ARCHIVE') => {
      if (!contentPage || !reason.trim()) {
        throw new Error('A reason is required for this action.')
      }

      if (action === 'PUBLISH') {
        return contentService.publishPage(contentPage.pageId, { reason })
      }

      return contentService.archivePage(contentPage.pageId, { reason })
    },
    onMutate: () => setActionError(null),
    onSuccess: () => {
      setReason('')
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

  if (pagesQuery.isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[24rem] w-full" />
      </PageContainer>
    )
  }

  if (pagesQuery.isError) {
    return (
      <PageContainer>
        <ErrorState
          description="We could not load this content page."
          title="Content unavailable"
          onRetry={() => void pagesQuery.refetch()}
        />
      </PageContainer>
    )
  }

  if (!contentPage) {
    return (
      <PageContainer>
        <EmptyState description="No content page matched this id." title="Content not found" />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <DetailPageHeader
        actionNode={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {contentPage.availableActions.includes('PUBLISH') ? (
              <Button
                disabled={actionMutation.isPending}
                size="sm"
                onClick={() => void actionMutation.mutateAsync('PUBLISH')}
              >
                Publish
              </Button>
            ) : null}
            {contentPage.availableActions.includes('ARCHIVE') ? (
              <Button
                disabled={actionMutation.isPending}
                size="sm"
                variant="secondary"
                onClick={() => void actionMutation.mutateAsync('ARCHIVE')}
              >
                Archive
              </Button>
            ) : null}
          </div>
        }
        listHref={routePaths.content}
        listLabel="Content"
        recordName={contentPage.title}
        titleMetaNode={<Badge tone={statusTone(contentPage.status)}>{contentPage.status}</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4 lg:col-span-2">
          <h2 className="text-base font-semibold text-foreground">Content Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Slug" value={contentPage.slug} />
            <DetailField label="Type" value={contentPage.pageType} />
            <DetailField label="Format" value={contentPage.contentFormat} />
            <DetailField label="Version" value={contentPage.version} />
            <DetailField label="Published Version" value={contentPage.publishedVersion} />
            <DetailField label="Visible" value={contentPage.isVisibleToCustomers ? 'Yes' : 'No'} />
            <DetailField label="Updated" value={contentPage.lifecycle.updatedAt} />
            <DetailField label="Published" value={contentPage.lifecycle.publishedAt} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted">Preview</p>
            <p className="whitespace-pre-wrap rounded-[0.85rem] border border-border bg-background/40 p-3 text-sm text-foreground">
              {contentPage.bodyPreview}
            </p>
          </div>
        </div>
        <div className="space-y-4 rounded-[1rem] border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">Action Reason</h2>
          <textarea
            className="min-h-28 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {actionError ? <p className="text-sm text-danger">{actionError}</p> : null}
          <DetailField
            label="Warnings"
            value={contentPage.warnings.length ? contentPage.warnings.join(', ') : null}
          />
          <DetailField
            label="Blocking Reasons"
            value={
              contentPage.blockingReasons.length
                ? contentPage.blockingReasons.join(', ')
                : null
            }
          />
        </div>
      </section>
    </PageContainer>
  )
}
