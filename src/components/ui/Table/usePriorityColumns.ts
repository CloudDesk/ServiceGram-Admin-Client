import { useCallback, useRef, useState } from 'react'

/**
 * Tracks an element's content width via a callback ref, not `useRef` +
 * `useEffect(..., [ref])` — a ref object never changes identity, so that
 * effect only ever fires once, at the first commit. If the element this is
 * attached to mounts later (behind a loading gate, a tab switch — exactly
 * how DynamicTable's own callers tend to be structured), that first fire
 * finds nothing and the width is stuck at 0 forever. A callback ref runs
 * again every time React actually attaches or detaches the node.
 */
function useElementWidth() {
  const [width, setWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((element: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })

    observer.observe(element)
    observerRef.current = observer
    setWidth(element.getBoundingClientRect().width)
  }, [])

  return [width, ref] as const
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
 * `DataList` has, without changing how a cell renders. Pass the returned
 * `containerRef` to the element wrapping the table (it accepts a callback
 * ref, so this is a normal `ref={containerRef}` on any element); render only
 * the columns `visibleColumns` returns.
 */
export function usePriorityColumns<TColumn extends PriorityColumnLike>({
  columns,
  gap = 16,
  reservedWidth = 0,
}: UsePriorityColumnsOptions<TColumn>) {
  const [availableWidth, containerRef] = useElementWidth()

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
