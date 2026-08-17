import type { ReactNode } from 'react'

/**
 * Row density. Heights are deliberate: 32/40/48 keeps a single line of text
 * plus a status pill legible at every step, and 40 is the default because it
 * fits ~18 rows in a 900px viewport with the standard toolbar.
 */
export type DataListDensity = 'compact' | 'default' | 'comfortable'

export const DATA_LIST_ROW_HEIGHT: Record<DataListDensity, number> = {
  compact: 32,
  default: 40,
  comfortable: 48,
}

export const DATA_LIST_HEADER_HEIGHT = 32

export type DataListAlign = 'left' | 'right'

/**
 * Responsive priority. When the viewport cannot fit every visible column, the
 * lowest priority is dropped first. Priority 1 columns are never dropped —
 * they are what identifies the record.
 */
export type DataListPriority = 1 | 2 | 3 | 4

export interface DataListColumn<TRow> {
  id: string
  label: string
  defaultWidth: number
  minWidth: number
  /** Lower drops first when width is tight. Defaults to 3. */
  priority?: DataListPriority
  align?: DataListAlign
  /** Column expands to fill leftover space. At most one column should set this. */
  grow?: boolean
  /** Sort key sent to the API. Omit to make the column unsortable. */
  sortKey?: string
  /** Hidden until the user enables it in the Columns menu. */
  defaultHidden?: boolean
  /** Column cannot be hidden — the record would become unidentifiable. */
  locked?: boolean
  render: (row: TRow) => ReactNode
}

export type DataListSortDirection = 'asc' | 'desc'

export interface DataListSort {
  key: string
  direction: DataListSortDirection
}

export interface DataListQueueTab {
  key: string
  label: string
  count?: number
  /** Semantic tone for the count badge. */
  tone?: 'neutral' | 'warning' | 'danger'
}
