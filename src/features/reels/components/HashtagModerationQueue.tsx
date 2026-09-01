import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hash, RefreshCcw, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { cn } from '../../../utils/cn'
import { ReelServiceError, reelService } from '../services/reel.service'
import type {
  AdminHashtag,
  AdminHashtagAction,
  AdminHashtagStatus,
} from '../types/reel.types'

const PAGE_SIZE = 20

interface HashtagSelection {
  action: AdminHashtagAction
  hashtag: AdminHashtag
}

/**
 * Hashtag moderation.
 *
 * The backend has exposed this queue since hashtags shipped; nothing in the
 * console reached it, so the only way to block an abusive tag was a direct
 * API call. It sits beside comment moderation because they are the same job:
 * both are social surfaces a customer can write to.
 */
export function HashtagModerationQueue({
  canModerate,
}: {
  canModerate: boolean
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdminHashtagStatus | ''>('')
  const [selection, setSelection] = useState<HashtagSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const countQuery = useQuery({
    queryKey: ['hashtag-moderation', 'counts'],
    queryFn: () => reelService.getHashtags({ page: 1, limit: 1 }),
    staleTime: 30_000,
  })
  const queueQuery = useQuery({
    queryKey: ['hashtag-moderation', { page, search, status }],
    queryFn: () =>
      reelService.getHashtags({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        status: status || undefined,
      }),
    enabled: open,
    placeholderData: (previous) => previous,
  })
  const mutation = useMutation({
    mutationFn: ({
      action,
      hashtag,
      reason,
    }: HashtagSelection & { reason: string }) =>
      reelService.moderateHashtag(hashtag.hashtagId, {
        action,
        expectedVersion: hashtag.version,
        reason,
      }),
    onSuccess: async () => {
      setSelection(null)
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['hashtag-moderation'] })
    },
    onError: (error) => {
      setActionError(moderationErrorMessage(error))
    },
  })

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selection) setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, selection])

  // Suspicious tags are the ones waiting on a person. Blocked ones are already
  // decided, so counting them here would keep the badge permanently lit.
  const triggerCount = countQuery.data?.summary.suspicious ?? 0
  const hashtags = queueQuery.data?.data ?? []
  const pagination = queueQuery.data?.pagination
  const summary = queueQuery.data?.summary ?? countQuery.data?.summary

  return (
    <>
      <Button
        aria-label="Open hashtag moderation queue"
        className="h-9"
        size="sm"
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <Hash className="size-4 sm:mr-2" />
        <span className="hidden sm:inline">Hashtags</span>
        {triggerCount > 0 ? (
          <span className="ml-2 rounded-full bg-warning/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-warning">
            {triggerCount}
          </span>
        ) : null}
      </Button>

      {open ? createPortal(
        <div className="premium-overlay flex items-center justify-center p-3 sm:p-5">
          <section
            aria-labelledby="hashtag-moderation-title"
            aria-modal="true"
            className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)]"
            role="dialog"
          >
            <header className="flex items-start gap-4 border-b border-border px-4 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Release 2 · Social
                </p>
                <h2
                  id="hashtag-moderation-title"
                  className="mt-1 text-xl font-semibold text-foreground"
                >
                  Hashtag moderation
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Blocking a tag hides it from search and discovery across the
                  customer app. Every decision requires a reason and recent
                  authentication.
                </p>
              </div>
              <button
                aria-label="Close hashtag moderation"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QueueMetric
                  label="Needs review"
                  tone="warning"
                  value={summary?.suspicious ?? 0}
                />
                <QueueMetric label="Active" value={summary?.active ?? 0} />
                <QueueMetric
                  label="Blocked"
                  tone="danger"
                  value={summary?.blocked ?? 0}
                />
                <QueueMetric label="Total tags" value={summary?.totalItems ?? 0} />
              </div>

              <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-muted p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <label className="relative block">
                  <span className="sr-only">Search hashtags</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    className="form-input min-h-10 pl-9"
                    maxLength={48}
                    placeholder="Search a tag…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                  />
                </label>
                <label>
                  <span className="sr-only">Hashtag status</span>
                  <select
                    className="form-input min-h-10"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value as AdminHashtagStatus | '')
                      setPage(1)
                    }}
                  >
                    <option value="">All moderation states</option>
                    <option value="SUSPICIOUS">Suspicious</option>
                    <option value="ACTIVE">Active</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                </label>
                <Button
                  aria-label="Refresh hashtag moderation queue"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void queueQuery.refetch()}
                >
                  <RefreshCcw
                    className={cn(
                      'mr-2 size-4',
                      queueQuery.isFetching && 'animate-spin',
                    )}
                  />
                  Refresh
                </Button>
              </div>

              {queueQuery.isLoading ? (
                <div className="py-16 text-center text-sm text-muted">
                  Loading hashtag queue…
                </div>
              ) : queueQuery.isError ? (
                <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">
                  Hashtag moderation could not load. Confirm the social hashtags
                  feature flag, your platform scope, and that your role has
                  social moderation access, then retry.
                </div>
              ) : hashtags.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted">
                  No hashtags match these filters.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {hashtags.map((hashtag) => (
                    <HashtagModerationCard
                      canModerate={canModerate}
                      hashtag={hashtag}
                      key={hashtag.hashtagId}
                      onAction={(action) => {
                        setActionError(null)
                        setSelection({ action, hashtag })
                      }}
                    />
                  ))}
                </div>
              )}

              {pagination && pagination.totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted">
                    Page {pagination.page} of {pagination.totalPages} ·{' '}
                    {pagination.totalItems} tags
                  </p>
                  <div className="flex gap-2">
                    <Button
                      disabled={!pagination.hasPreviousPage}
                      size="xs"
                      type="button"
                      variant="ghost"
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      disabled={!pagination.hasNextPage}
                      size="xs"
                      type="button"
                      variant="ghost"
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>,
        document.body,
      ) : null}

      <HashtagModerationModal
        error={actionError}
        isSubmitting={mutation.isPending}
        key={
          selection
            ? `${selection.hashtag.hashtagId}:${selection.action}`
            : 'closed'
        }
        selection={selection}
        onClose={() => {
          if (!mutation.isPending) {
            setSelection(null)
            setActionError(null)
          }
        }}
        onSubmit={(reason) => {
          if (selection) mutation.mutate({ ...selection, reason })
        }}
      />
    </>
  )
}

