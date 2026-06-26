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
  Plus,
  RefreshCcw,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
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
import { cn } from '../../../utils/cn'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../../rbac/services/rbac.service'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUser,
  AdminUsersPagination,
  AdminUsersQueryParams,
  AdminUserStatus,
} from '../types/adminUser.types'

const DEFAULT_PAGE_SIZE = 10
const ADMIN_USER_COLUMN_WIDTH_STORAGE_KEY = 'servicegram.adminUsers.columnWidths.v1'
const ADMIN_USER_DEFAULT_COLUMN_WIDTH = 220
const ADMIN_USER_GRID_COLUMN_GAP = 12
const ADMIN_USER_GRID_INLINE_PADDING = 24
const emptyUsers: AdminUser[] = []

type AdminUserColumnId =
  | 'user'
  | 'role'
  | 'adminStatus'
  | 'account'
  | 'security'
  | 'activity'
  | 'updatedAt'
type AdminUserColumnWidths = Record<AdminUserColumnId, number>

interface AdminUsersGridStyle extends CSSProperties {
  '--admin-user-grid-template': string
  '--admin-user-grid-min-width': string
}

interface AdminUserColumn {
  id: AdminUserColumnId
  label: string
  minWidth: number
  render: (user: AdminUser) => ReactNode
}

const adminUserColumns: AdminUserColumn[] = [
  {
    id: 'user',
    label: 'User',
    minWidth: 260,
    render: (user) => (
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{user.fullName}</p>
        <p className="truncate text-xs text-muted">{user.email ?? 'No email'}</p>
        <p className="mt-1 truncate text-xs text-muted">{user.adminId}</p>
      </div>
    ),
  },
  {
    id: 'role',
    label: 'Role',
    minWidth: 220,
    render: (user) => (
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {user.role?.roleName ?? 'Unassigned'}
        </p>
        <p className="truncate text-xs text-muted">
          {user.role?.roleCode ?? 'No role code'}
        </p>
        {user.role ? (
          <Badge tone={user.role.isSystem ? 'info' : 'neutral'}>
            {user.role.isSystem ? 'System' : 'Custom'}
          </Badge>
        ) : null}
      </div>
    ),
  },
  {
    id: 'adminStatus',
    label: 'Admin status',
    minWidth: 150,
    render: (user) => (
      <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
        {humanizeCode(user.status)}
      </Badge>
    ),
  },
  {
    id: 'account',
    label: 'Account',
    minWidth: 160,
    render: (user) => (
      <div>
        <Badge tone={user.userStatus === 'ACTIVE' ? 'success' : 'danger'}>
          {humanizeCode(user.userStatus)}
        </Badge>
        <p className="mt-1 text-xs text-muted">User account</p>
      </div>
    ),
  },
  {
    id: 'security',
    label: 'Security',
    minWidth: 170,
    render: (user) => (
      <div>
        <p className="font-semibold text-foreground">{user.permissionVersion}</p>
        <p className="text-xs text-muted">Permission version</p>
      </div>
    ),
  },
  {
    id: 'activity',
    label: 'Last login',
    minWidth: 190,
    render: (user) => (
      <div>
        <p className="font-medium text-foreground">
          {user.lastLoginAt ? formatDate(user.lastLoginAt, true) : 'Never'}
        </p>
        <p className="text-xs text-muted">Admin session</p>
      </div>
    ),
  },
  {
    id: 'updatedAt',
    label: 'Updated',
    minWidth: 180,
    render: (user) => (
      <div>
        <p className="font-medium text-foreground">
          {formatDate(user.updatedAt, true)}
        </p>
        <p className="text-xs text-muted">Created {formatDate(user.createdAt, true)}</p>
      </div>
    ),
  },
]

