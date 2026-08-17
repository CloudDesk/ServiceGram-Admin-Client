/**
 * The approvals visual language.
 *
 * Each glyph replaces an enum that used to render as a word. Two rules hold
 * across all of them:
 *  - colour never carries meaning alone; every state also differs in shape or fill
 *  - every glyph is labelled, so "fewer words on screen" never means fewer words
 *    for a screen reader
 */

import type { ReactNode } from 'react'
import {
  Building2,
  KeyRound,
  MapPin,
  ShieldCheck,
  Tag,
  User,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '../../../utils/cn'
import {
  approverLabel,
  decisionPolicyLabel,
  resolverTypeLabel,
  riskLabel,
  riskStep,
  workflowStatusLabel,
} from '../copy'
import { formatSla } from './sharedUtils'

// ─── Workflow state ───────────────────────────────────────────────────────────

const stateDotTone: Record<string, string> = {
  ACTIVE: 'bg-success',
  ARCHIVED: 'bg-danger/60',
  DRAFT: 'bg-warning',
  INACTIVE: 'bg-muted/50',
}

/**
 * A workflow's lifecycle as a single dot. Archived is hollow so state is
 * readable without relying on the colour difference alone.
 */
export function StateDot({ status }: { status: string }) {
  const label = workflowStatusLabel(status)

  return (
    <span
      aria-label={label}
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        status === 'ARCHIVED' && 'border-2 border-muted/60 bg-transparent',
        status !== 'ARCHIVED' && (stateDotTone[status] ?? 'bg-muted/50'),
      )}
      role="img"
      title={label}
    />
  )
}

// ─── Decision policy ──────────────────────────────────────────────────────────

/**
 * Filled dots out of the approver pool: one filled means any one approver, all
 * filled means unanimous, two of four means a minimum of two.
 */
export function PolicyDots({
  approverCount,
  decisionPolicy,
  minApprovals,
}: {
  approverCount: number
  decisionPolicy: string
  minApprovals: number
}) {
  const total = Math.max(approverCount, 1, decisionPolicy === 'MIN_N' ? minApprovals : 0)
  const filled =
    decisionPolicy === 'ALL' ? total : decisionPolicy === 'MIN_N' ? minApprovals : 1
  const label = decisionPolicyLabel(decisionPolicy, minApprovals)

  return (
    <span
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1"
      role="img"
      title={label}
    >
      {Array.from({ length: Math.min(total, 5) }, (_, index) => (
        <span
          className={cn(
            'size-2 rounded-full',
            index < filled ? 'bg-primary' : 'border border-border bg-transparent',
          )}
          key={index}
        />
      ))}
    </span>
  )
}

// ─── SLA ──────────────────────────────────────────────────────────────────────

const SLA_RADIUS = 13
const SLA_CIRCUMFERENCE = 2 * Math.PI * SLA_RADIUS

/**
 * A stage's time window as a filled arc. The arc is proportional to the longest
 * window in the same workflow, so stages are comparable at a glance; a stage
 * without an SLA renders as an open ring.
 */
