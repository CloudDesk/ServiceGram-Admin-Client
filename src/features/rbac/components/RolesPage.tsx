import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Plus,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
} from 'lucide-react'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { ListHeaderSearch } from '../../../components/ui/ListHeaderSearch'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../services/rbac.service'
import type { RoleSummary } from '../types/rbac.types'

const ROLE_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.roles.columnWidths.v1'
const ROLE_DEFAULT_COLUMN_WIDTH = 220
const ROLE_GRID_COLUMN_GAP = 12
const ROLE_GRID_INLINE_PADDING = 24
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
        <p className="mt-1 truncate text-xs text-muted">{role.roleId}</p>
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
    minWidth: 300,
    render: (role) => (
      <p className="line-clamp-2 text-sm text-foreground">
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
  return roleColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getRoleColumnWidth(columnWidths, column.id)}px`)
    .join(' ')
}

function getRoleGridMinWidth(
  visibleColumns: RoleColumnId[],
  columnWidths: RoleColumnWidths,
) {
  const gridGapWidth = Math.max(visibleColumns.length - 1, 0) * ROLE_GRID_COLUMN_GAP
  const visibleWidth = roleColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce((total, column) => total + getRoleColumnWidth(columnWidths, column.id), 0)

  return `${visibleWidth + gridGapWidth + ROLE_GRID_INLINE_PADDING}px`
}

function MetricCard({
  icon,
  label,
  meta,
  value,
}: {
  icon: ReactNode
  label: string
  meta: string
  value: ReactNode
}) {
  return (
    <div className="min-h-[4.35rem] rounded-[0.75rem] border border-border bg-surface p-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-normal text-foreground">
        {value}
      </div>
      <p className="mt-0.5 text-xs leading-4 text-muted">{meta}</p>
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
  onOpenDetail,
  role,
  visibleColumns,
}: {
  onOpenDetail: (role: RoleSummary) => void
  role: RoleSummary
  visibleColumns: RoleColumnId[]
}) {
  const visibleColumnDefinitions = roleColumns.filter((column) =>
    visibleColumns.includes(column.id),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail(role)
    }
  }

  return (
    <div
      className="grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--role-grid-template)] xl:items-center"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(role)}
      onKeyDown={handleKeyDown}
    >
      {visibleColumnDefinitions.map((column) => (
        <div className="min-w-0" key={column.id}>
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
            {column.label}
          </p>
          {column.render(role)}
        </div>
      ))}
    </div>
  )
}

export function RolesPage() {
  const navigate = useNavigate()
  const can = useAuthStore((state) => state.can)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<RoleTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<RoleStatusFilter>('all')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
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
  const filteredRoles = useMemo(
    () =>
      roles.filter(
        (role) =>
          roleMatchesSearch(role, search) &&
          roleMatchesType(role, typeFilter) &&
          roleMatchesStatus(role, statusFilter),
      ),
    [roles, search, statusFilter, typeFilter],
  )
  const canCreateRoles = can('roles:create')
  const isInitialLoading = rolesQuery.isLoading && roles.length === 0
  const isRefreshing = rolesQuery.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing...'
    : formatRefreshTime(rolesQuery.dataUpdatedAt)
  const hasActiveFilters =
    Boolean(search) || typeFilter !== 'all' || statusFilter !== 'all'
  const activeRoles = roles.filter((role) => role.isActive).length
  const customRoles = roles.filter((role) => !role.isSystem).length
  const permissionTotal = roles.reduce(
    (total, role) => total + role.permissionCount,
    0,
  )
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

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const openDetail = (role: RoleSummary) => {
    navigate(`${routePaths.roles}/${role.roleId}`)
  }

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage admin role access across platform modules."
        placement="topbar"
        title="Roles"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<KeyRound className="size-4 text-primary" />}
            label="Total roles"
            meta="Loaded catalogue"
            value={roles.length}
          />
          <MetricCard
            icon={<ToggleLeft className="size-4 text-success" />}
            label="Active roles"
            meta="Loaded catalogue"
            value={activeRoles}
          />
          <MetricCard
            icon={<ShieldCheck className="size-4 text-info" />}
            label="Custom roles"
            meta="Editable role family"
            value={customRoles}
          />
          <MetricCard
            icon={<ShieldCheck className="size-4 text-warning" />}
            label="Permissions"
            meta="Assigned across roles"
            value={permissionTotal}
          />
        </section>

        <section
          className={cn(
            'grid min-h-[calc(100vh-15rem)] flex-1 gap-3 transition-[grid-template-columns] xl:min-h-0',
            filtersCollapsed
              ? 'xl:grid-cols-[3rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[18rem_minmax(0,1fr)]',
          )}
        >
          <aside
            className={cn(
              'flex min-h-0 flex-col overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface',
              filtersCollapsed && 'items-center',
            )}
          >
            {filtersCollapsed ? (
              <button
                aria-label="Expand role filters"
                className="mt-3 inline-flex size-9 items-center justify-center rounded-[0.65rem] text-muted transition hover:bg-surface-muted hover:text-foreground"
                title="Expand filters"
                type="button"
                onClick={() => setFiltersCollapsed(false)}
              >
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Role filters
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      Filters apply to the loaded role catalogue.
                    </p>
                  </div>
                  <button
                    aria-label="Collapse role filters"
                    className="btn-icon"
                    title="Collapse filters"
                    type="button"
                    onClick={() => setFiltersCollapsed(true)}
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Filter stack
                    </h3>
                    {hasActiveFilters ? (
                      <button
                        className="text-xs font-semibold text-primary"
                        type="button"
                        onClick={clearFilters}
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-3">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Role type
                      </span>
                      <select
                        className="form-input"
                        value={typeFilter}
                        onChange={(event) =>
                          setTypeFilter(event.target.value as RoleTypeFilter)
                        }
                      >
                        <option value="all">All</option>
                        <option value="system">System</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Status
                      </span>
                      <select
                        className="form-input"
                        value={statusFilter}
                        onChange={(event) =>
                          setStatusFilter(event.target.value as RoleStatusFilter)
                        }
                      >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </aside>

          <main className="flex min-w-0 flex-col self-stretch overflow-hidden rounded-[0.875rem] border border-border bg-surface shadow-surface xl:min-h-0">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Role catalogue
                </h2>
                <p className="text-sm text-muted">
                  {filteredRoles.length} visible · {roles.length} loaded
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search role, code, description"
                  value={search}
                  onChange={setSearch}
                />
                {canCreateRoles ? (
                  <Link to={`${routePaths.roles}/new`}>
                    <Button size="sm" type="button" variant="secondary">
                      <Plus className="mr-2 size-4" />
                      Role
                    </Button>
                  </Link>
                ) : null}
                <span
                  className={cn(
                    'text-xs font-medium',
                    isRefreshing ? 'text-primary' : 'text-muted',
                  )}
                >
                  {refreshStatusLabel}
                </span>
                <div className="relative" ref={columnsMenuRef}>
                  <Button
                    aria-expanded={columnsOpen}
                    aria-haspopup="menu"
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
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-60 rounded-[0.875rem] border border-border bg-surface p-2 shadow-surface"
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
                  <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--role-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
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
                  </div>

                  <div>
                    {filteredRoles.map((role) => (
                      <RoleRow
                        key={role.roleId}
                        role={role}
                        visibleColumns={visibleColumns}
                        onOpenDetail={openDetail}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </main>
        </section>
      </div>
    </PageContainer>
  )
}