const defaultVisibleColumns = adminUserColumns.map((column) => column.id)
const defaultAdminUserColumnWidths = Object.fromEntries(
  adminUserColumns.map((column) => [
    column.id,
    Math.max(column.minWidth, ADMIN_USER_DEFAULT_COLUMN_WIDTH),
  ]),
) as AdminUserColumnWidths

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatRefreshTime(value: number) {
  if (!value) return 'Not refreshed yet'

  return `Last refreshed ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))}`
}

function getAdminUserColumnMinWidth(columnId: AdminUserColumnId) {
  return (
    adminUserColumns.find((column) => column.id === columnId)?.minWidth ??
    ADMIN_USER_DEFAULT_COLUMN_WIDTH
  )
}

function getAdminUserColumnWidth(
  widths: AdminUserColumnWidths,
  columnId: AdminUserColumnId,
) {
  return Math.max(getAdminUserColumnMinWidth(columnId), widths[columnId])
}

function normalizeAdminUserColumnWidths(value: unknown): AdminUserColumnWidths {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultAdminUserColumnWidths
  }

  const record = value as Record<string, unknown>
  const widths = { ...defaultAdminUserColumnWidths }

  adminUserColumns.forEach((column) => {
    const width = record[column.id]

    if (typeof width === 'number' && Number.isFinite(width)) {
      widths[column.id] = Math.max(column.minWidth, Math.round(width))
    }
  })

  return widths
}

function loadAdminUserColumnWidths() {
  if (typeof window === 'undefined') return defaultAdminUserColumnWidths

  try {
    return normalizeAdminUserColumnWidths(
      JSON.parse(
        window.localStorage.getItem(ADMIN_USER_COLUMN_WIDTH_STORAGE_KEY) ??
          'null',
      ),
    )
  } catch {
    return defaultAdminUserColumnWidths
  }
}

