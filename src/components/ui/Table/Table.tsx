import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  MoreHorizontal,
} from 'lucide-react'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { Card } from '../Card'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { Skeleton } from '../Skeleton'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { formatMoney } from '../../../utils/formatMoney'
import type { StatusTone } from '../../../types/status.types'

type TextAlign = 'left' | 'center' | 'right'
type SortDirection = 'asc' | 'desc'
type CellFormat = 'text' | 'date' | 'currency' | 'status'

export interface DynamicTableSortState {
  field?: string
  direction?: SortDirection
}

export interface DynamicTablePagination {
  page: number
  pageSize: number
  total: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  rowsPerPageOptions?: number[]
}

export interface DynamicTableRowAction<T> {
  key: string
  label: string
  icon?: ReactNode
  onClick: (row: T) => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  placement?: 'inline' | 'menu'
  isVisible?: boolean | ((row: T) => boolean)
  isDisabled?: boolean | ((row: T) => boolean)
}

export interface DynamicTableColumn<T> {
  key: string
  label: string
  sortable?: boolean
  width?: number | string
  minWidth?: number | string
  align?: TextAlign
  getValue?: (row: T) => unknown
  renderCell?: (row: T) => ReactNode
  format?: CellFormat
  currency?: string
  locale?: string
  placeholder?: string
  className?: string
  headerClassName?: string
  statusTone?: StatusTone | ((value: unknown, row: T) => StatusTone)
}

export interface DynamicTableProps<T> {
  columns: DynamicTableColumn<T>[]
  data: T[]
  title?: string
  description?: string
  loading?: boolean
  error?: boolean | string
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  pagination?: DynamicTablePagination
  sort?: DynamicTableSortState
  onSortChange?: (sort: DynamicTableSortState) => void
  onRowClick?: (row: T) => void
  rowActions?: DynamicTableRowAction<T>[] | ((row: T) => DynamicTableRowAction<T>[])
  toolbar?: ReactNode
  footer?: ReactNode
  stickyHeader?: boolean
  stickyFooter?: boolean
  bodyHeight?: number | string
  bodyMaxHeight?: number | string
  actionColumnLabel?: string
  getRowId?: (row: T, index: number) => string
  enableLocalSort?: boolean
  className?: string
  rowClassName?: string | ((row: T, index: number) => string)
}

interface LegacyTableProps<T extends object> {
  columns: ColumnDef<T>[]
  data: T[]
  title: string
  description: string
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  emptyTitle?: string
  emptyDescription?: string
  total?: number
  page?: number
  pageSize?: number
}

function toCssSize(value?: number | string) {
  if (typeof value === 'number') {
    return `${value}px`
  }

  return value
}

function getAlignClasses(align: TextAlign = 'left') {
  switch (align) {
    case 'center':
      return 'text-center'
    case 'right':
      return 'text-right'
    default:
      return 'text-left'
  }
}

function getFlexAlignClasses(align: TextAlign = 'left') {
  switch (align) {
    case 'center':
      return 'justify-center'
    case 'right':
      return 'justify-end'
    default:
      return 'justify-start'
  }
}

function normalizeValue(value: unknown) {
  if (value == null) {
    return ''
  }

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  const parsedDate = Date.parse(String(value))

  if (!Number.isNaN(parsedDate) && String(value).includes('-')) {
    return parsedDate
  }

  return String(value).toLowerCase()
}

function isActionVisible<T>(
  action: DynamicTableRowAction<T>,
  row: T,
) {
  return typeof action.isVisible === 'function'
    ? action.isVisible(row)
    : action.isVisible ?? true
}

function isActionDisabled<T>(
  action: DynamicTableRowAction<T>,
  row: T,
) {
  return typeof action.isDisabled === 'function'
    ? action.isDisabled(row)
    : action.isDisabled ?? false
}

