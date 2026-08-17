import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import {
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../Button'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../ListSelection'
import { Skeleton } from '../Skeleton'
import {
  DATA_LIST_HEADER_HEIGHT,
  DATA_LIST_ROW_HEIGHT,
  type DataListColumn,
  type DataListQueueTab,
  type DataListSort,
} from './DataList.types'
import { DataListToolbar } from './DataListToolbar'
import { useDataListColumns } from './useDataListColumns'
import { useElementWidth } from './useElementWidth'

interface GridStyle extends CSSProperties {
  '--data-list-template': string
}

export interface DataListSelection {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  /** Bulk operations for the current selection. */
  actions?: ReactNode
}

export interface DataListPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

interface DataListProps<TRow> {
  rows: TRow[]
  columns: DataListColumn<TRow>[]
  getRowId: (row: TRow) => string
  /** Namespaced key for persisted column and density preferences. */
  storageKey: string

  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void

  queueTabs?: DataListQueueTab[]
  activeQueue?: string
  onQueueChange?: (key: string) => void

  filters?: ReactNode
  appliedFilterCount?: number
  onResetFilters?: () => void

  sort?: DataListSort | null
  onSortChange?: (sort: DataListSort | null) => void

  selection?: DataListSelection
  /** Trailing per-row controls. Width is fixed so rows stay aligned. */
  rowActions?: (row: TRow) => ReactNode
  rowActionsWidth?: number
  onRowClick?: (row: TRow) => void

  toolbarActions?: ReactNode
  pagination: DataListPagination

  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  emptyMessage?: string
  emptyHint?: string
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

export function DataList<TRow>({
  activeQueue,
  appliedFilterCount = 0,
  columns,
  emptyHint,
  emptyMessage = 'No records found',
  errorMessage,
  filters,
  getRowId,
  isError = false,
  isLoading = false,
  onQueueChange,
  onResetFilters,
  onRetry,
  onRowClick,
  onSearchChange,
  onSortChange,
  pagination,
  queueTabs,
  rowActions,
  rowActionsWidth = 96,
  rows,
  search,
  searchPlaceholder,
  selection,
  sort,
  storageKey,
  toolbarActions,
}: DataListProps<TRow>) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const availableWidth = useElementWidth(gridRef)

  const leadingWidth = selection ? LIST_SELECTION_COLUMN_WIDTH : 0
  const trailingWidth = rowActions ? rowActionsWidth : 0

  const {
    density,
    droppedIds,
    gridTemplate,
    hiddenIds,
    resetColumns,
    setDensity,
    toggleColumn,
    visibleColumns,
  } = useDataListColumns({
    availableWidth,
    columns,
    leadingWidth,
    storageKey,
    trailingWidth,
  })

  const rowHeight = DATA_LIST_ROW_HEIGHT[density]
  const gridStyle: GridStyle = { '--data-list-template': gridTemplate }

  const selectedSet = useMemo(
    () => new Set(selection?.selectedIds ?? []),
    [selection?.selectedIds],
  )
  const visibleIds = useMemo(() => rows.map(getRowId), [getRowId, rows])
  const selectedVisibleCount = visibleIds.filter((id) => selectedSet.has(id)).length
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length

  const toggleRow = (id: string) => {
    if (!selection) return

    selection.onSelectionChange(
      selectedSet.has(id)
        ? selection.selectedIds.filter((candidate) => candidate !== id)
        : [...selection.selectedIds, id],
    )
  }

  const toggleAllVisible = () => {
    if (!selection) return

    selection.onSelectionChange(
      allVisibleSelected
        ? selection.selectedIds.filter((id) => !visibleIds.includes(id))
        : [...new Set([...selection.selectedIds, ...visibleIds])],
    )
  }

  const handleSort = (column: DataListColumn<TRow>) => {
    if (!column.sortKey || !onSortChange) return

    if (sort?.key !== column.sortKey) {
      onSortChange({ key: column.sortKey, direction: 'desc' })
      return
    }

    // desc -> asc -> unsorted
    onSortChange(sort.direction === 'desc' ? { key: column.sortKey, direction: 'asc' } : null)
  }

  const { page, pageSize, totalItems, totalPages } = pagination
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface">
      <DataListToolbar
        actions={toolbarActions}
        activeQueue={activeQueue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        density={density}
        droppedIds={droppedIds}
        filters={filters}
        hiddenIds={hiddenIds}
        queueTabs={queueTabs}
        search={search}
        searchPlaceholder={searchPlaceholder}
        onDensityChange={setDensity}
        onQueueChange={onQueueChange}
        onResetColumns={resetColumns}
        onResetFilters={onResetFilters}
        onSearchChange={onSearchChange}
        onToggleColumn={toggleColumn}
      />

      {selection && selection.selectedIds.length > 0 ? (
        <ListSelectionToolbar
          actions={selection.actions}
          allVisibleSelected={allVisibleSelected}
          selectedCount={selection.selectedIds.length}
          visibleCount={visibleIds.length}
          onClear={() => selection.onSelectionChange([])}
          onSelectVisible={toggleAllVisible}
        />
      ) : null}

      <div ref={gridRef} className="flex min-h-0 flex-1 flex-col">
        <div
          className="sticky top-0 z-20 grid shrink-0 items-center gap-2 border-b border-border bg-surface-muted px-3 text-[0.68rem] font-semibold uppercase tracking-wide text-muted"
          style={{ ...gridStyle, gridTemplateColumns: 'var(--data-list-template)', height: DATA_LIST_HEADER_HEIGHT }}
        >
          {selection ? (
            <ListSelectionCheckbox
              checked={allVisibleSelected}
              indeterminate={selectedVisibleCount > 0}
              label="Select visible rows"
              onChange={toggleAllVisible}
            />
          ) : null}

          {visibleColumns.map((column) => {
            const isSorted = Boolean(column.sortKey && sort?.key === column.sortKey)

            return column.sortKey && onSortChange ? (
              <button
                key={column.id}
                className={cn(
                  'flex min-w-0 items-center gap-1 truncate rounded-[0.4rem] px-1 py-0.5 text-left transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  column.align === 'right' && 'justify-end',
                  isSorted && 'text-foreground',
                )}
                title={`Sort by ${column.label}`}
                type="button"
                onClick={() => handleSort(column)}
              >
                <span className="truncate">{column.label}</span>
                {isSorted ? (
                  sort?.direction === 'asc' ? (
                    <ArrowUp className="size-3 shrink-0" />
                  ) : (
                    <ArrowDown className="size-3 shrink-0" />
                  )
                ) : (
                  <ChevronsUpDown className="size-3 shrink-0 opacity-35" />
                )}
              </button>
            ) : (
              <span
                key={column.id}
                className={cn(
                  'min-w-0 truncate px-1',
                  column.align === 'right' && 'text-right',
                )}
              >
                {column.label}
              </span>
            )
          })}

          {rowActions ? <span className="px-1 text-right">Actions</span> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-px p-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-start gap-2 px-4 py-6">
              <p className="text-sm font-medium text-danger">
                {errorMessage ?? 'Could not load records.'}
              </p>
              {onRetry ? (
                <Button size="sm" type="button" variant="secondary" onClick={onRetry}>
                  Try again
                </Button>
              ) : null}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-6">
              <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
              {emptyHint ? (
                <p className="mt-0.5 text-sm text-muted">{emptyHint}</p>
              ) : null}
            </div>
          ) : (
            rows.map((row) => {
              const id = getRowId(row)
              const isSelected = selectedSet.has(id)

              return (
                <div
                  key={id}
                  aria-selected={isSelected}
                  className={cn(
                    'grid w-full items-center gap-2 border-b border-border px-3 text-sm transition last:border-b-0',
                    onRowClick && 'cursor-pointer',
                    isSelected ? 'bg-primary/5' : 'hover:bg-surface-muted/50',
                  )}
                  role="row"
                  style={{
                    ...gridStyle,
                    gridTemplateColumns: 'var(--data-list-template)',
                    height: rowHeight,
                  }}
                  tabIndex={onRowClick ? 0 : -1}
                  onClick={() => onRowClick?.(row)}
                  onKeyDown={(event) => {
                    if (!onRowClick) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRowClick(row)
                    }
                  }}
                >
                  {selection ? (
                    <ListSelectionCheckbox
                      checked={isSelected}
                      label={`Select row ${id}`}
                      onChange={() => toggleRow(id)}
                    />
                  ) : null}

                  {visibleColumns.map((column) => (
                    <div
                      key={column.id}
                      className={cn(
                        'min-w-0 truncate px-1',
                        column.align === 'right' && 'text-right tabular-nums',
                      )}
                    >
                      {column.render(row)}
                    </div>
                  ))}

                  {rowActions ? (
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {rowActions(row)}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted px-3 py-2 text-sm text-muted">
        <span className="tabular-nums">
          {totalItems === 0
            ? 'No records'
            : `${rangeStart}–${rangeEnd} of ${totalItems}`}
        </span>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-xs">Rows</span>
            <select
              className="h-8 rounded-[0.5rem] border border-border bg-surface px-1.5 text-sm text-foreground outline-none focus:border-primary"
              value={pageSize}
              onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <Button
            className="h-8"
            disabled={page <= 1}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => pagination.onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="tabular-nums">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <Button
            className="h-8"
            disabled={page >= totalPages}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => pagination.onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
