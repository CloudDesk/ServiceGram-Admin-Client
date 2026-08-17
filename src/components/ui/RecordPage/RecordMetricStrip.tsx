import { cn } from '../../../utils/cn'

export interface RecordMetric {
  label: string
  value: string
  /** Semantic emphasis. Omit for a neutral reference value. */
  tone?: 'warning' | 'danger' | 'success'
}

interface RecordMetricStripProps {
  metrics: RecordMetric[]
  ariaLabel?: string
  className?: string
}

/**
 * Reference numbers on one line rather than a row of cards.
 *
 * These are values an admin glances at, not the point of the page. As cards
 * they cost ~90px each and pushed the actual content below the fold; as a strip
 * the same values read in a single scan.
 */
export function RecordMetricStrip({
  ariaLabel = 'Record summary',
  className,
  metrics,
}: RecordMetricStripProps) {
  if (!metrics.length) return null

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[0.75rem] border border-border bg-surface px-3 py-2 text-sm',
        className,
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.label} className="flex items-baseline gap-1.5">
          <span className="text-xs text-muted">{metric.label}</span>
          <span
            className={cn(
              'font-semibold tabular-nums text-foreground',
              metric.tone === 'warning' && 'text-warning',
              metric.tone === 'danger' && 'text-danger',
              metric.tone === 'success' && 'text-success',
            )}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </section>
  )
}
