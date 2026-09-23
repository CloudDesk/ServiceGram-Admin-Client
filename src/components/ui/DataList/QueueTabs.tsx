import { cn } from '../../../utils/cn'
import type { DataListQueueTab } from './DataList.types'

export interface QueueTabsProps {
  tabs: DataListQueueTab[]
  activeKey?: string
  onChange?: (key: string) => void
  className?: string
}

/** Selected-tab color per semantic tone — underline, label, and count chip all match. */
const ACTIVE_TONE_CLASSES: Record<
  NonNullable<DataListQueueTab['tone']>,
  { text: string; border: string; chip: string }
> = {
  neutral: { text: 'text-primary', border: 'border-primary', chip: 'bg-primary/10 text-primary' },
  warning: { text: 'text-warning', border: 'border-warning', chip: 'bg-warning/10 text-warning' },
  danger: { text: 'text-danger', border: 'border-danger', chip: 'bg-danger/10 text-danger' },
}

/**
 * The one tab-row style every list screen in the app uses (Customers,
 * Vendors, Orders, Feature Flags, ...) via `DataListToolbar`'s `queueTabs`.
 * Pulled out as its own component so a page that doesn't use `DataList` (a
 * dense workspace-style screen, say) can still render the identical tab
 * style instead of a one-off that quietly drifts from this one.
 */
export function QueueTabs({ activeKey, className, onChange, tabs }: QueueTabsProps) {
  if (!tabs.length) return null

  return (
    <div className={cn('flex min-w-0 items-center gap-1 overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey
        const tone = ACTIVE_TONE_CLASSES[tab.tone ?? 'neutral']
        // A "0" shouldn't inherit a warning/danger tint — an empty queue
        // isn't a problem, so its chip reads as neutral even when the tab's
        // own tone (e.g. "Blocked") would otherwise color it red.
        const chipIsEmpty = tab.count === 0

        return (
          <button
            key={tab.key}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? cn('font-semibold', tone.text, tone.border)
                : 'text-muted hover:border-border hover:text-foreground',
            )}
            type="button"
            onClick={() => onChange?.(tab.key)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              isActive ? (
                <span
                  className={cn(
                    'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                    chipIsEmpty ? 'bg-secondary text-secondary-foreground' : tone.chip,
                  )}
                >
                  {tab.count}
                </span>
              ) : (
                <span
                  className={cn(
                    'tabular-nums text-xs',
                    tab.tone === 'danger' && 'text-danger',
                    tab.tone === 'warning' && 'text-warning',
                    (!tab.tone || tab.tone === 'neutral') && 'text-muted',
                  )}
                >
                  {tab.count}
                </span>
              )
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
