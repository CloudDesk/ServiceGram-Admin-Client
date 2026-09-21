import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  DataListColumn,
  DataListDensity,
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
  /** Measured viewport width. Lets a capped grow column use available space. */
  availableWidth: number
  /** Width of the leading selection column, if any. */
  leadingWidth?: number
  /** Width of the trailing action column, if any. */
  trailingWidth?: number
  /** Density before any persisted preference applies. Defaults to 'default'. */
  defaultDensity?: DataListDensity
}

/** Owns persisted column visibility, width and density for a DataList. */
export function useDataListColumns<TRow>({
  availableWidth,
  columns,
  defaultDensity = 'default',
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
    () => stored.density ?? defaultDensity,
  )

  useEffect(() => {
    writeStored(storageKey, { density, hidden: hiddenIds, widths })
  }, [density, hiddenIds, storageKey, widths])

  const widthOf = useCallback(
    (column: DataListColumn<TRow>) =>
      Math.max(column.minWidth, widths[column.id] ?? column.defaultWidth),
    [widths],
  )

  /** Checked columns are always rendered; wide configurations scroll. */
  const enabledColumns = useMemo(
    () => columns.filter((column) => !hiddenIds.includes(column.id)),
    [columns, hiddenIds],
  )

  const tableMinWidth = useMemo(() => {
    const gap = 8
    const rowPadding = 24
    const fixedCount = (leadingWidth ? 1 : 0) + (trailingWidth ? 1 : 0)
    const gapsTotal = Math.max(0, enabledColumns.length + fixedCount - 1) * gap

    return (
      rowPadding +
      leadingWidth +
      trailingWidth +
      gapsTotal +
      enabledColumns.reduce((total, column) => total + widthOf(column), 0)
    )
  }, [enabledColumns, leadingWidth, trailingWidth, widthOf])

  const gridTemplate = useMemo(() => {
    const parts: string[] = []

    if (leadingWidth) parts.push(`${leadingWidth}px`)

    // `fr` can't be capped from inside minmax()/min() — there's no CSS track
    // syntax for "flexible, but no wider than Npx". So when a grow column
    // declares maxWidth, its px share is computed from the table width here
    // and emitted as a literal px value instead of `1fr`.
    const growColumn = enabledColumns.find((column) => column.grow)

    if (growColumn?.maxWidth) {
      const gap = 8
      const rowPadding = 24
      const fixedCount = (leadingWidth ? 1 : 0) + (trailingWidth ? 1 : 0)
      const gapsTotal = Math.max(0, enabledColumns.length + fixedCount - 1) * gap
      const fixedColumnsTotal = enabledColumns.reduce(
        (total, column) => total + (column.grow ? 0 : widthOf(column)),
        0,
      )
      const viewportWidth = Math.max(availableWidth, tableMinWidth)
      const budget = viewportWidth - leadingWidth - trailingWidth - rowPadding
      const remaining = budget - fixedColumnsTotal - gapsTotal
      const growWidth = Math.round(
        Math.max(widthOf(growColumn), Math.min(growColumn.maxWidth, remaining)),
      )

      enabledColumns.forEach((column) => {
        parts.push(column.grow ? `${growWidth}px` : `${widthOf(column)}px`)
      })
    } else {
      enabledColumns.forEach((column) => {
        parts.push(
          column.grow
            ? `minmax(${widthOf(column)}px, 1fr)`
            : `${widthOf(column)}px`,
        )
      })
    }

    if (trailingWidth) parts.push(`${trailingWidth}px`)

    return parts.join(' ')
  }, [availableWidth, enabledColumns, leadingWidth, tableMinWidth, trailingWidth, widthOf])

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
    enabledColumns,
    gridTemplate,
    hiddenIds,
    resetColumns,
    setColumnWidth,
    setDensity,
    tableMinWidth,
    toggleColumn,
    visibleColumns: enabledColumns,
    widthOf,
  }
}