export function SlaArc({
  longestMinutes,
  minutes,
}: {
  longestMinutes: number
  minutes: null | number
}) {
  const label = minutes ? `Decide within ${formatSla(minutes)}` : 'No time limit'
  const fraction = minutes && longestMinutes > 0 ? Math.min(minutes / longestMinutes, 1) : 0
  const tone = !minutes ? 'text-muted/40' : fraction > 0.75 ? 'text-warning' : 'text-info'

  return (
    <span
      aria-label={label}
      className="inline-flex shrink-0 items-center gap-1.5"
      role="img"
      title={label}
    >
      <svg className={tone} height="20" viewBox="0 0 36 36" width="20">
        <circle
          className="text-border"
          cx="18"
          cy="18"
          fill="none"
          r={SLA_RADIUS}
          stroke="currentColor"
          strokeWidth="4"
        />
        {minutes ? (
          <circle
            cx="18"
            cy="18"
            fill="none"
            r={SLA_RADIUS}
            stroke="currentColor"
            strokeDasharray={SLA_CIRCUMFERENCE}
            strokeDashoffset={SLA_CIRCUMFERENCE * (1 - fraction)}
            strokeLinecap="round"
            strokeWidth="4"
            transform="rotate(-90 18 18)"
          />
        ) : null}
      </svg>
      <span className="text-xs font-medium tabular-nums text-muted">
        {minutes ? formatSla(minutes) : '—'}
      </span>
    </span>
  )
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

const riskBarTone: Record<number, string> = {
  1: 'bg-info',
  2: 'bg-info',
  3: 'bg-warning',
  4: 'bg-danger',
}

/** A four-step meter. Height carries the level; colour reinforces it. */
export function RiskMeter({ level }: { level: string }) {
  const step = riskStep(level)
  const label = riskLabel(level)
  const heights = ['h-1.5', 'h-2.5', 'h-3.5', 'h-4.5']

  return (
    <span
      aria-label={label}
      className="inline-flex h-4 shrink-0 items-end gap-0.5"
      role="img"
      title={label}
    >
      {heights.map((height, index) => (
        <span
          className={cn(
            'w-1 rounded-sm',
            height,
            index < step ? riskBarTone[step] : 'bg-border',
          )}
          key={height}
        />
      ))}
    </span>
  )
}

// ─── Approvers ────────────────────────────────────────────────────────────────

const resolverIcons: Record<string, ReactNode> = {
  CATEGORY_OWNER: <Tag className="size-3.5" />,
  LOCATION_OWNER: <MapPin className="size-3.5" />,
  PERMISSION: <KeyRound className="size-3.5" />,
  ROLE: <ShieldCheck className="size-3.5" />,
  STATIC_FALLBACK: <Building2 className="size-3.5" />,
  TEAM: <Users className="size-3.5" />,
  USER: <User className="size-3.5" />,
}

/**
 * Who resolves a stage. A dashed outline marks a fallback — the approver only
 * used when the primaries cannot be resolved.
 */
export function ApproverChip({
  isFallback,
  resolverConfig,
  resolverType,
}: {
  isFallback?: boolean
  resolverConfig?: Record<string, unknown>
  resolverType: string
}) {
  const name = approverLabel(resolverType, resolverConfig)
  const title = isFallback
    ? `Backup: ${name} (${resolverTypeLabel(resolverType)})`
    : `${name} (${resolverTypeLabel(resolverType)})`

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-medium',
        isFallback
          ? 'border-dashed border-warning/50 bg-warning/5 text-warning'
          : 'border-border bg-surface text-foreground',
      )}
      title={title}
    >
      <span
        className={cn(
          'inline-flex size-5 shrink-0 items-center justify-center rounded-full',
          isFallback ? 'bg-warning/15' : 'bg-primary/12 text-primary',
        )}
      >
        {resolverIcons[resolverType] ?? <User className="size-3.5" />}
      </span>
      <span className="truncate">{name}</span>
    </span>
  )
}

// ─── Auto decision ────────────────────────────────────────────────────────────

/** A filled bolt: this branch reaches its outcome with no human in it. */
export function AutoBolt({ label }: { label: string }) {
  return (
    <span
      aria-label={label}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
      role="img"
      title={label}
    >
      <Zap className="size-3.5 fill-current" />
    </span>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

/**
 * The key to the glyph set. Collapsed by default so it costs a line of chrome,
 * not a panel — but always one interaction away from any screen using the marks.
 */
export function GlyphLegend() {
  return (
    <details className="group rounded-surface border border-border bg-surface-muted/30">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-muted hover:text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <PolicyDots approverCount={2} decisionPolicy="ANY_ONE" minApprovals={1} />
          <RiskMeter level="HIGH" />
        </span>
        What do these marks mean?
      </summary>

      <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <LegendRow
          art={<PolicyDots approverCount={3} decisionPolicy="MIN_N" minApprovals={2} />}
          description="Filled dots out of the approver pool. One filled means any approver can decide."
          term="How many must approve"
        />
        <LegendRow
          art={<SlaArc longestMinutes={480} minutes={240} />}
          description="How long the stage has. The arc fills relative to the slowest stage here."
          term="Time limit"
        />
        <LegendRow
          art={<RiskMeter level="CRITICAL" />}
          description="How much damage the final action can do, from low to critical."
          term="Risk"
        />
        <LegendRow
          art={<AutoBolt label="Decided automatically" />}
          description="The rule reaches its outcome with no human review."
          term="Automatic"
        />
        <LegendRow
          art={<ApproverChip isFallback resolverConfig={{ roleCode: 'SUPER_ADMIN' }} resolverType="ROLE" />}
          description="A dashed outline means a backup, used only when the primary approver cannot be found."
          term="Backup approver"
        />
        <LegendRow
          art={
            <span className="inline-flex items-center gap-2">
              <StateDot status="ACTIVE" />
              <StateDot status="DRAFT" />
              <StateDot status="INACTIVE" />
              <StateDot status="ARCHIVED" />
            </span>
          }
          description="Live, draft, paused, archived — hollow means archived."
          term="Workflow state"
        />
      </div>
    </details>
  )
}

function LegendRow({
  art,
  description,
  term,
}: {
  art: ReactNode
  description: string
  term: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-control border border-border bg-surface px-3 py-2.5">
      <span className="flex min-w-14 shrink-0 justify-center pt-0.5">{art}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{term}</span>
        <span className="block text-xs leading-5 text-muted">{description}</span>
      </span>
    </div>
  )
}
