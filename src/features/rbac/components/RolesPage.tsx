import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Filter,
  Lock,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import {
  LIST_SELECTION_COLUMN_WIDTH,
  ListSelectionCheckbox,
  ListSelectionToolbar,
} from '../../../components/ui/ListSelection'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useListSelection } from '../../../hooks/useListSelection'
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../services/rbac.service'
import type { RoleSummary } from '../types/rbac.types'

const ROLE_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.roles.columnWidths.v1'
const ROLE_DEFAULT_COLUMN_WIDTH = 220
const ROLE_GRID_COLUMN_GAP = 12
const ROLE_GRID_INLINE_PADDING = 24
const ROLE_ACTION_COLUMN_WIDTH = 228
const emptyRoles: RoleSummary[] = []

type RoleColumnId =
  | 'role'
  | 'type'
  | 'status'
  | 'permissions'
  | 'description'
  | 'updatedAt'
type RoleColumnWidths = Record<RoleColumnId, number>
type RoleTypeFilter = 'all' | 'system' | 'custom'
type RoleStatusFilter = 'all' | 'active' | 'inactive'
type RoleQueueKey = 'all' | 'active' | 'inactive' | 'system' | 'custom'

interface RoleGridStyle extends CSSProperties {
  '--role-grid-template': string
  '--role-grid-min-width': string
}

interface RoleColumn {
  id: RoleColumnId
  label: string
  minWidth: number
  render: (role: RoleSummary) => ReactNode
}

const roleColumns: RoleColumn[] = [
  {
    id: 'role',
    label: 'Role',
    minWidth: 260,
    render: (role) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{role.roleName}</p>
        <p className="break-words text-xs text-muted">{role.roleCode}</p>
      </div>
    ),
  },
  {
    id: 'type',
    label: 'Type',
    minWidth: 140,
    render: (role) => (
      <Badge tone={role.isSystem ? 'info' : 'neutral'}>
        {role.isSystem ? 'System' : 'Custom'}
      </Badge>
    ),
  },
  {
    id: 'status',
    label: 'Status',
    minWidth: 140,
    render: (role) => (
      <Badge tone={role.isActive ? 'success' : 'danger'}>
        {role.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    id: 'permissions',
    label: 'Permissions',
    minWidth: 160,
    render: (role) => (
      <div>
        <p className="font-semibold text-foreground">{role.permissionCount}</p>
        <p className="text-xs text-muted">Assigned permissions</p>
      </div>
    ),
  },
  {
    id: 'description',
    label: 'Description',
    minWidth: 260,
    render: (role) => (
      <p className="line-clamp-1 text-sm text-foreground">
        {role.description || <span className="text-muted">Not available</span>}
      </p>
    ),
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    minWidth: 180,
    render: (role) => (
      <div>
        <p className="font-medium text-foreground">{formatDate(role.updatedAt, true)}</p>
        <p className="text-xs text-muted">Created {formatDate(role.createdAt, true)}</p>
      </div>
    ),
  },
]

const defaultVisibleColumns = roleColumns.map((column) => column.id)
const defaultRoleColumnWidths = Object.fromEntries(
  roleColumns.map((column) => [
    column.id,
    Math.max(column.minWidth, ROLE_DEFAULT_COLUMN_WIDTH),
  ]),
) as RoleColumnWidths

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function roleMatchesSearch(role: RoleSummary, search: string) {
  const term = search.trim().toLowerCase()
  if (!term) return true

  return [
    role.roleName,
    role.roleCode,
    role.description,
    role.roleId,
  ].some((value) => (value ?? '').toLowerCase().includes(term))
}

function roleMatchesType(role: RoleSummary, typeFilter: RoleTypeFilter) {
  if (typeFilter === 'all') return true
  if (typeFilter === 'system') return role.isSystem
  return !role.isSystem
}

function roleMatchesStatus(role: RoleSummary, statusFilter: RoleStatusFilter) {
  if (statusFilter === 'all') return true
  if (statusFilter === 'active') return role.isActive
  return !role.isActive
}

function readRoleTypeFilter(searchParams: URLSearchParams): RoleTypeFilter {
  const type = searchParams.get('type')

  return type === 'system' || type === 'custom' ? type : 'all'
}

function readRoleStatusFilter(searchParams: URLSearchParams): RoleStatusFilter {
  const status = searchParams.get('status')

  return status === 'active' || status === 'inactive' ? status : 'all'
}

function getRoleColumnMinWidth(columnId: RoleColumnId) {
  return (
    roleColumns.find((column) => column.id === columnId)?.minWidth ??
    ROLE_DEFAULT_COLUMN_WIDTH
  )
}

function getRoleColumnWidth(widths: RoleColumnWidths, columnId: RoleColumnId) {
  return Math.max(getRoleColumnMinWidth(columnId), widths[columnId])
}

function normalizeRoleColumnWidths(value: unknown): RoleColumnWidths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultRoleColumnWidths
  }

  const record = value as Record<string, unknown>
  const widths = { ...defaultRoleColumnWidths }

  roleColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  return widths
}

