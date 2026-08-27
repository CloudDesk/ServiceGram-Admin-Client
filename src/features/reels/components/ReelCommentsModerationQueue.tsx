import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, MessageCircleWarning, RefreshCcw, Search, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { routePaths } from '../../../config/routes'
import { cn } from '../../../utils/cn'
import { reelService } from '../services/reel.service'
import type {
  AdminReelComment,
  AdminReelCommentModerationAction,
  AdminReelCommentStatus,
} from '../types/reel.types'

const PAGE_SIZE = 20

interface ModerationSelection {
  action: AdminReelCommentModerationAction
  comment: AdminReelComment
}

export function ReelCommentsModerationQueue({
  canModerate,
}: {
  canModerate: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AdminReelCommentStatus | ''>('')
  const [selection, setSelection] = useState<ModerationSelection | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const countQuery = useQuery({
    queryKey: ['reel-comments', 'counts'],
    queryFn: () => reelService.getReelComments({ page: 1, limit: 1 }),
    staleTime: 30_000,
  })
  const queueQuery = useQuery({
    queryKey: ['reel-comments', { page, search, status }],
    queryFn: () =>
      reelService.getReelComments({
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
      comment,
      reason,
    }: ModerationSelection & { reason: string }) =>
      reelService.moderateReelComment(comment.commentId, {
        action,
        expectedVersion: comment.version,
        reason,
      }),
    onSuccess: async () => {
      setSelection(null)
      setActionError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reel-comments'] }),
        queryClient.invalidateQueries({ queryKey: ['reels'] }),
      ])
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'Moderation failed.')
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

  const triggerCount =
    (countQuery.data?.summary.keywordFiltered ?? 0) +
    (countQuery.data?.summary.reported ?? 0)
  const comments = queueQuery.data?.data ?? []
  const pagination = queueQuery.data?.pagination
  const summary = queueQuery.data?.summary ?? countQuery.data?.summary

  return (
    <>
      <Button
        aria-label="Open comment moderation queue"
        className="h-9"
        size="sm"
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <MessageCircleWarning className="size-4 sm:mr-2" />
        <span className="hidden sm:inline">Comments</span>
        {triggerCount > 0 ? (
          <span className="ml-2 rounded-full bg-warning/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-warning">
            {triggerCount}
          </span>
        ) : null}
      </Button>

      {open ? createPortal(
        <div className="premium-overlay flex items-center justify-center p-3 sm:p-5">
          <section
            aria-labelledby="comment-moderation-title"
            aria-modal="true"
            className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-overlay)]"
            role="dialog"
          >
            <header className="flex items-start gap-4 border-b border-border px-4 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Release 2 · Social
                </p>
                <h2 id="comment-moderation-title" className="mt-1 text-xl font-semibold text-foreground">
                  Comment moderation
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Review keyword-held and reported comments. Every decision requires a reason and recent authentication.
                </p>
              </div>
              <button
                aria-label="Close comment moderation"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <QueueMetric label="Needs review" value={(summary?.keywordFiltered ?? 0) + (summary?.reported ?? 0)} tone="warning" />
                <QueueMetric label="Keyword held" value={summary?.keywordFiltered ?? 0} />
                <QueueMetric label="Reported" value={summary?.reported ?? 0} tone="danger" />
                <QueueMetric label="Hidden" value={summary?.hidden ?? 0} />
                <QueueMetric label="Removed" value={summary?.removed ?? 0} />
              </div>

              <div className="mt-4 grid gap-3 rounded-xl border border-border bg-surface-muted p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
                <label className="relative block">
                  <span className="sr-only">Search comments</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    className="form-input min-h-10 pl-9"
                    placeholder="Search comment, reel, or vendor…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                  />
                </label>
                <label>
                  <span className="sr-only">Comment status</span>
                  <select
                    className="form-input min-h-10"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value as AdminReelCommentStatus | '')
                      setPage(1)
                    }}
                  >
                    <option value="">All moderation states</option>
                    <option value="KEYWORD_FILTERED">Keyword held</option>
                    <option value="REPORTED">Reported</option>
                    <option value="HIDDEN">Hidden</option>
                    <option value="REMOVED">Removed</option>
                  </select>
                </label>
                <Button
                  aria-label="Refresh comment moderation queue"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void queueQuery.refetch()}
                >
                  <RefreshCcw className={cn('mr-2 size-4', queueQuery.isFetching && 'animate-spin')} />
                  Refresh
                </Button>
              </div>

              {queueQuery.isLoading ? (
                <div className="py-16 text-center text-sm text-muted">Loading moderation queue…</div>
              ) : queueQuery.isError ? (
                <div className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-5 text-sm text-danger">
                  Comment moderation could not load. Confirm the feature flag and your platform scope, then retry.
                </div>
              ) : comments.length === 0 ? (
                <div className="mt-4 rounded-xl border border-border p-10 text-center">
                  <Flag className="mx-auto size-8 text-muted" />
                  <p className="mt-3 font-semibold text-foreground">Queue is clear</p>
                  <p className="mt-1 text-sm text-muted">No comments match these filters.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {comments.map((comment) => (
                    <CommentModerationCard
                      canModerate={canModerate}
                      comment={comment}
                      key={comment.commentId}
                      onAction={(action) => {
                        setActionError(null)
                        setSelection({ action, comment })
                      }}
                      onOpenReel={() => {
                        setOpen(false)
                        navigate(`${routePaths.reels}/${comment.reelId}`)
                      }}
                    />
                  ))}
                </div>
              )}

              {pagination && pagination.totalPages > 1 ? (
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted">
                    Page {pagination.page} of {pagination.totalPages} · {pagination.totalItems} items
                  </p>
                  <div className="flex gap-2">
                    <Button disabled={!pagination.hasPreviousPage} size="xs" type="button" variant="ghost" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
                    <Button disabled={!pagination.hasNextPage} size="xs" type="button" variant="ghost" onClick={() => setPage((value) => value + 1)}>Next</Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>,
        document.body,
      ) : null}

      <CommentModerationModal
        error={actionError}
        isSubmitting={mutation.isPending}
        key={selection ? `${selection.comment.commentId}:${selection.action}` : 'closed'}
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

