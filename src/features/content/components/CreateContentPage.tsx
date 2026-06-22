import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { routePaths } from '../../../config/routes'
import { contentService } from '../services/content.service'
import type { ContentFormat, ContentPageType, CreateContentPagePayload } from '../types/content.types'

const pageTypes: ContentPageType[] = [
  'LEGAL',
  'FAQ',
  'SUPPORT',
  'ONBOARDING',
  'POLICY',
  'MARKETING',
]
const formats: ContentFormat[] = ['MARKDOWN', 'HTML', 'PLAIN_TEXT']

export function CreateContentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [pageType, setPageType] = useState<ContentPageType>('FAQ')
  const [contentFormat, setContentFormat] = useState<ContentFormat>('MARKDOWN')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [isVisibleToCustomers, setIsVisibleToCustomers] = useState(true)
  const [reason, setReason] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload: CreateContentPagePayload) => contentService.createPage(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['content-pages'] })
      navigate(routePaths.content)
    },
  })

  const submit = () => {
    void createMutation.mutateAsync({
      slug,
      title,
      pageType,
      contentFormat,
      body,
      excerpt: excerpt.trim() || null,
      isVisibleToCustomers,
      metadata: {},
      reason,
    })
  }

  return (
    <PageContainer>
      <DetailPageHeader
        listHref={routePaths.content}
        listLabel="Content"
        recordName="New Content"
      />

      <section className="rounded-[1.5rem] border border-border bg-surface p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Slug</span>
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Title</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Type</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={pageType}
              onChange={(event) => setPageType(event.target.value as ContentPageType)}
            >
              {pageTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">Format</span>
            <select
              className="min-h-11 w-full rounded-[0.9rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
              value={contentFormat}
              onChange={(event) => setContentFormat(event.target.value as ContentFormat)}
            >
              {formats.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Excerpt</span>
            <Input value={excerpt} onChange={(event) => setExcerpt(event.target.value)} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Body</span>
            <textarea
              className="min-h-56 w-full rounded-[0.9rem] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Reason</span>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              checked={isVisibleToCustomers}
              type="checkbox"
              onChange={(event) => setIsVisibleToCustomers(event.target.checked)}
            />
            Visible to customers
          </label>
        </div>

        {createMutation.isError ? (
          <div className="mt-4">
            <ErrorState
              description={
                createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Content creation failed.'
              }
              title="Content not created"
            />
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <Button isLoading={createMutation.isPending} onClick={submit}>
            Create Draft
          </Button>
        </div>
      </section>
    </PageContainer>
  )
}