function loadRoleColumnWidths() {
  if (typeof window === 'undefined') return defaultRoleColumnWidths

  try {
    return normalizeRoleColumnWidths(
      JSON.parse(window.localStorage.getItem(ROLE_COLUMN_WIDTH_STORAGE_KEY) ?? 'null'),
    )
  } catch {
    return defaultRoleColumnWidths
  }
}

function getRoleGridTemplate(
  visibleColumns: RoleColumnId[],
  columnWidths: RoleColumnWidths,
) {
  const selectedWidths = roleColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getRoleColumnWidth(columnWidths, column.id)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${ROLE_ACTION_COLUMN_WIDTH}px`,
  ].join(' ')
}

function getRoleGridMinWidth(
  visibleColumns: RoleColumnId[],
  columnWidths: RoleColumnWidths,
) {
  const gridColumnCount = visibleColumns.length + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * ROLE_GRID_COLUMN_GAP
  const visibleWidth = roleColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce((total, column) => total + getRoleColumnWidth(columnWidths, column.id), 0)

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    ROLE_ACTION_COLUMN_WIDTH +
    gridGapWidth +
    ROLE_GRID_INLINE_PADDING
  }px`
}

function ActiveFilterChips({
  chips,
  onClearAll,
}: {
  chips: { key: string; label: string; onClear: () => void }[]
  onClearAll: () => void
}) {
  if (chips.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs font-medium text-foreground transition hover:bg-surface-muted"
          key={chip.key}
          type="button"
          onClick={chip.onClear}
        >
          <span>{chip.label}</span>
          <X className="size-3.5 text-muted" />
        </button>
      ))}
      <button
        className="h-8 px-2 text-xs font-semibold text-primary"
        type="button"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  )
}

function RoleRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-20 w-full rounded-[1rem]" key={index} />
      ))}
    </div>
  )
}

