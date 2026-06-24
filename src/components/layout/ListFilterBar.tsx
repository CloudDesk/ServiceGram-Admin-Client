import { SlidersHorizontal, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'

export interface ActiveFilterChip {
  key: string
  label: string
  onRemove: () => void
}

interface ListFilterBarProps {
  activeFilters?: ActiveFilterChip[]
  actionNode?: ReactNode
  primaryFilters: ReactNode
  secondaryFilters?: ReactNode
  onClearAll?: () => void
}

export function ListFilterBar({
  activeFilters = [],
  actionNode,
  onClearAll,
  primaryFilters,
  secondaryFilters,
}: ListFilterBarProps) {
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const hasActiveFilters = activeFilters.length > 0

  return (
    <section className="list-filter-shell">
      <div className="list-filter-topline">
        <div className="list-filter-primary">{primaryFilters}</div>
        <div className="list-filter-actions">
          {actionNode}
          {secondaryFilters ? (
            <Button
              className="list-filter-more-toggle"
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => setSecondaryOpen((current) => !current)}
            >
              <SlidersHorizontal className="mr-2 size-4" />
              {secondaryOpen ? 'Hide filters' : 'More filters'}
            </Button>
          ) : null}
          {onClearAll && hasActiveFilters ? (
            <Button size="sm" type="button" variant="ghost" onClick={onClearAll}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="list-filter-chips" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button
              className="list-filter-chip"
              key={filter.key}
              type="button"
              onClick={filter.onRemove}
            >
              <span>{filter.label}</span>
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      ) : null}

      {secondaryFilters ? (
        <div className={cn('list-filter-secondary', secondaryOpen && 'is-open')}>
          {secondaryFilters}
        </div>
      ) : null}
    </section>
  )
}
