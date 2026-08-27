import { Edit3, ExternalLink, History, MoreHorizontal, Power } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type {
  DataListColumn,
  DataListPagination,
  DataListQueueTab,
} from '../../../components/ui/DataList'
import { cn } from '../../../utils/cn'
import type { SettingsRecordType } from '../types/settings.types'
import type { SettingsActionSelection } from './SettingsActionModal'

/**
 * The column shape SettingsPage already uses. It is deliberately accepted
 * as-is so the ~300 lines of per-type column definitions need no rewriting;
 * only width and priority are added here.
 */
export interface SettingsListColumn<TRow> {
  id: string
  label: string
  minWidth: number
  render: (row: TRow, type: SettingsRecordType) => ReactNode
}

export interface SettingsRowAction {
  action: SettingsActionSelection
  label: string
  /** ACTIVATE/DEACTIVATE toggles state; UPDATE/EDIT opens a form. */
  kind: 'edit' | 'state'
  destructive?: boolean
}

interface SettingsRecordsListProps<TRow> {
  type: SettingsRecordType
  rows: TRow[]
  columns: SettingsListColumn<TRow>[]
  getRowId: (row: TRow) => string
  storageKey: string

  search: string
  searchPlaceholder: string
  onSearchChange: (value: string) => void

  queueTabs: DataListQueueTab[]
  activeQueue: string
  onQueueChange: (key: string) => void

  filters?: ReactNode
  appliedFilterCount?: number
  onResetFilters?: () => void

  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  selectionActions?: ReactNode

  /** Constructive first; destructive ones are moved to the overflow. */
  getRowActions: (row: TRow) => SettingsRowAction[]
  onOpenAction: (selection: SettingsActionSelection) => void
  onOpenDetail: (row: TRow) => void
  onOpenAudit?: (row: TRow) => void
  canReadAudit?: boolean
  isSubmitting?: boolean

  pagination: DataListPagination
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  toolbarActions?: ReactNode
  emptyMessage: string
}

interface RowActionsProps<TRow> {
  row: TRow
  actions: SettingsRowAction[]
  canReadAudit: boolean
  isSubmitting: boolean
  onOpenAction: (selection: SettingsActionSelection) => void
  onOpenDetail: (row: TRow) => void
  onOpenAudit?: (row: TRow) => void
}

