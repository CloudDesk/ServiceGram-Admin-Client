import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Award, Gem, ShieldAlert, Sparkles } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { vendorService } from '../services/vendor.service'
import type {
  VendorBadgeCode,
  VendorReputationDetail,
  VendorReputationEvent,
  VendorReputationScore,
} from '../types/vendor.types'

const BADGE_LABEL: Record<VendorBadgeCode, string> = {
  COMMUNITY_ELITE: 'Community Elite',
  TOP_RATED: 'Top Rated',
  RISING_STAR: 'Rising Star',
}

const BADGE_ICON: Record<VendorBadgeCode, typeof Award> = {
  COMMUNITY_ELITE: Gem,
  TOP_RATED: Award,
  RISING_STAR: Sparkles,
}

const EVENT_LABEL: Record<string, string> = {
  SCORE_RECOMPUTED: 'Score recomputed',
  ADMIN_PENALTY_APPLIED: 'Penalty applied',
  ADMIN_PENALTY_CLEARED: 'Penalty cleared',
  BADGE_AWARDED: 'Badge awarded',
  BADGE_REVOKED: 'Badge revoked',
  REVIEW_FLAGGED: 'Review flagged',
}

/** The weights the backend scores with. Shown so a support answer can be exact. */
const COMPONENTS: {
  key: keyof VendorReputationScore
  label: string
  weight: number
}[] = [
  { key: 'ratingComponent', label: 'Customer ratings', weight: 40 },
  { key: 'completionComponent', label: 'Completed orders', weight: 25 },
  { key: 'responseComponent', label: 'Response time', weight: 15 },
  { key: 'complaintComponent', label: 'Complaints', weight: 10 },
  { key: 'cancellationComponent', label: 'Cancellations', weight: 10 },
]

const MINIMUM_SAMPLE_SIZE = 5

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-IN')
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-border/70 py-2 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

/**
 * Penalty entry.
 *
 * A reason is mandatory and the backend rejects anything under ten characters.
 * Enforcing it here too means an admin finds out before they have typed a
 * deduction they cannot explain -- reputation drives a vendor's ranking and
 * therefore their income, and an unexplained deduction is one they cannot
 * appeal.
 */
function PenaltyForm({
  onSubmit,
  pending,
  penaltyPoints,
}: {
  onSubmit: (input: { delta: number; reason: string }) => void
  pending: boolean
  penaltyPoints: number
}) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')

  const parsedDelta = Number(delta)
  const deltaValid = Number.isInteger(parsedDelta) && parsedDelta !== 0 &&
    Math.abs(parsedDelta) <= 100
  const reasonValid = reason.trim().length >= 10
  const clearingTooMuch = parsedDelta < 0 && Math.abs(parsedDelta) > penaltyPoints

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!deltaValid || !reasonValid) return
        onSubmit({ delta: parsedDelta, reason: reason.trim() })
        setDelta('')
        setReason('')
      }}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground" htmlFor="reputation-penalty-delta">
          Points
        </label>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          id="reputation-penalty-delta"
          inputMode="numeric"
          placeholder="15 to apply, -15 to clear"
          value={delta}
          onChange={(event) => setDelta(event.target.value)}
        />
        <p className="text-xs text-muted">
          Positive applies points, negative clears them. Points are subtracted
          from the vendor&rsquo;s score after weighting, so 15 here is 15 off the score.
        </p>
        {delta && !deltaValid ? (
          <p className="text-xs text-danger">
            Enter a whole number between -100 and 100, and not zero.
          </p>
        ) : null}
        {clearingTooMuch ? (
          <p className="text-xs text-muted">
            This vendor has {penaltyPoints} penalty {penaltyPoints === 1 ? 'point' : 'points'};
            clearing more than that will simply take them to zero, not below it.
          </p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground" htmlFor="reputation-penalty-reason">
          Reason
        </label>
        <textarea
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          id="reputation-penalty-reason"
          placeholder="What happened, and what was reviewed."
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <p className="text-xs text-muted">
          Shown to the vendor in their app. Write it so it answers their appeal.
        </p>
        {reason && !reasonValid ? (
          <p className="text-xs text-danger">
            A reason of at least 10 characters is required.
          </p>
        ) : null}
      </div>

      <Button disabled={!deltaValid || !reasonValid || pending} size="sm" type="submit">
        {pending ? 'Saving…' : 'Apply change'}
      </Button>
    </form>
  )
}