function getAdminUserGridTemplate(
  visibleColumns: AdminUserColumnId[],
  columnWidths: AdminUserColumnWidths,
) {
  return adminUserColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getAdminUserColumnWidth(columnWidths, column.id)}px`)
    .join(' ')
}

function getAdminUserGridMinWidth(
  visibleColumns: AdminUserColumnId[],
  columnWidths: AdminUserColumnWidths,
) {
  const gridGapWidth = Math.max(visibleColumns.length - 1, 0) * ADMIN_USER_GRID_COLUMN_GAP
  const visibleWidth = adminUserColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getAdminUserColumnWidth(columnWidths, column.id),
      0,
    )

  return `${visibleWidth + gridGapWidth + ADMIN_USER_GRID_INLINE_PADDING}px`
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

function AdminUserRowsSkeleton() {
  return (
    <div className="space-y-2.5 p-3">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton className="h-20 w-full rounded-[1rem]" key={index} />
      ))}
    </div>
  )
}

function AdminUsersPaginationControls({
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  onPageChange: (page: number) => void
  onPageSizeChange: (limit: number) => void
  pagination?: AdminUsersPagination
}) {
  if (!pagination) return null

  const start =
    pagination.totalItems === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1
  const end = Math.min(pagination.page * pagination.limit, pagination.totalItems)

  return (
    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface-muted px-3 py-2.5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing {start}-{end} of {pagination.totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            className="form-input h-9 w-20 py-1"
            value={pagination.limit}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 text-foreground">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-24 text-center text-sm font-medium">
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <button
          aria-label="Next page"
          className="btn-icon"
          disabled={!pagination.hasNextPage}
          type="button"
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

function AdminUserRow({
  onOpenDetail,
  user,
  visibleColumns,
}: {
  onOpenDetail: (user: AdminUser) => void
  user: AdminUser
  visibleColumns: AdminUserColumnId[]
}) {
  const visibleColumnDefinitions = adminUserColumns.filter((column) =>
    visibleColumns.includes(column.id),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail(user)
    }
  }

  return (
    <div
      className="grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--admin-user-grid-template)] xl:items-center"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(user)}
      onKeyDown={handleKeyDown}
    >
      {visibleColumnDefinitions.map((column) => (
        <div className="min-w-0" key={column.id}>
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
            {column.label}
          </p>
          {column.render(user)}
        </div>
      ))}
    </div>
  )
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'' | AdminUserStatus>('')
  const [roleId, setRoleId] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [visibleColumns, setVisibleColumns] =
    useState<AdminUserColumnId[]>(defaultVisibleColumns)
  const [columnWidths, setColumnWidths] =
    useState<AdminUserColumnWidths>(loadAdminUserColumnWidths)
  const columnsMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ADMIN_USER_COLUMN_WIDTH_STORAGE_KEY,
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

  const resetToFirstPage = () => setPage(1)
  const hasActiveFilters = Boolean(search || status || roleId)
  const query = useMemo<AdminUsersQueryParams>(
    () => ({
      page,
      limit,
      search: search.trim() || undefined,
      status: status || undefined,
      roleId: roleId || undefined,
    }),
    [limit, page, roleId, search, status],
  )

  const adminUsersQuery = useQuery({
    queryKey: ['admin-users', query],
    queryFn: () => adminUserService.getAdminUsers(query),
  })
  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })

  const users = adminUsersQuery.data?.data ?? emptyUsers
  const pagination = adminUsersQuery.data?.pagination
  const activeLoadedCount = users.filter((user) => user.status === 'ACTIVE').length
  const disabledLoadedCount = users.filter((user) => user.status === 'DISABLED').length
  const stalePermissionLoadedCount = users.filter(
    (user) => user.permissionVersion > 1,
  ).length
  const isInitialLoading = adminUsersQuery.isLoading && users.length === 0
  const isRefreshing = adminUsersQuery.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing...'
    : formatRefreshTime(adminUsersQuery.dataUpdatedAt)
  const adminUserGridStyle = useMemo<AdminUsersGridStyle>(
    () => ({
      '--admin-user-grid-template': getAdminUserGridTemplate(
        visibleColumns,
        columnWidths,
      ),
      '--admin-user-grid-min-width': getAdminUserGridMinWidth(
        visibleColumns,
        columnWidths,
      ),
    }),
    [columnWidths, visibleColumns],
  )

  const startColumnResize = (
    columnId: AdminUserColumnId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = getAdminUserColumnWidth(columnWidths, columnId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX

      setColumnWidths((currentWidths) => ({
        ...currentWidths,
        [columnId]: Math.max(
          getAdminUserColumnMinWidth(columnId),
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

  const adjustColumnWidth = (columnId: AdminUserColumnId, delta: number) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: Math.max(
        getAdminUserColumnMinWidth(columnId),
        getAdminUserColumnWidth(currentWidths, columnId) + delta,
      ),
    }))
  }

  const resetColumnWidth = (columnId: AdminUserColumnId) => {
    setColumnWidths((currentWidths) => ({
      ...currentWidths,
      [columnId]: defaultAdminUserColumnWidths[columnId],
    }))
  }

  const toggleColumn = (columnId: AdminUserColumnId) => {
    setVisibleColumns((currentColumns) => {
      if (currentColumns.includes(columnId)) {
        return currentColumns.length === 1
          ? currentColumns
          : currentColumns.filter((item) => item !== columnId)
      }

      return adminUserColumns
        .map((column) => column.id)
        .filter((item) => currentColumns.includes(item) || item === columnId)
    })
  }

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setRoleId('')
    setPage(1)
  }

  const openDetail = (user: AdminUser) => {
    navigate(`${routePaths.adminUsers}/${user.adminId}`)
  }

  return (
    <PageContainer>
      <PageContextHeader
        description="Manage admin access, status, and assigned roles."
        placement="topbar"
        title="Users"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <section className="grid shrink-0 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<UserRound className="size-4 text-primary" />}
            label="Total users"
            meta="Backend filtered"
            value={pagination?.totalItems ?? 0}
          />
          <MetricCard
            icon={<ShieldCheck className="size-4 text-success" />}
            label="Active loaded"
            meta="Current page"
            value={activeLoadedCount}
          />
          <MetricCard
            icon={<Shield className="size-4 text-danger" />}
            label="Disabled loaded"
            meta="Current page"
            value={disabledLoadedCount}
          />
          <MetricCard
            icon={<RefreshCcw className="size-4 text-info" />}
            label="Permission updates"
            meta="Loaded page"
            value={stalePermissionLoadedCount}
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
                aria-label="Expand admin user filters"
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
                      User filters
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      Backend filters for account access.
                    </p>
                  </div>
                  <button
                    aria-label="Collapse admin user filters"
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
                        Status
                      </span>
                      <select
                        className="form-input"
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value as '' | AdminUserStatus)
                          resetToFirstPage()
                        }}
                      >
                        <option value="">All</option>
                        <option value="ACTIVE">Active</option>
                        <option value="DISABLED">Disabled</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-muted">
                        Primary role
                      </span>
                      <select
                        className="form-input"
                        disabled={rolesQuery.isLoading || rolesQuery.isError}
                        value={roleId}
                        onChange={(event) => {
                          setRoleId(event.target.value)
                          resetToFirstPage()
                        }}
                      >
                        <option value="">All roles</option>
                        {(rolesQuery.data?.data ?? []).map((role) => (
                          <option key={role.roleId} value={role.roleId}>
                            {role.roleName}
                          </option>
                        ))}
                      </select>
                      {rolesQuery.isError ? (
                        <p className="text-xs text-danger">
                          Roles could not be loaded.
                        </p>
                      ) : null}
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
                  Admin users
                </h2>
                <p className="text-sm text-muted">
                  {pagination
                    ? `${pagination.totalItems} users · ${users.length} loaded`
                    : 'Search, filter, and manage admin accounts from backend data.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ListHeaderSearch
                  className="w-full sm:w-72 lg:w-80"
                  placeholder="Search name or email"
                  value={search}
                  onChange={(nextSearch) => {
                    setSearch(nextSearch)
                    resetToFirstPage()
                  }}
                />
                <Link to={`${routePaths.adminUsers}/new`}>
                  <Button size="sm" type="button" variant="secondary">
                    <Plus className="mr-2 size-4" />
                    User
                  </Button>
                </Link>
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
                      {adminUserColumns.map((column) => {
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
                  onClick={() => void adminUsersQuery.refetch()}
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

            {adminUsersQuery.isError ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <ErrorState
                  description="We could not load admin users. Please retry."
                  title="Admin users unavailable"
                  onRetry={() => void adminUsersQuery.refetch()}
                />
              </div>
            ) : isInitialLoading ? (
              <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <AdminUserRowsSkeleton />
              </div>
            ) : users.length === 0 ? (
              <div className="p-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
                <EmptyState
                  description="No admin users matched the selected filters."
                  title="No admin users"
                />
              </div>
            ) : (
              <div className="flex flex-col xl:min-h-0 xl:flex-1">
                <div className="overflow-x-auto xl:min-h-0 xl:flex-1 xl:overflow-auto">
                  <div
                    className="min-w-0 xl:min-w-[var(--admin-user-grid-min-width)]"
                    style={adminUserGridStyle}
                  >
                    <div className="sticky top-0 z-10 hidden gap-3 grid-cols-[var(--admin-user-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      {adminUserColumns
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
                      {users.map((user) => (
                        <AdminUserRow
                          key={user.adminId}
                          user={user}
                          visibleColumns={visibleColumns}
                          onOpenDetail={openDetail}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <AdminUsersPaginationControls
                  pagination={pagination}
                  onPageChange={setPage}
                  onPageSizeChange={(nextLimit) => {
                    setLimit(nextLimit)
                    setPage(1)
                  }}
                />
              </div>
            )}
          </main>
        </section>
      </div>
    </PageContainer>
  )
}
