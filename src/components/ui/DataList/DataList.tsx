import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import {
  useEffect,
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
  type DataListDensity,
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
  itemName?: DataListItemName
  /** Bulk operations for the current selection. */
  actions?: ReactNode
}

export interface DataListItemName {
  singular: string
  plural: string
}

export interface DataListPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  itemName?: DataListItemName
  pageSizeLabel?: string
  summaryLabel?: string
}

interface DataListProps<TRow> {
  rows: TRow[]
  columns: DataListColumn<TRow>[]
  getRowId: (row: TRow) => string
  /** Namespaced key for persisted column and density preferences. */
  storageKey: string
  /**
   * Row density before the user picks one from the Density menu (still
   * overridden by whatever's persisted under `storageKey`). Defaults to
   * `'default'`. Bump to `'comfortable'` for a list whose cells stack two
   * lines of content — two lines in a 40px row leaves almost no vertical
   * breathing room.
   */
  defaultDensity?: DataListDensity
  /** Fixed height for purpose-built multiline rows. */
  rowHeight?: number
  /** Hide density choices when a screen requires a stable multiline row. */
  showDensityControl?: boolean

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
  /** Selectable "Rows per page" values. Must not exceed what the backing list endpoint allows. */
  pageSizeOptions?: number[]

  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  onRetry?: () => void
  emptyMessage?: string
  emptyHint?: string
}

// Every admin list endpoint currently caps its `limit` query param at 100
// (see each module's list-query DTO), so offering a larger value here just
// produces a VALIDATION_FAILED response. Pass `pageSizeOptions` to override
// per page if a specific endpoint ever supports a higher cap.
const PAGE_SIZE_OPTIONS = [25, 50, 100]

export function DataList<TRow>({
  activeQueue,
  appliedFilterCount = 0,
  columns,
  defaultDensity,
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
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  queueTabs,
  rowActions,
  rowActionsWidth = 96,
  rowHeight: fixedRowHeight,
  rows,
  search,
  searchPlaceholder,
  selection,
  sort,
  storageKey,
  showDensityControl = true,
  toolbarActions,
}: DataListProps<TRow>) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const availableWidth = useElementWidth(gridRef)

  const leadingWidth = selection ? LIST_SELECTION_COLUMN_WIDTH : 0
  const trailingWidth = rowActions ? rowActionsWidth : 0

  const {
    density,
    gridTemplate,
    hiddenIds,
    resetColumns,
    setDensity,
    tableMinWidth,
    toggleColumn,
    visibleColumns,
  } = useDataListColumns({
    availableWidth,
    columns,
    defaultDensity,
    leadingWidth,
    storageKey,
    trailingWidth,
  })

  const rowHeight = fixedRowHeight ?? DATA_LIST_ROW_HEIGHT[density]
  const gridStyle: GridStyle = { '--data-list-template': gridTemplate }

  // Sticky leading/trailing columns hide whatever scrolls underneath them;
  // toggling these as plain DOM attributes (rather than React state) lets
  // every row's sticky cell react to scroll position via CSS alone, with no
  // per-scroll re-render of the list.
  useEffect(() => {
    const el = gridRef.current
    if (!el) return undefined

    const updateScrollEdges = () => {
      const canScrollLeft = el.scrollLeft > 1
      const canScrollRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      el.dataset.scrollLeft = String(canScrollLeft)
      el.dataset.scrollRight = String(canScrollRight)
    }

    updateScrollEdges()
    el.addEventListener('scroll', updateScrollEdges, { passive: true })

    const observer = new ResizeObserver(updateScrollEdges)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', updateScrollEdges)
      observer.disconnect()
    }
  }, [gridTemplate, tableMinWidth, rows.length])

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
  const paginationItemName = pagination.itemName ?? {
    singular: 'record',
    plural: 'records',
  }
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
        filters={filters}
        hiddenIds={hiddenIds}
        queueTabs={queueTabs}
        search={search}
        searchPlaceholder={searchPlaceholder}
        showDensityControl={showDensityControl}
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
          pluralItemName={selection.itemName?.plural}
          selectedCount={selection.selectedIds.length}
          singularItemName={selection.itemName?.singular}
          visibleCount={visibleIds.length}
          onClear={() => selection.onSelectionChange([])}
          onSelectVisible={toggleAllVisible}
        />
      ) : null}

      <div
        ref={gridRef}
        aria-label={`${paginationItemName.plural} table`}
        className="min-h-0 flex-1 overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        role="region"
        tabIndex={0}
      >
        <div className="min-h-full" style={{ minWidth: tableMinWidth }}>
          <div
            className="sticky top-0 z-20 grid w-full shrink-0 items-center gap-2 border-b border-border bg-surface-muted px-3 text-[0.68rem] font-semibold uppercase tracking-wide text-muted"
            style={{ ...gridStyle, gridTemplateColumns: 'var(--data-list-template)', height: DATA_LIST_HEADER_HEIGHT }}
          >
            {selection ? (
              <div className="data-list-sticky-cell data-list-sticky-leading sticky left-0 z-30 flex h-full items-center justify-center bg-surface-muted">
                <ListSelectionCheckbox
                  checked={allVisibleSelected}
                  className="size-8"
                  indeterminate={selectedVisibleCount > 0}
                  label={`Select visible ${selection.itemName?.plural ?? 'rows'}`}
                  onChange={toggleAllVisible}
                />
              </div>
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

            {rowActions ? (
              <span className="data-list-sticky-cell data-list-sticky-trailing sticky right-0 z-30 bg-surface-muted px-1 text-right">
                Actions
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <div className="space-y-px p-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} style={{ height: rowHeight }}>
                  <Skeleton className="h-full w-full" />
                </div>
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
                    'data-list-row grid w-full items-center gap-2 border-b border-border px-3 text-sm transition last:border-b-0',
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
                    <div className="data-list-sticky-cell data-list-sticky-leading sticky left-0 z-10 flex h-full items-center justify-center">
                      <ListSelectionCheckbox
                        checked={isSelected}
                        label={`Select row ${id}`}
                        onChange={() => toggleRow(id)}
                      />
                    </div>
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
                      className="data-list-sticky-cell data-list-sticky-trailing sticky right-0 z-10 flex items-center justify-end gap-1"
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
        <span className="flex items-center gap-1.5 tabular-nums">
          {totalItems === 0
            ? `No ${paginationItemName.plural}`
            : `${rangeStart}–${rangeEnd} of ${totalItems} ${
                totalItems === 1
                  ? paginationItemName.singular
                  : paginationItemName.plural
              }`}
          {pagination.summaryLabel ? (
            <>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span>{pagination.summaryLabel}</span>
            </>
          ) : null}
        </span>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span className="text-xs">{pagination.pageSizeLabel ?? 'Rows'}</span>
            <select
              className="h-8 rounded-[0.5rem] border border-border bg-surface px-1.5 text-sm text-foreground outline-none focus:border-primary"
              value={pageSize}
              onChange={(event) => pagination.onPageSizeChange(Number(event.target.value))}
            >
              {pageSizeOptions.map((option) => (
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