function RoleRow({
  isSelected,
  canManagePermissions,
  onOpenDetail,
  onOpenPermissions,
  onSelect,
  role,
  visibleColumns,
}: {
  isSelected: boolean
  canManagePermissions: boolean
  onOpenDetail: (role: RoleSummary) => void
  onOpenPermissions: (role: RoleSummary) => void
  onSelect: (role: RoleSummary, selected: boolean) => void
  role: RoleSummary
  visibleColumns: RoleColumnId[]
}) {
  const visibleColumnDefinitions = roleColumns.filter((column) =>
    visibleColumns.includes(column.id),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail(role)
    }
  }

  return (
    <div
      aria-selected={isSelected}
      className={cn(
        'workbench-grid-row grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--role-grid-template)] xl:items-center',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(role)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${role.roleName}`}
          onChange={(selected) => onSelect(role, selected)}
        />
      </div>
      {visibleColumnDefinitions.map((column) => (
        <div className="min-w-0" key={column.id}>
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
            {column.label}
          </p>
          {column.render(role)}
        </div>
      ))}
      <div
        className="workbench-sticky-action-cell flex min-w-0 flex-wrap items-center gap-2 pl-2 xl:justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onOpenDetail(role)}
        >
          <ArrowUpRight className="mr-2 size-4" />
          Open
        </Button>
        {canManagePermissions && !role.isSystem ? (
          <Button
            size="sm"
            type="button"
            onClick={() => onOpenPermissions(role)}
          >
            <ShieldCheck className="mr-2 size-4" />
            Permissions
          </Button>
        ) : role.isSystem ? (
          <Badge tone="info">
            <Lock className="mr-1.5 size-3.5" />
            Locked
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

export function RolesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const can = useAuthStore((state) => state.can)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [typeFilter, setTypeFilter] = useState<RoleTypeFilter>(() =>
    readRoleTypeFilter(searchParams),
  )
  const [statusFilter, setStatusFilter] = useState<RoleStatusFilter>(() =>
    readRoleStatusFilter(searchParams),
  )
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<RoleColumnId[]>(defaultVisibleColumns)
  const [columnWidths, setColumnWidths] =
    useState<RoleColumnWidths>(loadRoleColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ROLE_COLUMN_WIDTH_STORAGE_KEY,
        JSON.stringify(columnWidths),
      )
    } catch {
      // Width persistence is optional.
    }
  }, [columnWidths])

  useEffect(() => {
    if (!columnsOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (target instanceof Node && columnsMenuRef.current?.contains(target)) {
        return
      }

      setColumnsOpen(false)
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setColumnsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [columnsOpen])

  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })

  const roles = rolesQuery.data?.data ?? emptyRoles
  const baseRoles = useMemo(
    () => roles.filter((role) => roleMatchesSearch(role, search)),
    [roles, search],
  )
  const filteredRoles = useMemo(
    () =>
      baseRoles.filter(
        (role) =>
          roleMatchesType(role, typeFilter) &&
          roleMatchesStatus(role, statusFilter),
      ),
    [baseRoles, statusFilter, typeFilter],
  )
  const roleSelection = useListSelection(filteredRoles, (role) => role.roleId)
  const canCreateRoles = can('roles:create')
  const canManagePermissions =
    can('roles:manage_permissions') && can('permissions:read')
  const isInitialLoading = rolesQuery.isLoading && roles.length === 0
  const isRefreshing = rolesQuery.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(rolesQuery.dataUpdatedAt)
  const hasActiveFilters =
    Boolean(search) || typeFilter !== 'all' || statusFilter !== 'all'
  const activeQueueKey: RoleQueueKey | null =
    statusFilter === 'active' && typeFilter === 'all'
      ? 'active'
      : statusFilter === 'inactive' && typeFilter === 'all'
        ? 'inactive'
        : typeFilter === 'system' && statusFilter === 'all'
          ? 'system'
          : typeFilter === 'custom' && statusFilter === 'all'
            ? 'custom'
            : typeFilter === 'all' && statusFilter === 'all'
              ? 'all'
              : null
  const queueItems = useMemo(
    () => [
      { count: baseRoles.length, key: 'all' as const, label: 'All roles' },
      {
        count: baseRoles.filter((role) => role.isActive).length,
        key: 'active' as const,
        label: 'Active',
      },
      {
        count: baseRoles.filter((role) => !role.isActive).length,
        key: 'inactive' as const,
        label: 'Inactive',
      },
      {
        count: baseRoles.filter((role) => role.isSystem).length,
        key: 'system' as const,
        label: 'System',
      },
      {
        count: baseRoles.filter((role) => !role.isSystem).length,
        key: 'custom' as const,
        label: 'Custom',
      },
    ],
    [baseRoles],
  )
  const activeFilterChips = [
    typeFilter !== 'all'
      ? {
          key: 'type',
          label: `Type: ${typeFilter === 'system' ? 'System' : 'Custom'}`,
          onClear: () => setTypeFilter('all'),
        }
      : null,
    statusFilter !== 'all'
      ? {
          key: 'status',
          label: `Status: ${statusFilter === 'active' ? 'Active' : 'Inactive'}`,
          onClear: () => setStatusFilter('all'),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[]
  const visibleSummary = `${filteredRoles.length} visible · ${roles.length} loaded`
  const roleCountLabel =
    rolesQuery.isLoading && roles.length === 0 ? '...' : String(roles.length)
  const selectedQueueLabel =
    activeQueueKey && activeQueueKey !== 'all'
      ? queueItems.find((queue) => queue.key === activeQueueKey)?.label
      : null
  const appliedContextLabel = [
    selectedQueueLabel ? `Queue: ${selectedQueueLabel}` : null,
    search.trim() ? `Search: ${search.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const clearableFilterChips = [
    ...activeFilterChips,
    search.trim()
      ? {
          key: 'search',
          label: `Search: ${search.trim()}`,
          onClear: () => setSearch(''),
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[]
  const roleGridStyle = useMemo<RoleGridStyle>(
    () => ({
      '--role-grid-template': getRoleGridTemplate(visibleColumns, columnWidths),
      '--role-grid-min-width': getRoleGridMinWidth(visibleColumns, columnWidths),
    }),
    [columnWidths, visibleColumns],
  )

  const startColumnResize = (
    columnId: RoleColumnId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getRoleColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getRoleColumnMinWidth(columnId),
          Math.round(nextWidth),
        ),
      }))
    }

    const stopResize = () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', stopResize)
      document.removeEventListener('pointercancel', stopResize)
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', stopResize)
    document.addEventListener('pointercancel', stopResize)
  }

  const adjustColumnWidth = (columnId: RoleColumnId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getRoleColumnMinWidth(columnId),
        getRoleColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetColumnWidth = (columnId: RoleColumnId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: defaultRoleColumnWidths[columnId],
    }))
  }

  const toggleColumn = (columnId: RoleColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        return currentColumns.length === 1
          ? currentColumns
          : currentColumns.filter((item) => item !== columnId)
      }

      return roleColumns
        .map((column) => column.id)
        .filter((item) => currentColumns.includes(item) || item === columnId)
    })
  }

  const clearSeededListParams = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('search')
        next.delete('type')
        next.delete('status')

        return next
      },
      { replace: true },
    )
  }

  const clearFilters = () => {
    clearSeededListParams()
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const applyQueue = (queueKey: RoleQueueKey) => {
    clearSeededListParams()

    if (queueKey === 'active') {
      setTypeFilter('all')
      setStatusFilter('active')
      return
    }

    if (queueKey === 'inactive') {
      setTypeFilter('all')
      setStatusFilter('inactive')
      return
    }

    if (queueKey === 'system') {
      setTypeFilter('system')
      setStatusFilter('all')
      return
    }

    if (queueKey === 'custom') {
      setTypeFilter('custom')
      setStatusFilter('all')
      return
    }

    setTypeFilter('all')
    setStatusFilter('all')
  }

  const openDetail = (role: RoleSummary) => {
    navigate(`${routePaths.roles}/${role.roleId}`)
  }

  const openPermissions = (role: RoleSummary) => {
    navigate(`${routePaths.roles}/${role.roleId}#role-permissions`)
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Roles"
      />

      <main
        className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1"
        id="roles-records"
      >
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(9rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Roles</h2>
              <span
                className={cn(
                  'rounded-full border border-border bg-surface-muted/65 px-2 py-0.5 text-xs font-medium',
                  isRefreshing ? 'text-primary' : 'text-muted',
                )}
              >
                {refreshStatusLabel}
              </span>
            </div>

            <ListHeaderSearch
              className="w-full min-w-0"
              placeholder="Search roles..."
              value={search}
              onChange={(nextSearch) => {
                clearSeededListParams()
                setSearch(nextSearch)
              }}
            />

            <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
              <Button
                aria-expanded={filtersOpen}
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter className="mr-2 size-4" />
                Filters
                {hasActiveFilters ? (
                  <span className="ml-1 size-2 rounded-full bg-primary" />
                ) : null}
              </Button>
              {canCreateRoles ? (
                <Link to={`${routePaths.roles}/new`}>
                  <Button size="sm" type="button" variant="secondary">
                    <Plus className="mr-2 size-4" />
                    Role
                  </Button>
                </Link>
              ) : null}
              <div className="relative" ref={columnsMenuRef}>
                <Button
                  aria-expanded={columnsOpen}
                  aria-haspopup="menu"
                  className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setColumnsOpen((current) => !current)}
                >
                  <SlidersHorizontal className="mr-2 size-4" />
                  Columns
                  {visibleColumns.length ? (
                    <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-xs text-primary">
                      {visibleColumns.length}
                    </span>
                  ) : null}
                </Button>

                {columnsOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
                    role="menu"
                  >
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-normal text-muted">
                      Visible columns
                    </p>
                    {roleColumns.map((column) => {
                      const isChecked = visibleColumns.includes(column.id)
                      const isRequiredLastColumn =
                        isChecked && visibleColumns.length === 1

                      return (
                        <label
                          className={cn(
                            'flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.65rem] px-2 text-sm text-foreground hover:bg-surface-muted',
                            isRequiredLastColumn && 'cursor-not-allowed opacity-60',
                          )}
                          key={column.id}
                        >
                          <input
                            checked={isChecked}
                            className="size-4 accent-[color:var(--adaptive-primary)]"
                            disabled={isRequiredLastColumn}
                            type="checkbox"
                            onChange={() => toggleColumn(column.id)}
                          />
                          <span>{column.label}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <Button
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => void rolesQuery.refetch()}
              >
                <RefreshCcw
                  className={cn(
                    'mr-2 size-4',
                    isRefreshing && 'animate-spin motion-reduce:animate-none',
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto rounded-[0.875rem] border border-border bg-surface-muted/40 p-1">
            {queueItems.map((queue) => {
              const isActive = activeQueueKey === queue.key

              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-2 rounded-[0.65rem] border px-2.5 text-sm font-medium transition',
                    isActive
                      ? 'border-primary/30 bg-surface text-primary shadow-[var(--sg-shadow-surface)]'
                      : 'border-transparent text-muted hover:bg-surface hover:text-foreground',
                  )}
                  key={queue.key}
                  type="button"
                  onClick={() => applyQueue(queue.key)}
                >
                  <span>{queue.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-surface text-muted',
                    )}
                  >
                    {queue.count}
                  </span>
                </button>
              )
            })}
          </div>

          <ActiveFilterChips chips={clearableFilterChips} onClearAll={clearFilters} />

          {filtersOpen ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_auto] lg:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Role type</span>
                  <select
                    className="form-input min-h-10"
                    value={typeFilter}
                    onChange={(event) => {
                      clearSeededListParams()
                      setTypeFilter(event.target.value as RoleTypeFilter)
                    }}
                  >
                    <option value="all">All</option>
                    <option value="system">System</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Status</span>
                  <select
                    className="form-input min-h-10"
                    value={statusFilter}
                    onChange={(event) => {
                      clearSeededListParams()
                      setStatusFilter(event.target.value as RoleStatusFilter)
                    }}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <Button
                  className="min-h-10"
                  disabled={!hasActiveFilters}
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={clearFilters}
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{visibleSummary}</span>
            <span>{appliedContextLabel || `${roleCountLabel} roles in catalogue`}</span>
          </div>
        </div>

            {rolesQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description={
                    rolesQuery.error instanceof Error
                      ? rolesQuery.error.message
                      : 'We could not load roles. Please retry.'
                  }
                  title="Roles unavailable"
                  onRetry={() => void rolesQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <RoleRowsSkeleton />
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description="No roles matched the selected filters."
                  title="No roles"
                />
              </div>
            ) : (
              <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                <div
                  className="min-w-0 xl:min-w-[var(--role-grid-min-width)]"
                  style={roleGridStyle}
                >
                  <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--role-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                    <div className="flex min-w-0 items-center">
                      <ListSelectionCheckbox
                        checked={roleSelection.allVisibleSelected}
                        indeterminate={roleSelection.someVisibleSelected}
                        label="Select visible roles"
                        onChange={roleSelection.setVisibleSelected}
                      />
                    </div>
                    {roleColumns
                      .filter((column) => visibleColumns.includes(column.id))
                      .map((column) => (
                        <div
                          className="relative flex min-w-0 items-center pr-3"
                          key={column.id}
                        >
                          <span className="truncate">{column.label}</span>
                          <button
                            aria-label={`Resize ${column.label} column`}
                            className="group absolute inset-y-0 right-0 flex w-3 cursor-col-resize items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Drag to resize"
                            type="button"
                            onDoubleClick={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              resetColumnWidth(column.id)
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'ArrowLeft') {
                                event.preventDefault()
                                adjustColumnWidth(column.id, -16)
                              }

                              if (event.key === 'ArrowRight') {
                                event.preventDefault()
                                adjustColumnWidth(column.id, 16)
                              }
                            }}
                            onPointerDown={(event) =>
                              startColumnResize(column.id, event)
                            }
                          >
                            <span className="h-4 w-px rounded-full bg-border transition group-hover:bg-primary group-focus-visible:bg-primary" />
                          </button>
                        </div>
                      ))}
                    <div className="workbench-sticky-action-head flex min-w-0 pr-3">
                      <span className="truncate">Actions</span>
                    </div>
                  </div>
                  <ListSelectionToolbar
                    allVisibleSelected={roleSelection.allVisibleSelected}
                    selectedCount={roleSelection.selectedCount}
                    visibleCount={roleSelection.visibleCount}
                    onClear={roleSelection.clearSelection}
                    onSelectVisible={() => roleSelection.setVisibleSelected(true)}
                  />

                  <div>
                    {filteredRoles.map((role) => (
                      <RoleRow
                        canManagePermissions={canManagePermissions}
                        isSelected={roleSelection.isSelected(role.roleId)}
                        key={role.roleId}
                        role={role}
                        visibleColumns={visibleColumns}
                        onOpenDetail={openDetail}
                        onOpenPermissions={openPermissions}
                        onSelect={(selectedRole, selected) =>
                          roleSelection.setItemSelected(selectedRole.roleId, selected)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
      </main>
    </PageContainer>
  )
}
