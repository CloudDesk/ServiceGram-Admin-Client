interface PaginationProps {
  page: number
  total: number
  pageSize: number
}

export function Pagination({ page, total, pageSize }: PaginationProps) {
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <span>Server-side pagination ready</span>
    </div>
  )
}