function DynamicRowActionMenu<T>({
  actions,
  row,
}: {
  actions: DynamicTableRowAction<T>[]
  row: T
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    const handleClose = () => setOpen(false)

    window.addEventListener('click', handleClose)

    return () => {
      window.removeEventListener('click', handleClose)
    }
  }, [open])

  return (
    <div className="relative">
      <Button
        aria-label="More actions"
        size="sm"
        type="button"
        variant="ghost"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div
          className="premium-common-surface absolute right-0 top-[calc(100%+0.375rem)] z-30 min-w-[11rem] overflow-hidden rounded-[1rem] p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.14)]"
          onClick={(event) => event.stopPropagation()}
        >
          {actions.map((action) => (
            <button
              className="flex w-full items-center gap-2 rounded-[0.8rem] px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isActionDisabled(action, row)}
              key={action.key}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setOpen(false)
                action.onClick(row)
              }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DefaultPagination({
  pagination,
  stickyFooter,
}: {
  pagination: DynamicTablePagination
  stickyFooter: boolean
}) {
  const { onPageChange, onPageSizeChange, page, pageSize, rowsPerPageOptions, total } =
    pagination
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div
      className={cn(
        'premium-table-footer flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        stickyFooter && 'sticky bottom-0 z-10',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {start}-{end} of {total}
        </span>
        {rowsPerPageOptions?.length && onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span>Rows</span>
            <select
              className="rounded-control border border-border bg-surface px-2 py-1 text-foreground outline-none focus:border-foreground/20"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {rowsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={!onPageChange || page <= 1}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onPageChange?.(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-20 text-center text-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          disabled={!onPageChange || page >= totalPages}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onPageChange?.(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function resolveCellContent<T>(column: DynamicTableColumn<T>, row: T) {
  if (column.renderCell) {
    return column.renderCell(row)
  }

  const value =
    column.getValue?.(row) ?? (row as Record<string, unknown>)[column.key]

  if (value == null || value === '') {
    return (
      <span className="text-muted">{column.placeholder ?? '—'}</span>
    )
  }

  if (column.format === 'status') {
    const tone =
      typeof column.statusTone === 'function'
        ? column.statusTone(value, row)
        : (column.statusTone ?? 'neutral')

    return <Badge tone={tone}>{String(value)}</Badge>
  }

  if (column.format === 'date') {
    return formatDate(String(value), true)
  }

  if (column.format === 'currency') {
    return formatMoney(Number(value), column.currency)
  }

  return String(value)
}

export function DynamicTable<T>({
  actionColumnLabel = 'Actions',
  bodyHeight,
  bodyMaxHeight = 540,
  className,
  columns,
  data,
  description,
  emptyDescription = 'Try adjusting filters, sorting, or your search term.',
  emptyTitle = 'No records found',
  enableLocalSort = false,
  error = false,
  footer,
  getRowId,
  loading = false,
  onRetry,
  onRowClick,
  onSortChange,
  pagination,
  rowActions,
  rowClassName,
  sort,
  stickyFooter = true,
  stickyHeader = true,
  title = 'records',
  toolbar,
}: DynamicTableProps<T>) {
  const [internalSort, setInternalSort] = useState<DynamicTableSortState>({})
  const activeSort = sort ?? internalSort
  const resolvedActions = useMemo(
    () =>
      data.map((row) => {
        const actions = typeof rowActions === 'function' ? rowActions(row) : rowActions ?? []

        return actions.filter((action) => isActionVisible(action, row))
      }),
    [data, rowActions],
  )

  const computedData = useMemo(() => {
    if (!enableLocalSort || !activeSort.field || !activeSort.direction) {
      return data
    }

    const targetColumn = columns.find((column) => column.key === activeSort.field)

    if (!targetColumn) {
      return data
    }

    return [...data].sort((leftRow, rightRow) => {
      const leftValue =
        targetColumn.getValue?.(leftRow) ??
        (leftRow as Record<string, unknown>)[targetColumn.key]
      const rightValue =
        targetColumn.getValue?.(rightRow) ??
        (rightRow as Record<string, unknown>)[targetColumn.key]

      const normalizedLeft = normalizeValue(leftValue)
      const normalizedRight = normalizeValue(rightValue)

      if (normalizedLeft === normalizedRight) {
        return 0
      }

      const baseResult = normalizedLeft > normalizedRight ? 1 : -1

      return activeSort.direction === 'asc' ? baseResult : -baseResult
    })
  }, [activeSort.direction, activeSort.field, columns, data, enableLocalSort])

  const tableBodyStyle: CSSProperties = {
    height: toCssSize(bodyHeight),
    maxHeight: toCssSize(bodyMaxHeight),
  }

  const footerNode =
    footer ?? (pagination ? <DefaultPagination pagination={pagination} stickyFooter={stickyFooter} /> : null)

  const errorDescription =
    typeof error === 'string'
      ? error
      : description ?? `We could not load ${title.toLowerCase()} right now. Please refresh and try again.`

  if (loading) {
    return (
      <Card className={cn('premium-table-card overflow-hidden', className)}>
        {toolbar ? <div className="premium-table-toolbar px-4 py-3">{toolbar}</div> : null}
        <div className="space-y-3 p-4">
          <Skeleton className="h-11 w-full" />
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-14 w-full" key={index} />
          ))}
        </div>
        {footerNode}
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn('premium-table-card overflow-hidden', className)}>
        {toolbar ? <div className="premium-table-toolbar px-4 py-3">{toolbar}</div> : null}
        <ErrorState
          description={errorDescription}
          onRetry={onRetry}
          title={`Unable to load ${title.toLowerCase()}`}
        />
        {footerNode}
      </Card>
    )
  }

  if (computedData.length === 0) {
    return (
      <Card className={cn('premium-table-card overflow-hidden', className)}>
        {toolbar ? <div className="premium-table-toolbar px-4 py-3">{toolbar}</div> : null}
        <EmptyState description={emptyDescription} title={emptyTitle} />
        {footerNode}
      </Card>
    )
  }

  return (
    <Card className={cn('premium-table-card overflow-hidden', className)}>
      {toolbar ? <div className="premium-table-toolbar px-4 py-3">{toolbar}</div> : null}
      <div className="overflow-x-auto">
        <div className="overflow-auto" style={tableBodyStyle}>
          <table className="min-w-full border-separate border-spacing-0">
            <thead
              className={cn(
                'premium-table-head text-left text-[0.7rem] uppercase tracking-[0.08em]',
                stickyHeader && 'sticky top-0 z-10',
              )}
            >
              <tr>
                {columns.map((column) => {
                  const isActiveSort = activeSort.field === column.key
                  const alignClass = getAlignClasses(column.align)
                  const style: CSSProperties = {
                    width: toCssSize(column.width),
                    minWidth: toCssSize(column.minWidth ?? column.width),
                  }

                  return (
                    <th
                      className={cn(
                        'px-4 py-3 font-semibold',
                        alignClass,
                        column.headerClassName,
                      )}
                      key={column.key}
                      style={style}
                    >
                      {column.sortable ? (
                        <button
                          className={cn(
                            'inline-flex items-center gap-2 text-inherit transition hover:text-foreground',
                            getFlexAlignClasses(column.align),
                            alignClass,
                            'w-full',
                          )}
                          type="button"
                          onClick={() => {
                            const nextSort = {
                              field: column.key,
                              direction:
                                isActiveSort && activeSort.direction === 'asc' ? 'desc' : 'asc',
                            } satisfies DynamicTableSortState

                            if (onSortChange) {
                              onSortChange(nextSort)
                              return
                            }

                            if (enableLocalSort) {
                              setInternalSort(nextSort)
                            }
                          }}
                        >
                          <span>{column.label}</span>
                          {isActiveSort ? (
                            activeSort.direction === 'asc' ? (
                              <ChevronUp className="size-4 text-foreground" />
                            ) : (
                              <ChevronDown className="size-4 text-foreground" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-4" />
                          )}
                        </button>
                      ) : (
                        <span>{column.label}</span>
                      )}
                    </th>
                  )
                })}
                {rowActions ? (
                  <th className="premium-table-head sticky right-0 z-10 px-4 py-3 text-right font-semibold">
                    {actionColumnLabel}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="premium-table-body">
              {computedData.map((row, rowIndex) => {
                const rowId = getRowId?.(row, rowIndex) ?? String(rowIndex)
                const actions = resolvedActions[rowIndex] ?? []
                const inlineActions = actions.filter((action) => action.placement !== 'menu').slice(0, 2)
                const menuActions = [
                  ...actions.filter((action) => action.placement === 'menu'),
                  ...actions.filter((action) => action.placement !== 'menu').slice(2),
                ]

                return (
                  <tr
                    className={cn(
                      'group transition',
                      onRowClick &&
                        'cursor-pointer hover:bg-surface-muted/70',
                      typeof rowClassName === 'function'
                        ? rowClassName(row, rowIndex)
                        : rowClassName,
                    )}
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => {
                      const alignClass = getAlignClasses(column.align)
                      const style: CSSProperties = {
                        width: toCssSize(column.width),
                        minWidth: toCssSize(column.minWidth ?? column.width),
                      }

                      return (
                        <td
                          className={cn(
                            'premium-table-cell px-4 py-3.5 align-top text-sm',
                            alignClass,
                            column.className,
                          )}
                          key={`${rowId}-${column.key}`}
                          style={style}
                        >
                          <div className="min-h-6 break-words">
                            {resolveCellContent(column, row)}
                          </div>
                        </td>
                      )
                    })}
                    {rowActions ? (
                      <td className="premium-table-cell sticky right-0 px-4 py-3.5 text-right align-top group-hover:bg-surface-muted/70">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {inlineActions.map((action) => (
                            <Button
                              disabled={isActionDisabled(action, row)}
                              key={action.key}
                              size="sm"
                              type="button"
                              variant={action.variant ?? 'ghost'}
                              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                event.stopPropagation()
                                action.onClick(row)
                              }}
                            >
                              {action.icon}
                              <span>{action.label}</span>
                            </Button>
                          ))}
                          {menuActions.length ? (
                            <DynamicRowActionMenu actions={menuActions} row={row} />
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {footerNode}
    </Card>
  )
}

export function TableShell<T extends object>({
  columns,
  data,
  description,
  emptyDescription = 'Try changing the filters or search term.',
  emptyTitle = 'No records found',
  isError = false,
  isLoading = false,
  onRetry,
  page = 1,
  pageSize = 25,
  title,
  total,
}: LegacyTableProps<T>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <Card className="premium-table-card overflow-hidden">
        <div className="space-y-4 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    )
  }

  if (isError) {
    return (
      <ErrorState
        description={description}
        onRetry={onRetry}
        title={`Unable to load ${title.toLowerCase()}`}
      />
    )
  }

  if (data.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />
  }

  return (
    <Card className="premium-table-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="premium-table-head text-left text-xs uppercase tracking-wide">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th className="px-4 py-3 font-semibold" key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="border-t border-border" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className="premium-table-cell px-4 py-3 text-sm" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DefaultPagination
        pagination={{
          page,
          pageSize,
          total: total ?? data.length,
        }}
        stickyFooter={false}
      />
    </Card>
  )
}