function QueueMetric({ label, tone, value }: { label: string; tone?: 'danger' | 'warning'; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold text-foreground', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{value}</p>
    </div>
  )
}

function CommentModerationCard({
  canModerate,
  comment,
  onAction,
  onOpenReel,
}: {
  canModerate: boolean
  comment: AdminReelComment
  onAction: (action: AdminReelCommentModerationAction) => void
  onOpenReel: () => void
}) {
  const actions = useMemo(() => moderationActions(comment.status), [comment.status])
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(comment.status)}>{statusLabel(comment.status)}</Badge>
            {comment.reportCount > 0 ? <span className="text-xs font-semibold text-danger">{comment.reportCount} report{comment.reportCount === 1 ? '' : 's'}</span> : null}
            {comment.moderation.matchedKeywords.length ? <span className="text-xs text-warning">Matched: {comment.moderation.matchedKeywords.join(', ')}</span> : null}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{comment.body}</p>
          <p className="mt-2 text-xs text-muted">{comment.author.displayName} · {comment.author.type.toLowerCase()} · {new Date(comment.createdAt).toLocaleString()}</p>
          {comment.moderation.reason ? <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">Last decision: {comment.moderation.reason}</p> : null}
        </div>
        {comment.reel.thumbnailUrl ? <img alt="" className="h-20 w-14 rounded-lg border border-border object-cover" src={comment.reel.thumbnailUrl} /> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <button className="text-left text-xs font-semibold text-primary hover:underline" type="button" onClick={onOpenReel}>
          {comment.reel.publicReelId} · {comment.reel.vendorName ?? 'Creator reel'}
        </button>
        {canModerate ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button key={action} size="xs" type="button" variant={action === 'REMOVE' ? 'danger' : action === 'RESTORE' ? 'primary' : 'secondary'} onClick={() => onAction(action)}>
                {action === 'HIDE' ? 'Hide' : action === 'REMOVE' ? 'Remove' : 'Restore'}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function CommentModerationModal({
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
  selection: ModerationSelection | null
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
            <h3 className="text-lg font-semibold text-foreground">{selection.action === 'HIDE' ? 'Hide comment' : selection.action === 'REMOVE' ? 'Remove comment' : 'Restore comment'}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{selection.comment.body}</p>
          </div>
          <button aria-label="Close moderation action" className="rounded-full p-2 text-muted hover:bg-surface-muted" disabled={isSubmitting} type="button" onClick={onClose}><X className="size-4" /></button>
        </div>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Audit reason *</span>
            <textarea className="form-input min-h-28 resize-y" maxLength={500} placeholder="Explain this moderation decision" value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          {formError || error ? <div className="rounded-xl border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{formError ?? error}</div> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button disabled={isSubmitting} size="sm" type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button isLoading={isSubmitting} size="sm" type="submit" variant={selection.action === 'REMOVE' ? 'danger' : 'primary'}>Confirm {selection.action.toLowerCase()}</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}

function moderationActions(status: AdminReelCommentStatus): AdminReelCommentModerationAction[] {
  if (status === 'REMOVED') return ['RESTORE']
  if (status === 'HIDDEN') return ['RESTORE', 'REMOVE']
  return ['HIDE', 'REMOVE', 'RESTORE']
}

function statusLabel(status: AdminReelCommentStatus) {
  return status === 'KEYWORD_FILTERED' ? 'Keyword held' : status.toLowerCase().replace(/^./, (value) => value.toUpperCase())
}

function statusTone(status: AdminReelCommentStatus) {
  if (status === 'REPORTED' || status === 'REMOVED') return 'danger' as const
  if (status === 'KEYWORD_FILTERED') return 'warning' as const
  if (status === 'VISIBLE') return 'success' as const
  return 'neutral' as const
}
