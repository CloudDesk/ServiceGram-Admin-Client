import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'
import { FileJson, FileText, Globe2, Save } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { DetailPageHeader } from '../../../components/layout/DetailPageHeader'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Button } from '../../../components/ui/Button'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { cn } from '../../../utils/cn'
import { contentService } from '../services/content.service'
import type {
  ContentFormat,
  ContentPageType,
  CreateContentPagePayload,
} from '../types/content.types'

const pageTypes: ContentPageType[] = [
  'LEGAL',
  'FAQ',
  'SUPPORT',
  'ONBOARDING',
  'POLICY',
  'MARKETING',
]
const formats: ContentFormat[] = ['MARKDOWN', 'HTML', 'PLAIN_TEXT']
const createContentFormId = 'create-content-form'

function humanizeCode(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function parseJsonObject(raw: string) {
  if (!raw.trim()) return {}

  const value = JSON.parse(raw) as unknown

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Metadata must be a JSON object.')
  }

  return value as Record<string, unknown>
}

function FormSection({
  children,
  className,
  icon,
  title,
}: {
  children: ReactNode
  className?: string
  icon: ReactNode
  title: string
}) {
  return (
    <section
      className={cn(
        'rounded-[0.875rem] border border-border bg-surface p-4 shadow-surface',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export function CreateContentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canCreateContent = usePermission('content:update')
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [pageType, setPageType] = useState<ContentPageType>('FAQ')
  const [contentFormat, setContentFormat] = useState<ContentFormat>('MARKDOWN')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [metadataJson, setMetadataJson] = useState('{}')
  const [isVisibleToCustomers, setIsVisibleToCustomers] = useState(true)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (payload: CreateContentPagePayload) =>
      contentService.createPage(payload),
    onMutate: () => setFormError(null),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['content-pages'] })
      navigate(`${routePaths.content}/${response.data.pageId}`)
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : 'Content creation failed.',
      )
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const trimmedSlug = slug.trim()
    const trimmedTitle = title.trim()
    const trimmedBody = body.trim()
    const trimmedReason = reason.trim()

    if (!canCreateContent) {
      setFormError('Your current admin role cannot create content pages.')
      return
    }

    if (!trimmedSlug || !trimmedTitle || !trimmedBody) {
      setFormError('Slug, title, and body are required.')
      return
    }

    if (trimmedReason.length < 5) {
      setFormError('Reason must be at least 5 characters.')
      return
    }

    let metadata: Record<string, unknown>

    try {
      metadata = parseJsonObject(metadataJson)
    } catch (parseError) {
      setFormError(
        parseError instanceof Error
          ? parseError.message
          : 'Metadata must be valid JSON.',
      )
      return
    }

    createMutation.mutate({
      slug: trimmedSlug,
      title: trimmedTitle,
      pageType,
      contentFormat,
      body,
      excerpt: excerpt.trim() || null,
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      isVisibleToCustomers,
      metadata,
      reason: trimmedReason,
    })
  }

  if (!canCreateContent) {
    return (
      <PageContainer>
        <ErrorState
          description="Your current admin role can view content but cannot create or update pages."
          title="Content creation unavailable"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="!px-3 !py-4 sm:!px-4 lg:!px-6">
      <DetailPageHeader
        actionNode={
          <Button
            disabled={createMutation.isPending}
            form={createContentFormId}
            isLoading={createMutation.isPending}
            size="sm"
            type="submit"
          >
            <Save className="mr-2 size-4" />
            Create Draft
          </Button>
        }
        description="Create a draft content page with review metadata."
        listHref={routePaths.content}
        listLabel="Content"
        recordName="New content"
      />

      <form className="space-y-3" id={createContentFormId} onSubmit={submit}>
        {formError ? (
          <div className="rounded-[0.875rem] border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
            {formError}
          </div>
        ) : null}

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.55fr)]">
          <FormSection
            icon={<FileText className="size-4" />}
            title="Content Identity"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Title</span>
                <Input
                  className="min-h-11"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Slug</span>
                <Input
                  className="min-h-11"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Type</span>
                <select
                  className="form-input min-h-11"
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
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Format</span>
                <select
                  className="form-input min-h-11"
                  value={contentFormat}
                  onChange={(event) =>
                    setContentFormat(event.target.value as ContentFormat)
                  }
                >
                  {formats.map((item) => (
                    <option key={item} value={item}>
                      {humanizeCode(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Excerpt</span>
                <Input
                  className="min-h-11"
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                />
              </label>
            </div>
          </FormSection>

          <FormSection icon={<Globe2 className="size-4" />} title="Publishing">
            <div className="space-y-4">
              <label className="flex min-h-11 items-center gap-2 rounded-[0.75rem] border border-border bg-surface-muted/45 px-3 text-sm font-medium text-foreground">
                <input
                  checked={isVisibleToCustomers}
                  type="checkbox"
                  onChange={(event) => setIsVisibleToCustomers(event.target.checked)}
                />
                Visible to customers
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-foreground">Reason</span>
                <textarea
                  className="form-input min-h-28 resize-y"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            </div>
          </FormSection>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.55fr)]">
          <FormSection
            className="min-w-0"
            icon={<FileText className="size-4" />}
            title="Body"
          >
            <textarea
              className="form-input min-h-[28rem] resize-y font-mono text-xs leading-5"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </FormSection>

          <div className="space-y-3">
            <FormSection icon={<Globe2 className="size-4" />} title="SEO">
              <div className="space-y-4">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-foreground">SEO title</span>
                  <Input
                    className="min-h-11"
                    value={seoTitle}
                    onChange={(event) => setSeoTitle(event.target.value)}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-foreground">
                    SEO description
                  </span>
                  <textarea
                    className="form-input min-h-24 resize-y"
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                  />
                </label>
              </div>
            </FormSection>

            <FormSection icon={<FileJson className="size-4" />} title="Metadata">
              <textarea
                className="form-input min-h-52 resize-y font-mono text-xs leading-5"
                value={metadataJson}
                onChange={(event) => setMetadataJson(event.target.value)}
              />
            </FormSection>
          </div>
        </section>

        <div className="flex justify-end">
          <Button
            disabled={createMutation.isPending}
            isLoading={createMutation.isPending}
            type="submit"
          >
            <Save className="mr-2 size-4" />
            Create Draft
          </Button>
        </div>
      </form>
    </PageContainer>
  )
}
