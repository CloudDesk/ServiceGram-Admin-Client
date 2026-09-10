import { useEffect, useRef, useState, type RefObject } from 'react'

/** Tracks an element's content width, e.g. to decide how many columns fit. */
function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [ref])

  return width
}

export type ColumnPriority = 1 | 2 | 3 | 4

export interface PriorityColumnLike {
  key: string
  minWidth?: number | string
  /** Lower drops first when width is tight. Defaults to 3 — matches DataList's convention. */
  priority?: ColumnPriority
}

interface UsePriorityColumnsOptions<TColumn extends PriorityColumnLike> {
  columns: TColumn[]
  /** Width already spoken for outside the data columns — an action column, a leading checkbox. */
  reservedWidth?: number
  gap?: number
}

/**
 * `DynamicTable` renders rich, multi-line cells — the reason it isn't just
 * swapped for `DataList`, which only draws a single truncated line per cell.
 * This gives it the same "drop lowest priority first until it fits" behavior
 * `DataList` has, without changing how a cell renders. Wrap the table's
 * scroll container in a ref and pass it here; render only the columns this
 * returns.
 */
export function usePriorityColumns<TColumn extends PriorityColumnLike>({
  columns,
  gap = 16,
  reservedWidth = 0,
}: UsePriorityColumnsOptions<TColumn>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const availableWidth = useElementWidth(containerRef)

  if (availableWidth <= 0) {
    return { containerRef, visibleColumns: columns }
  }

  const budget = availableWidth - reservedWidth
  const widthOf = (column: TColumn) =>
    typeof column.minWidth === 'number' ? column.minWidth : 0

  const measure = (list: TColumn[]) =>
    list.reduce((total, column) => total + widthOf(column), 0) +
    Math.max(0, list.length - 1) * gap

  let kept = [...columns]

  for (let priority: ColumnPriority = 4; priority > 1; priority--) {
    if (measure(kept) <= budget) break

    for (let index = kept.length - 1; index >= 0; index--) {
      if (measure(kept) <= budget) break

      const column = kept[index]
      if (!column || (column.priority ?? 3) !== priority) continue

      kept = kept.filter((candidate) => candidate.key !== column.key)
    }
  }

  return { containerRef, visibleColumns: kept }
}