function ReputationContent({
  detail,
  onPenalty,
  penaltyPending,
  canUpdate,
}: {
  detail: VendorReputationDetail
  onPenalty: (input: { delta: number; reason: string }) => void
  penaltyPending: boolean
  canUpdate: boolean
}) {
  const score = detail.score
  const activeBadges = useMemo(
    () => detail.badges.filter((badge) => !badge.revokedAt),
    [detail.badges],
  )
  const revokedBadges = useMemo(
    () => detail.badges.filter((badge) => badge.revokedAt),
    [detail.badges],
  )

  // Never scored is not the same as scored zero, and an admin answering a
  // vendor's question needs to know which one they are looking at.
  if (!score || score.computedAt === null) {
    return (
      <div className="space-y-4">
        <EmptyState
          description="This vendor has not been scored yet. The nightly job scores vendors with recent orders; a vendor with none stays unscored rather than scoring zero."
          title="Not scored yet"
        />
        {canUpdate ? (
          <section className="rounded-[1rem] border border-border bg-surface p-4">
            <h3 className="font-semibold text-foreground">Penalty points</h3>
            <p className="mt-1 mb-3 text-sm text-muted">
              Penalties can be recorded before a first score exists; they apply
              from the next run.
            </p>
            <PenaltyForm onSubmit={onPenalty} pending={penaltyPending} penaltyPoints={0} />
          </section>
        ) : null}
      </div>
    )
  }

  const provisional = score.sampleSize < MINIMUM_SAMPLE_SIZE
  const earned = score.score + score.penaltyPoints

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
        <section className="rounded-[1rem] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Current score</h3>
              <p className="mt-1 text-sm text-muted">
                Last computed {formatDateTime(score.computedAt)}
              </p>
            </div>
            {provisional ? (
              <Badge tone="warning">
                Provisional · {score.sampleSize} of {MINIMUM_SAMPLE_SIZE} orders
              </Badge>
            ) : (
              <Badge tone="success">Published to customers</Badge>
            )}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <span className="text-4xl font-semibold text-foreground">{score.score}</span>
            <span className="pb-1 text-sm text-muted">/ 100</span>
          </div>
          {provisional ? (
            <p className="mt-2 text-sm text-muted">
              Under {MINIMUM_SAMPLE_SIZE} orders, so this is withheld from
              customers and earns no badges. The vendor can still see it.
            </p>
          ) : null}

          <div className="mt-4">
            {COMPONENTS.map((component) => {
              const value = Number(score[component.key] ?? 0)
              return (
                <div className="border-b border-border/70 py-2 last:border-b-0" key={component.key}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted">{component.label}</span>
                    <span className="text-sm font-medium text-foreground">
                      {value} / 100 · weight {component.weight}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4">
            <DetailRow label="Earned before penalties" value={`${earned} / 100`} />
            <DetailRow label="Penalty points" value={score.penaltyPoints ? `−${score.penaltyPoints}` : '0'} />
            <DetailRow label="Score" value={`${score.score} / 100`} />
            <DetailRow label="Orders in window" value={String(score.sampleSize)} />
            <DetailRow label="Rated orders" value={String(score.ratedOrderCount)} />
          </div>
        </section>

        <div className="space-y-4">
          <section className="rounded-[1rem] border border-border bg-surface p-4">
            <h3 className="font-semibold text-foreground">Badges</h3>
            <p className="mt-1 text-sm text-muted">
              Active badges are shown to customers on this vendor&rsquo;s profile.
            </p>
            <div className="mt-3 space-y-2">
              {activeBadges.length === 0 ? (
                <p className="rounded-xl bg-background p-3 text-sm text-muted">
                  No active badges.
                </p>
              ) : (
                activeBadges.map((badge) => {
                  const Icon = BADGE_ICON[badge.badgeCode]
                  return (
                    <div className="flex items-center gap-3 rounded-xl bg-background p-3" key={badge.id}>
                      <Icon className="size-4 text-success" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {BADGE_LABEL[badge.badgeCode]}
                        </p>
                        <p className="text-xs text-muted">
                          Awarded {formatDateTime(badge.awardedAt)} at score {badge.awardedScore}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              {/* Revoked badges are kept, not deleted: "where did my badge go"
                  is a real support question and a deleted row cannot answer it. */}
              {revokedBadges.map((badge) => (
                <div className="flex items-center gap-3 rounded-xl bg-background p-3 opacity-70" key={badge.id}>
                  <ShieldAlert className="size-4 text-muted" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {BADGE_LABEL[badge.badgeCode]} <span className="text-muted">· revoked</span>
                    </p>
                    <p className="text-xs text-muted">
                      Awarded {formatDateTime(badge.awardedAt)}, revoked {formatDateTime(badge.revokedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {canUpdate ? (
            <section className="rounded-[1rem] border border-border bg-surface p-4">
              <h3 className="font-semibold text-foreground">Penalty points</h3>
              <p className="mt-1 mb-3 text-sm text-muted">
                Currently {score.penaltyPoints}. The score is recomputed from the
                new total immediately.
              </p>
              <PenaltyForm
                onSubmit={onPenalty}
                pending={penaltyPending}
                penaltyPoints={score.penaltyPoints}
              />
            </section>
          ) : null}
        </div>
      </div>

      <section className="rounded-[1rem] border border-border bg-surface p-4">
        <h3 className="font-semibold text-foreground">History</h3>
        <p className="mt-1 text-sm text-muted">
          Every score change, badge movement and admin penalty.
        </p>
        <div className="mt-3 space-y-2">
          {detail.events.length === 0 ? (
            <p className="rounded-xl bg-background p-3 text-sm text-muted">
              No reputation history yet.
            </p>
          ) : (
            detail.events.map((event: VendorReputationEvent) => (
              <div className="rounded-xl bg-background p-3" key={event.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {EVENT_LABEL[event.eventType] ?? event.eventType}
                    {event.badgeCode ? ` · ${BADGE_LABEL[event.badgeCode]}` : ''}
                  </p>
                  <span className="text-xs text-muted">{formatDateTime(event.createdAt)}</span>
                </div>
                {event.scoreBefore !== null || event.scoreAfter !== null ? (
                  <p className="mt-1 text-xs text-muted">
                    Score {event.scoreBefore ?? '—'} → {event.scoreAfter ?? '—'}
                    {event.penaltyDelta ? ` · penalty ${event.penaltyDelta > 0 ? '+' : ''}${event.penaltyDelta}` : ''}
                  </p>
                ) : null}
                {event.reason ? (
                  <p className="mt-1 text-xs text-foreground">{event.reason}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export function VendorReputationPanel({
  canUpdate,
  vendorId,
}: {
  canUpdate: boolean
  vendorId: string
}) {
  const queryClient = useQueryClient()
  const reputationQuery = useQuery({
    queryKey: ['vendor-reputation', vendorId],
    queryFn: () => vendorService.getVendorReputation(vendorId),
    staleTime: 30_000,
  })

  const penaltyMutation = useMutation({
    mutationFn: (input: { delta: number; reason: string }) =>
      vendorService.applyVendorReputationPenalty(vendorId, input),
    onSuccess: () => {
      // The penalty changes the score and can revoke a badge, so refetch the
      // whole thing rather than patching the number in place.
      void queryClient.invalidateQueries({ queryKey: ['vendor-reputation', vendorId] })
    },
  })

  return (
    <section className="space-y-4" aria-label="Vendor reputation">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Vendor reputation</h2>
          <p className="mt-1 text-sm text-muted">
            The score and badges behind this vendor&rsquo;s ranking, and the penalty
            history that explains any adjustment.
          </p>
        </div>
      </div>

      {penaltyMutation.isError ? (
        <p className="text-sm text-danger" role="alert">
          The penalty change failed. Nothing was recorded; the score is unchanged.
        </p>
      ) : null}

      {reputationQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : reputationQuery.isError ? (
        <ErrorState
          description="The reputation record could not be loaded."
          title="Reputation unavailable"
          onRetry={() => void reputationQuery.refetch()}
        />
      ) : reputationQuery.data ? (
        <ReputationContent
          canUpdate={canUpdate}
          detail={reputationQuery.data.data}
          penaltyPending={penaltyMutation.isPending}
          onPenalty={(input) => penaltyMutation.mutate(input)}
        />
      ) : null}
    </section>
  )
}
