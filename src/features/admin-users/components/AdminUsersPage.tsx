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
  ChevronLeft,
  ChevronRight,
  Edit3,
  Filter,
  Plus,
  RefreshCcw,
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
import { usePermission } from '../../../hooks/usePermission'
import { useListSelection } from '../../../hooks/useListSelection'
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
const ADMIN_USER_ACTION_COLUMN_WIDTH = 216
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
type AdminUserQueueKey = 'all' | 'active' | 'disabled'

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

function readAdminUserStatusFilter(
  searchParams: URLSearchParams,
): '' | AdminUserStatus {
  const status = searchParams.get('status')

  return status === 'ACTIVE' || status === 'DISABLED' ? status : ''
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
  const selectedWidths = adminUserColumns
    .filter((column) => visibleColumns.includes(column.id))
    .map((column) => `${getAdminUserColumnWidth(columnWidths, column.id)}px`)

  return [
    `${LIST_SELECTION_COLUMN_WIDTH}px`,
    ...selectedWidths,
    `${ADMIN_USER_ACTION_COLUMN_WIDTH}px`,
  ].join(' ')
}

function getAdminUserGridMinWidth(
  visibleColumns: AdminUserColumnId[],
  columnWidths: AdminUserColumnWidths,
) {
  const gridColumnCount = visibleColumns.length + 2
  const gridGapWidth = Math.max(gridColumnCount - 1, 0) * ADMIN_USER_GRID_COLUMN_GAP
  const visibleWidth = adminUserColumns
    .filter((column) => visibleColumns.includes(column.id))
    .reduce(
      (total, column) => total + getAdminUserColumnWidth(columnWidths, column.id),
      0,
    )

  return `${
    visibleWidth +
    LIST_SELECTION_COLUMN_WIDTH +
    ADMIN_USER_ACTION_COLUMN_WIDTH +
    gridGapWidth +
    ADMIN_USER_GRID_INLINE_PADDING
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
            aria-label="Rows per page"
            className="h-9 rounded-[0.75rem] border border-border bg-surface px-3 text-sm text-foreground outline-none"
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
      <div className="flex items-center gap-3 sm:justify-end">
        <button
          aria-label="Previous page"
          className="btn-icon"
          disabled={!pagination.hasPreviousPage}
          type="button"
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          Page {pagination.page} of {Math.max(1, pagination.totalPages)}
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
  canUpdateAdminUsers,
  isSelected,
  onOpenDetail,
  onOpenAccess,
  onSelect,
  user,
  visibleColumns,
}: {
  canUpdateAdminUsers: boolean
  isSelected: boolean
  onOpenDetail: (user: AdminUser) => void
  onOpenAccess: (user: AdminUser) => void
  onSelect: (user: AdminUser, selected: boolean) => void
  user: AdminUser
  visibleColumns: AdminUserColumnId[]
}) {
  const visibleColumnDefinitions = adminUserColumns.filter((column) =>
    visibleColumns.includes(column.id),
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onOpenDetail(user)
    }
  }

  return (
    <div
      aria-selected={isSelected}
      className={cn(
        'grid min-w-0 cursor-pointer gap-3 border-b border-border bg-surface px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring xl:grid-cols-[var(--admin-user-grid-template)] xl:items-center',
        isSelected && 'bg-primary/5 hover:bg-primary/10',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(user)}
      onKeyDown={handleKeyDown}
    >
      <div className="flex min-w-0 items-start xl:items-center">
        <ListSelectionCheckbox
          checked={isSelected}
          label={`Select ${user.fullName}`}
          onChange={(selected) => onSelect(user, selected)}
        />
      </div>
      {visibleColumnDefinitions.map((column) => (
        <div className="min-w-0" key={column.id}>
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-normal text-muted xl:hidden">
            {column.label}
          </p>
          {column.render(user)}
        </div>
      ))}
      <div
        className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        <Button
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => onOpenDetail(user)}
        >
          <ArrowUpRight className="mr-2 size-4" />
          Open
        </Button>
        {canUpdateAdminUsers ? (
          <Button
            size="sm"
            type="button"
            onClick={() => onOpenAccess(user)}
          >
            <Edit3 className="mr-2 size-4" />
            Access
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canCreateAdminUsers = usePermission('admin_users:create')
  const canUpdateAdminUsers = usePermission('admin_users:update')
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [status, setStatus] = useState<'' | AdminUserStatus>(() =>
    readAdminUserStatusFilter(searchParams),
  )
  const [roleId, setRoleId] = useState(() => searchParams.get('roleId') ?? '')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
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
  const baseCountQuery = useQuery({
    queryKey: ['admin-users', 'queue-count', 'all', search.trim(), roleId],
    queryFn: () =>
      adminUserService.getAdminUsers({
        limit: 1,
        page: 1,
        roleId: roleId || undefined,
        search: search.trim() || undefined,
      }),
  })
  const activeCountQuery = useQuery({
    queryKey: ['admin-users', 'queue-count', 'active', search.trim(), roleId],
    queryFn: () =>
      adminUserService.getAdminUsers({
        limit: 1,
        page: 1,
        roleId: roleId || undefined,
        search: search.trim() || undefined,
        status: 'ACTIVE',
      }),
  })
  const disabledCountQuery = useQuery({
    queryKey: ['admin-users', 'queue-count', 'disabled', search.trim(), roleId],
    queryFn: () =>
      adminUserService.getAdminUsers({
        limit: 1,
        page: 1,
        roleId: roleId || undefined,
        search: search.trim() || undefined,
        status: 'DISABLED',
      }),
  })
  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })

  const users = adminUsersQuery.data?.data ?? emptyUsers
  const pagination = adminUsersQuery.data?.pagination
  const userSelection = useListSelection(users, (user) => user.adminId)
  const isInitialLoading = adminUsersQuery.isLoading && users.length === 0
  const isRefreshing = adminUsersQuery.isFetching && !isInitialLoading
  const refreshStatusLabel = isRefreshing
    ? 'Refreshing'
    : formatRefreshTime(adminUsersQuery.dataUpdatedAt)
  const activeQueueKey: AdminUserQueueKey =
    status === 'ACTIVE' ? 'active' : status === 'DISABLED' ? 'disabled' : 'all'
  const roleOptions = rolesQuery.data?.data ?? []
  const selectedRoleLabel =
    roleOptions.find((role) => role.roleId === roleId)?.roleName ?? ''
  const queueItems = [
    {
      count: baseCountQuery.data?.pagination.totalItems,
      key: 'all' as const,
      label: 'All users',
    },
    {
      count: activeCountQuery.data?.pagination.totalItems,
      key: 'active' as const,
      label: 'Active',
    },
    {
      count: disabledCountQuery.data?.pagination.totalItems,
      key: 'disabled' as const,
      label: 'Disabled',
    },
  ]
  const activeFilterChips = [
    status
      ? {
          key: 'status',
          label: `Status: ${humanizeCode(status)}`,
          onClear: () => {
            setStatus('')
            resetToFirstPage()
          },
        }
      : null,
    roleId
      ? {
          key: 'role',
          label: `Role: ${selectedRoleLabel || 'Selected role'}`,
          onClear: () => {
            setRoleId('')
            resetToFirstPage()
          },
        }
      : null,
    search.trim()
      ? {
          key: 'search',
          label: `Search: ${search.trim()}`,
          onClear: () => {
            setSearch('')
            resetToFirstPage()
          },
        }
      : null,
  ].filter(Boolean) as { key: string; label: string; onClear: () => void }[]
  const visibleSummary = pagination
    ? `${pagination.totalItems} users · ${users.length} loaded`
    : 'Backend filtered admin accounts'
  const appliedContextLabel = [
    activeQueueKey !== 'all'
      ? `Queue: ${activeQueueKey === 'active' ? 'Active' : 'Disabled'}`
      : null,
    selectedRoleLabel ? `Role: ${selectedRoleLabel}` : null,
    search.trim() ? `Search: ${search.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
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

  const clearSeededListParams = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('search')
        next.delete('status')
        next.delete('roleId')

        return next
      },
      { replace: true },
    )
  }

  const clearFilters = () => {
    clearSeededListParams()
    setSearch('')
    setStatus('')
    setRoleId('')
    setPage(1)
  }

  const applyQueue = (queueKey: AdminUserQueueKey) => {
    clearSeededListParams()
    setStatus(
      queueKey === 'active'
        ? 'ACTIVE'
        : queueKey === 'disabled'
          ? 'DISABLED'
          : '',
    )
    setPage(1)
  }

  const openDetail = (user: AdminUser) => {
    navigate(`${routePaths.adminUsers}/${user.adminId}`)
  }

  const openAccess = (user: AdminUser) => {
    navigate(`${routePaths.adminUsers}/${user.adminId}#admin-user-role`)
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 space-y-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Users"
      />

      <main
        className="flex min-w-0 flex-col overflow-hidden rounded-[1rem] border border-border bg-surface shadow-surface xl:min-h-0 xl:flex-1"
        id="admin-users-records"
      >
        <div className="shrink-0 border-b border-border bg-surface px-3 py-3 sm:px-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(9rem,auto)_minmax(22rem,1fr)_auto] xl:items-center">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Users</h2>
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
              placeholder="Search users..."
              value={search}
              onChange={(nextSearch) => {
                clearSeededListParams()
                setSearch(nextSearch)
                resetToFirstPage()
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
              {canCreateAdminUsers ? (
                <Link to={`${routePaths.adminUsers}/new`}>
                  <Button size="sm" type="button" variant="secondary">
                    <Plus className="mr-2 size-4" />
                    User
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
                className="border border-border bg-surface px-3 text-foreground shadow-none hover:bg-surface-muted"
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
                    {typeof queue.count === 'number' ? queue.count : '...'}
                  </span>
                </button>
              )
            })}
          </div>

          <ActiveFilterChips chips={activeFilterChips} onClearAll={clearFilters} />

          {filtersOpen ? (
            <div className="mt-2 rounded-[0.75rem] border border-border bg-surface-muted/45 p-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,0.75fr)_minmax(14rem,1fr)_auto] lg:items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-muted">Status</span>
                  <select
                    className="form-input min-h-10"
                    value={status}
                    onChange={(event) => {
                      clearSeededListParams()
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
                  <span className="text-xs font-semibold text-muted">Primary role</span>
                  <select
                    className="form-input min-h-10"
                    disabled={rolesQuery.isLoading || rolesQuery.isError}
                    value={roleId}
                    onChange={(event) => {
                      clearSeededListParams()
                      setRoleId(event.target.value)
                      resetToFirstPage()
                    }}
                  >
                    <option value="">All roles</option>
                    {roleOptions.map((role) => (
                      <option key={role.roleId} value={role.roleId}>
                        {role.roleName}
                      </option>
                    ))}
                  </select>
                  {rolesQuery.isError ? (
                    <p className="text-xs text-danger">Roles could not be loaded.</p>
                  ) : null}
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
            <span>{appliedContextLabel || 'Server-backed access list'}</span>
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
                    <div className="sticky top-0 z-30 hidden gap-3 grid-cols-[var(--admin-user-grid-template)] border-b border-border bg-surface-muted px-3 py-2.5 text-xs font-semibold uppercase tracking-normal text-muted xl:grid">
                      <div className="flex min-w-0 items-center">
                        <ListSelectionCheckbox
                          checked={userSelection.allVisibleSelected}
                          indeterminate={userSelection.someVisibleSelected}
                          label="Select visible admin users"
                          onChange={userSelection.setVisibleSelected}
                        />
                      </div>
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
                      <div className="min-w-0 text-right">Actions</div>
                    </div>
                    <ListSelectionToolbar
                      allVisibleSelected={userSelection.allVisibleSelected}
                      selectedCount={userSelection.selectedCount}
                      visibleCount={userSelection.visibleCount}
                      onClear={userSelection.clearSelection}
                      onSelectVisible={() => userSelection.setVisibleSelected(true)}
                    />

                    <div>
                      {users.map((user) => (
                        <AdminUserRow
                          canUpdateAdminUsers={canUpdateAdminUsers}
                          isSelected={userSelection.isSelected(user.adminId)}
                          key={user.adminId}
                          user={user}
                          visibleColumns={visibleColumns}
                          onOpenAccess={openAccess}
                          onOpenDetail={openDetail}
                          onSelect={(selectedUser, selected) =>
                            userSelection.setItemSelected(selectedUser.adminId, selected)
                          }
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
    </PageContainer>
  )
}
