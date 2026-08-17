import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DataListColumn,
  DataListDensity,
  DataListPriority,
} from './DataList.types'

interface StoredState {
  hidden?: string[]
  widths?: Record<string, number>
  density?: DataListDensity
}

function readStored(storageKey: string): StoredState {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as StoredState) : {}
  } catch {
    return {}
  }
}

function writeStored(storageKey: string, state: StoredState) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode, quota). Preferences stay in-memory.
  }
}

interface UseDataListColumnsOptions<TRow> {
  columns: DataListColumn<TRow>[]
  storageKey: string
  /** Measured width available to the grid. Drives responsive column dropping. */
  availableWidth: number
  /** Width of the leading selection column, if any. */
  leadingWidth?: number
  /** Width of the trailing action column, if any. */
  trailingWidth?: number
}

/**
 * Owns column visibility, width, density and responsive priority for a
 * DataList. The responsive part is the reason this exists: rather than letting
 * the grid overflow into a horizontal scrollbar, we drop the lowest-priority
 * columns until the remainder fits.
 */
export function useDataListColumns<TRow>({
  availableWidth,
  columns,
  leadingWidth = 0,
  storageKey,
  trailingWidth = 0,
}: UseDataListColumnsOptions<TRow>) {
  const [stored] = useState(() => readStored(storageKey))

  const [hiddenIds, setHiddenIds] = useState<string[]>(
    () =>
      stored.hidden ??
      columns.filter((column) => column.defaultHidden).map((column) => column.id),
  )
  const [widths, setWidths] = useState<Record<string, number>>(
    () => stored.widths ?? {},
  )
  const [density, setDensity] = useState<DataListDensity>(
    () => stored.density ?? 'default',
  )

  useEffect(() => {
    writeStored(storageKey, { density, hidden: hiddenIds, widths })
  }, [density, hiddenIds, storageKey, widths])

  const widthOf = useCallback(
    (column: DataListColumn<TRow>) =>
      Math.max(column.minWidth, widths[column.id] ?? column.defaultWidth),
    [widths],
  )

  /** Columns the user has chosen to show, before responsive dropping. */
  const enabledColumns = useMemo(
    () => columns.filter((column) => !hiddenIds.includes(column.id)),
    [columns, hiddenIds],
  )

  /**
   * Columns that actually fit. Drops by ascending priority until the total
   * fits the available width, so the table never scrolls sideways.
   */
  const { droppedIds, visibleColumns } = useMemo(() => {
    const gap = 8
    // Rows are px-3, so both paddings come out of the usable width. Leaving
    // this out is what makes the last column clip instead of dropping.
    const rowPadding = 24
    const fixedCount = (leadingWidth ? 1 : 0) + (trailingWidth ? 1 : 0)
    const budget = availableWidth - leadingWidth - trailingWidth - rowPadding

    if (budget <= 0) {
      return { droppedIds: [] as string[], visibleColumns: enabledColumns }
    }

    /** Column widths plus every gap in the row, including around the
     *  selection and action columns. */
    const measure = (list: DataListColumn<TRow>[]) =>
      list.reduce((total, column) => total + widthOf(column), 0) +
      Math.max(0, list.length + fixedCount - 1) * gap

    let kept = [...enabledColumns]
    const dropped: string[] = []

    // Drop lowest priority first; within the same priority, drop from the right.
    for (let priority = 4 as DataListPriority; priority > 1; priority--) {
      if (measure(kept) <= budget) break

      for (let index = kept.length - 1; index >= 0; index--) {
        if (measure(kept) <= budget) break

        const column = kept[index]
        if (!column || (column.priority ?? 3) !== priority) continue

        dropped.push(column.id)
        kept = kept.filter((candidate) => candidate.id !== column.id)
      }
    }

    return { droppedIds: dropped, visibleColumns: kept }
  }, [availableWidth, enabledColumns, leadingWidth, trailingWidth, widthOf])

  const gridTemplate = useMemo(() => {
    const parts: string[] = []

    if (leadingWidth) parts.push(`${leadingWidth}px`)

    visibleColumns.forEach((column) => {
      // Growing columns floor at 0 rather than their preferred width: cells
      // truncate, so a narrow column is always better than an overflowing row.
      parts.push(column.grow ? 'minmax(0, 1fr)' : `${widthOf(column)}px`)
    })

    if (trailingWidth) parts.push(`${trailingWidth}px`)

    return parts.join(' ')
  }, [leadingWidth, trailingWidth, visibleColumns, widthOf])

  const toggleColumn = useCallback(
    (columnId: string) => {
      const column = columns.find((candidate) => candidate.id === columnId)
      if (!column || column.locked) return

      setHiddenIds((current) =>
        current.includes(columnId)
          ? current.filter((id) => id !== columnId)
          : [...current, columnId],
      )
    },
    [columns],
  )

  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setWidths((current) => ({ ...current, [columnId]: Math.round(width) }))
  }, [])

  const resetColumns = useCallback(() => {
    setHiddenIds(
      columns.filter((column) => column.defaultHidden).map((column) => column.id),
    )
    setWidths({})
  }, [columns])

  return {
    density,
    droppedIds,
    enabledColumns,
    gridTemplate,
    hiddenIds,
    resetColumns,
    setColumnWidth,
    setDensity,
    toggleColumn,
    visibleColumns,
    widthOf,
  }
}
