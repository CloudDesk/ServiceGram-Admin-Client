import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import { Card } from '../Card'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { Skeleton } from '../Skeleton'
import { Pagination } from '../Pagination'

interface TableProps<T extends object> {
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
}: TableProps<T>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  })

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
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
        title={`Unable to load ${title.toLowerCase()}`}
        description={description}
        onRetry={onRetry}
      />
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
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
                  <td className="px-4 py-3 text-sm text-foreground" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total ?? data.length}
      />
    </Card>
  )
}