function QueueMetric({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'danger' | 'warning'
  value: number
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold text-foreground',
          tone === 'danger' && 'text-danger',
          tone === 'warning' && 'text-warning',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function HashtagModerationCard({
  canModerate,
  hashtag,
  onAction,
}: {
  canModerate: boolean
  hashtag: AdminHashtag
  onAction: (action: AdminHashtagAction) => void
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(hashtag.status)}>
              {statusLabel(hashtag.status)}
            </Badge>
            <p className="truncate text-base font-semibold text-foreground">
              #{hashtag.displayTag}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">
            {hashtag.visibleReelCount} visible reels · {hashtag.usageCount7d} uses
            in 7 days · {hashtag.usageCount30d} in 30
          </p>
          {hashtag.moderationReason ? (
            <p className="mt-1 text-sm text-muted">
              Last reason: {hashtag.moderationReason}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted">
            {hashtag.lastUsedAt
              ? `Last used ${formatWhen(hashtag.lastUsedAt)}`
              : 'Never used'}
            {hashtag.aggregateRefreshedAt
              ? ` · counts as of ${formatWhen(hashtag.aggregateRefreshedAt)}`
              : ' · counts not yet aggregated'}
          </p>
        </div>
        {canModerate ? (
          <div className="flex flex-wrap gap-2">
            {hashtag.availableActions.map((action) => (
              <Button
                key={action}
                size="xs"
                type="button"
                variant={action === 'BLOCK' ? 'danger' : 'secondary'}
                onClick={() => onAction(action)}
              >
                {actionLabel(action)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function HashtagModerationModal({
  error,
  isSubmitting,
  onClose,
  onSubmit,
  selection,
}: {
  error: string | null
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  selection: HashtagSelection | null
}) {
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (!selection) return null

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (reason.trim().length < 3) {
      setFormError('Reason must be at least 3 characters.')
      return
    }
    onSubmit(reason.trim())
  }

  return createPortal(
    <div className="premium-overlay z-[70] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {actionTitle(selection.action)}
            </h3>
            <p className="mt-1 text-sm text-muted">
              #{selection.hashtag.displayTag} ·{' '}
              {selection.hashtag.visibleReelCount} visible reels
            </p>
            {selection.action === 'BLOCK' ? (
              <p className="mt-2 text-sm text-danger">
                Blocking removes this tag from search and discovery for every
                customer. The reels themselves stay published.
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close moderation action"
            className="rounded-full p-2 text-muted hover:bg-surface-muted"
            disabled={isSubmitting}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">
              Audit reason *
            </span>
            <textarea
              className="form-input min-h-28 resize-y"
              maxLength={500}
              placeholder="Explain this moderation decision"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {formError || error ? (
            <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">
              {formError ?? error}
            </div>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
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
              variant={selection.action === 'BLOCK' ? 'danger' : 'primary'}
            >
              {actionTitle(selection.action)}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The two failures this action actually hits deserve their own instruction.
 * A stale session and a concurrent edit are both recoverable, but not by the
 * same move, and the raw server message says neither.
 */
function moderationErrorMessage(error: unknown) {
  if (error instanceof ReelServiceError) {
    if (error.code === 'AUTH_REAUTH_REQUIRED') {
      return 'Your session is not recent enough to moderate. Sign in again, then retry this decision.'
    }

    if (error.code === 'REEL_HASHTAG_VERSION_CONFLICT') {
      return 'Someone else moderated this tag while you were deciding. Refresh the queue and review its current state first.'
    }

    return error.message
  }

  return error instanceof Error ? error.message : 'Moderation failed.'
}

function actionLabel(action: AdminHashtagAction) {
  if (action === 'MARK_SUSPICIOUS') return 'Mark suspicious'
  if (action === 'BLOCK') return 'Block'
  return 'Allow'
}

function actionTitle(action: AdminHashtagAction) {
  if (action === 'MARK_SUSPICIOUS') return 'Mark hashtag suspicious'
  if (action === 'BLOCK') return 'Block hashtag'
  return 'Allow hashtag'
}

function statusLabel(status: AdminHashtagStatus) {
  return status
    .toLowerCase()
    .replace(/^./, (value) => value.toUpperCase())
}

function statusTone(status: AdminHashtagStatus) {
  if (status === 'BLOCKED') return 'danger' as const
  if (status === 'SUSPICIOUS') return 'warning' as const
  return 'success' as const
}

function formatWhen(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'an unknown time'
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
