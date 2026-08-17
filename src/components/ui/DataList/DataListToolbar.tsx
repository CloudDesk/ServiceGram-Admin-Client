import { ChevronDown, Columns3, Rows3, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../Button'
import { ListHeaderSearch } from '../ListHeaderSearch'
import type {
  DataListColumn,
  DataListDensity,
  DataListQueueTab,
} from './DataList.types'

const DENSITY_LABELS: Record<DataListDensity, string> = {
  compact: 'Compact',
  default: 'Default',
  comfortable: 'Comfortable',
}

interface MenuProps {
  label: string
  icon: ReactNode
  badge?: number
  children: ReactNode
  align?: 'left' | 'right'
  panelClassName?: string
}

/** Button + click-outside popover. Filters and Columns both use this so the
 *  toolbar stays a single band instead of expanding the page. */
function ToolbarMenu({
  align = 'right',
  badge,
  children,
  icon,
  label,
  panelClassName,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="true"
        className={cn(
          'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
          open
            ? 'border-primary/45 bg-primary/5 text-foreground'
            : 'border-border bg-surface text-foreground hover:bg-surface-muted',
        )}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        {badge ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-semibold text-primary-foreground">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          className={cn('size-3.5 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div
          className={cn(
            'absolute z-40 mt-1.5 min-w-[14rem] rounded-[0.75rem] border border-border bg-surface p-2 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

interface DataListToolbarProps<TRow> {
  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void

  queueTabs?: DataListQueueTab[]
  activeQueue?: string
  onQueueChange?: (key: string) => void

  filters?: ReactNode
  appliedFilterCount?: number
  onResetFilters?: () => void

  columns: DataListColumn<TRow>[]
  hiddenIds: string[]
  droppedIds: string[]
  onToggleColumn: (id: string) => void
  onResetColumns: () => void

  density: DataListDensity
  onDensityChange: (density: DataListDensity) => void

  /** Module-level actions such as Create. Kept to the right of the band. */
  actions?: ReactNode
}

export function DataListToolbar<TRow>({
  actions,
  activeQueue,
  appliedFilterCount = 0,
  columns,
  density,
  droppedIds,
  filters,
  hiddenIds,
  onDensityChange,
  onQueueChange,
  onResetColumns,
  onResetFilters,
  onSearchChange,
  onToggleColumn,
  queueTabs,
  search,
  searchPlaceholder,
}: DataListToolbarProps<TRow>) {
  return (
    <div className="shrink-0 border-b border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <ListHeaderSearch
          className="min-w-[13rem] flex-1 sm:max-w-sm"
          placeholder={searchPlaceholder}
          value={search}
          onChange={onSearchChange}
        />

        {queueTabs?.length ? (
          // Chips always get their own line. Sharing with the search field and
          // the menus clips them at every count we ship, and a queue you cannot
          // see is worse than 38px of chrome. Predictable beats packed.
          <div className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto">
            {queueTabs.map((tab) => {
              const isActive = tab.key === activeQueue

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
                  onClick={() => onQueueChange?.(tab.key)}
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
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {filters ? (
            <ToolbarMenu
              badge={appliedFilterCount}
              icon={<SlidersHorizontal className="size-4" />}
              label="Filters"
              panelClassName="w-[min(22rem,calc(100vw-2rem))] p-3"
            >
              <div className="space-y-3">{filters}</div>
              {onResetFilters && appliedFilterCount > 0 ? (
                <div className="mt-3 flex justify-end border-t border-border pt-2">
                  <Button size="sm" type="button" variant="ghost" onClick={onResetFilters}>
                    <X className="mr-1 size-3.5" />
                    Reset filters
                  </Button>
                </div>
              ) : null}
            </ToolbarMenu>
          ) : null}

          <ToolbarMenu icon={<Columns3 className="size-4" />} label="Columns">
            <p className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
              Visible columns
            </p>
            {columns.map((column) => {
              const isHidden = hiddenIds.includes(column.id)
              const isDropped = droppedIds.includes(column.id)

              return (
                <label
                  key={column.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-[0.5rem] px-2 py-1.5 text-sm transition hover:bg-surface-muted',
                    column.locked && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    checked={!isHidden}
                    className="size-3.5 accent-[color:var(--adaptive-primary)]"
                    disabled={column.locked}
                    type="checkbox"
                    onChange={() => onToggleColumn(column.id)}
                  />
                  <span className="flex-1">{column.label}</span>
                  {isDropped && !isHidden ? (
                    <span
                      className="text-[0.65rem] text-muted"
                      title="Hidden at this window width"
                    >
                      no room
                    </span>
                  ) : null}
                </label>
              )
            })}
            <div className="mt-1 flex justify-end border-t border-border pt-1.5">
              <Button size="sm" type="button" variant="ghost" onClick={onResetColumns}>
                Reset
              </Button>
            </div>
          </ToolbarMenu>

          <ToolbarMenu icon={<Rows3 className="size-4" />} label="Density">
            {(Object.keys(DENSITY_LABELS) as DataListDensity[]).map((key) => (
              <button
                key={key}
                className={cn(
                  'flex w-full items-center justify-between rounded-[0.5rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                  density === key && 'font-semibold text-primary',
                )}
                type="button"
                onClick={() => onDensityChange(key)}
              >
                {DENSITY_LABELS[key]}
              </button>
            ))}
          </ToolbarMenu>

          {actions}
        </div>
      </div>
    </div>
  )
}
