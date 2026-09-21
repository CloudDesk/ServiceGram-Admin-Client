import { cn } from '../../../utils/cn'
import type { DataListQueueTab } from './DataList.types'

export interface QueueTabsProps {
  tabs: DataListQueueTab[]
  activeKey?: string
  onChange?: (key: string) => void
  className?: string
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

        return (
          <button
            key={tab.key}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[0.65rem] border px-2.5 text-sm transition',
              isActive
                ? 'border-primary/45 bg-primary/8 font-semibold text-foreground'
                : 'border-transparent text-muted hover:bg-surface-muted hover:text-foreground',
            )}
            type="button"
            onClick={() => onChange?.(tab.key)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
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
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