function RowActions<TRow>({
  actions,
  canReadAudit,
  isSubmitting,
  onOpenAction,
  onOpenAudit,
  onOpenDetail,
  row,
}: RowActionsProps<TRow>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const primary = actions.find((action) => !action.destructive)
  const overflow = actions.filter((action) => action !== primary)
  const hasOverflow = overflow.length > 0 || Boolean(canReadAudit && onOpenAudit)

  return (
    <div ref={containerRef} className="relative flex items-center justify-end gap-1">
      {primary ? (
        <Button
          className="h-6.5 min-h-0 whitespace-nowrap px-2 text-xs font-medium"
          disabled={isSubmitting}
          size="xs"
          title={primary.label}
          type="button"
          variant="secondary"
          onClick={() => onOpenAction(primary.action)}
        >
          {primary.kind === 'edit' ? (
            <Edit3 className="mr-1 size-3" />
          ) : (
            <Power className="mr-1 size-3" />
          )}
          {primary.label}
        </Button>
      ) : null}

      {hasOverflow ? (
        <>
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="More actions"
            className="inline-flex size-6.5 shrink-0 items-center justify-center rounded-[0.4rem] text-muted transition hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <MoreHorizontal className="size-3.5" />
          </button>

          {open ? (
            <div
              className="absolute right-0 top-8 z-40 min-w-[11rem] rounded-[0.6rem] border border-border bg-surface p-1 shadow-lg"
              role="menu"
            >
              <button
                className="flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted"
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false)
                  onOpenDetail(row)
                }}
              >
                <ExternalLink className="size-3.5" />
                Open detail
              </button>

              {canReadAudit && onOpenAudit ? (
                <button
                  className="flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onOpenAudit(row)
                  }}
                >
                  <History className="size-3.5" />
                  Audit history
                </button>
              ) : null}

              {overflow.map((action) => (
                <button
                  className={cn(
                    'flex w-full items-center gap-2 rounded-[0.45rem] px-2 py-1.5 text-left text-sm transition hover:bg-surface-muted',
                    action.destructive && 'text-danger hover:bg-danger/10',
                  )}
                  disabled={isSubmitting}
                  key={action.label}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onOpenAction(action.action)
                  }}
                >
                  <Power className="size-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/**
 * Toolbar + grid for the three record-shaped settings workspaces (platform
 * settings, categories, zones). Policy rules keep their own workspace because
 * they are not row-shaped.
 */
export function SettingsRecordsList<TRow>({
  activeQueue,
  appliedFilterCount = 0,
  canReadAudit = false,
  columns,
  emptyMessage,
  filters,
  getRowActions,
  getRowId,
  isError = false,
  isLoading = false,
  isSubmitting = false,
  onOpenAction,
  onOpenAudit,
  onOpenDetail,
  onQueueChange,
  onResetFilters,
  onRetry,
  onSearchChange,
  onSelectionChange,
  pagination,
  queueTabs,
  rows,
  search,
  searchPlaceholder,
  selectedIds,
  selectionActions,
  storageKey,
  toolbarActions,
  type,
}: SettingsRecordsListProps<TRow>) {
  /**
   * The first column identifies the record so it grows and never drops; the
   * next two are priority 2; everything after is dropped first when space runs
   * short.
   */
  const dataListColumns = useMemo<DataListColumn<TRow>[]>(
    () =>
      columns.map((column, index) => ({
        id: column.id,
        label: column.label,
        defaultWidth: index === 0 ? 260 : Math.max(column.minWidth * 0.6, 96),
        minWidth: index === 0 ? 190 : Math.max(column.minWidth * 0.5, 84),
        priority: index === 0 ? 1 : index < 3 ? 2 : index < 5 ? 3 : 4,
        grow: index === 0,
        locked: index === 0,
        // The settings column renders were written for tall rows and stack
        // several lines. Clip them to the row box so they cannot collide with
        // the rows above and below; the first line stays readable.
        render: (row: TRow) => (
          <div className="flex h-full min-w-0 items-center overflow-hidden [&_p]:truncate">
            <div className="min-w-0">{column.render(row, type)}</div>
          </div>
        ),
      })),
    [columns, type],
  )

  return (
    <DataList
      activeQueue={activeQueue}
      appliedFilterCount={appliedFilterCount}
      columns={dataListColumns}
      emptyHint="Try a different search term or switch workspace."
      emptyMessage={emptyMessage}
      errorMessage="Could not load settings records."
      filters={filters}
      getRowId={getRowId}
      isError={isError}
      isLoading={isLoading}
      pagination={pagination}
      queueTabs={queueTabs}
      rowActions={(row) => (
        <RowActions
          actions={getRowActions(row)}
          canReadAudit={canReadAudit}
          isSubmitting={isSubmitting}
          row={row}
          onOpenAction={onOpenAction}
          onOpenAudit={onOpenAudit}
          onOpenDetail={onOpenDetail}
        />
      )}
      rowActionsWidth={132}
      rows={rows}
      search={search}
      searchPlaceholder={searchPlaceholder}
      selection={{
        selectedIds,
        onSelectionChange,
        actions: selectionActions,
      }}
      storageKey={storageKey}
      toolbarActions={toolbarActions}
      onQueueChange={onQueueChange}
      onResetFilters={onResetFilters}
      onRetry={onRetry}
      onRowClick={onOpenDetail}
      onSearchChange={onSearchChange}
    />
  )
}
