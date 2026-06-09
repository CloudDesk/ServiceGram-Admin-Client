interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
}

export function Pagination({ page, total, pageSize }: PaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="premium-table-footer flex items-center justify-between px-4 py-3 text-sm text-adaptive-muted">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <span>Server-side pagination ready</span>
    </div>
  );
}
