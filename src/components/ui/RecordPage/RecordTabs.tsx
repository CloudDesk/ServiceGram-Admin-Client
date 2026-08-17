import { Link } from 'react-router-dom'
import { cn } from '../../../utils/cn'

export interface RecordTabItem {
  /** Route segment. The default tab uses '' so it sits on the bare record URL. */
  key: string
  label: string
  /** Omit when the count is unknown; pass 0 to mark the tab empty. */
  count?: number
}

interface RecordTabsProps {
  /** The record's own path, e.g. /app/orders/:id. The default tab links here. */
  basePath: string
  /**
   * Segment inserted before the tab key, e.g. '/tab' for
   * /app/orders/:id/tab/finance. Must match the route definition.
   */
  tabPrefix?: string
  activeTab: string
  items: RecordTabItem[]
  /** The tab that lives on the bare record URL. Defaults to 'overview'. */
  defaultTab?: string
  ariaLabel?: string
}

/**
 * Routed section tabs for a record.
 *
 * These are real routes, not scroll anchors: each tab is linkable, correct with
 * the back button, and lets the page fetch only the section being viewed. A
 * zero-count tab still navigates but is dimmed — the destination is one line of
 * text, so it should not invite the click.
 */
export function RecordTabs({
  activeTab,
  ariaLabel = 'Record sections',
  basePath,
  defaultTab = 'overview',
  items,
  tabPrefix = '',
}: RecordTabsProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-[3.4rem] z-40 -mx-3 overflow-x-auto border-b border-border bg-surface/95 px-3 backdrop-blur sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6"
    >
      <div className="flex min-w-max items-center gap-5">
        {items.map((item) => {
          const isActive = item.key === activeTab
          const isEmpty = item.count === 0

          return (
            <Link
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 border-b-2 px-0.5 text-sm font-semibold transition',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-foreground',
                isEmpty && !isActive && 'opacity-55',
              )}
              key={item.key}
              to={
                item.key === defaultTab
                  ? basePath
                  : `${basePath}${tabPrefix}/${item.key}`
              }
            >
              <span>{item.label}</span>
              {typeof item.count === 'number' ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-xs tabular-nums',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'bg-surface-muted text-muted',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
