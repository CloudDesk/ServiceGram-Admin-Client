import { ArrowUpRight, Edit3, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { filterInputClass } from '../../../components/ui/Input'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { usePermission } from '../../../hooks/usePermission'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../../rbac/services/rbac.service'
import { adminUserService } from '../services/adminUser.service'
import type {
  AdminUser,
  AdminUsersQueryParams,
  AdminUserStatus,
} from '../types/adminUser.types'

const ADMIN_USER_LIST_STORAGE_KEY = 'servicegram.adminUsers.list.v1'
const DEFAULT_PAGE_SIZE = 50

type AdminUserQueueKey = 'all' | 'active' | 'disabled'

function humanizeCode(value: string | null | undefined) {
  if (!value) return 'Not available'

  return value
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatDateSafe(value: string | null | undefined) {
  if (!value) return '—'

  try {
    return formatDate(value, true)
  } catch {
    return '—'
  }
}

function AdminUserRowActions({
  canUpdateAdminUsers,
  onOpenAccess,
  onOpenDetail,
}: {
  canUpdateAdminUsers: boolean
  onOpenAccess: () => void
  onOpenDetail: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="xs" type="button" variant="ghost" onClick={onOpenDetail}>
        <ArrowUpRight className="mr-1.5 size-3.5" />
        Open
      </Button>
      {canUpdateAdminUsers ? (
        <Button size="xs" type="button" variant="secondary" onClick={onOpenAccess}>
          <Edit3 className="mr-1.5 size-3.5" />
          Access
        </Button>
      ) : null}
    </div>
  )
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canCreateAdminUsers = usePermission('admin_users:create')
  const canUpdateAdminUsers = usePermission('admin_users:update')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<AdminUserQueueKey>('all')
  const [roleId, setRoleId] = useState(() => searchParams.get('roleId') ?? '')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const status: '' | AdminUserStatus =
    queue === 'active' ? 'ACTIVE' : queue === 'disabled' ? 'DISABLED' : ''

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

  const queueCountBase = useMemo(
    () => ({ search: search.trim() || undefined, roleId: roleId || undefined }),
    [roleId, search],
  )

  /** Queue counts span the whole result set, not the current page, so each queue is its own minimal request. */
  const queueCountsQuery = useQuery({
    queryKey: ['admin-users', 'queue-counts', queueCountBase],
    queryFn: async () => {
      const [all, active, disabled] = await Promise.all([
        adminUserService.getAdminUsers({ ...queueCountBase, page: 1, limit: 1 }),
        adminUserService.getAdminUsers({ ...queueCountBase, page: 1, limit: 1, status: 'ACTIVE' }),
        adminUserService.getAdminUsers({ ...queueCountBase, page: 1, limit: 1, status: 'DISABLED' }),
      ])

      return {
        all: all.pagination.totalItems,
        active: active.pagination.totalItems,
        disabled: disabled.pagination.totalItems,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const users = useMemo(() => adminUsersQuery.data?.data ?? [], [adminUsersQuery.data])
  const pagination = adminUsersQuery.data?.pagination
  const roleOptions = rolesQuery.data?.data ?? []
  const counts = queueCountsQuery.data

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: counts?.all },
    { key: 'active', label: 'Active', count: counts?.active },
    { key: 'disabled', label: 'Disabled', count: counts?.disabled, tone: 'danger' },
  ]

  const appliedFilterCount = roleId ? 1 : 0

  const clearSeededListParams = () => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('search')
        next.delete('roleId')
        return next
      },
      { replace: true },
    )
  }

  const openDetail = (user: AdminUser) => navigate(`${routePaths.adminUsers}/${user.adminId}`)
  const openAccess = (user: AdminUser) =>
    navigate(`${routePaths.adminUsers}/${user.adminId}/tab/access`)

  const columns: DataListColumn<AdminUser>[] = useMemo(
    () => [
      {
        id: 'user',
        label: 'User',
        defaultWidth: 240,
        minWidth: 200,
        priority: 1,
        grow: true,
        locked: true,
        render: (user) => (
          <div className="min-w-0">
            <span className="truncate font-medium text-foreground">{user.fullName}</span>{' '}
            <span className="text-xs text-muted">{user.email ?? 'No email'}</span>
          </div>
        ),
      },
      {
        id: 'role',
        label: 'Role',
        defaultWidth: 180,
        minWidth: 150,
        priority: 1,
        render: (user) => (
          <span className="truncate text-foreground">
            {user.role?.roleName ?? 'Unassigned'}
          </span>
        ),
      },
      {
        id: 'adminStatus',
        label: 'Admin status',
        defaultWidth: 120,
        minWidth: 108,
        priority: 1,
        render: (user) => (
          <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
            {humanizeCode(user.status)}
          </Badge>
        ),
      },
      {
        id: 'account',
        label: 'Account',
        defaultWidth: 120,
        minWidth: 108,
        priority: 2,
        render: (user) => (
          <Badge tone={user.userStatus === 'ACTIVE' ? 'success' : 'danger'}>
            {humanizeCode(user.userStatus)}
          </Badge>
        ),
      },
      {
        id: 'security',
        label: 'Permission v',
        defaultWidth: 100,
        minWidth: 90,
        priority: 4,
        align: 'right',
        defaultHidden: true,
        render: (user) => <span className="tabular-nums">{user.permissionVersion}</span>,
      },
      {
        id: 'activity',
        label: 'Last login',
        defaultWidth: 150,
        minWidth: 130,
        priority: 2,
        render: (user) => (
          <span className="text-muted">
            {user.lastLoginAt ? formatDateSafe(user.lastLoginAt) : 'Never'}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 130,
        minWidth: 110,
        priority: 3,
        defaultHidden: true,
        render: (user) => <span className="text-muted">{formatDateSafe(user.updatedAt)}</span>,
      },
    ],
    [],
  )

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user.adminId)),
    [selectedIds, users],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('admin-users'), selectedUsers, [
      { header: 'Admin ID', value: (user) => user.adminId },
      { header: 'Full name', value: (user) => user.fullName },
      { header: 'Email', value: (user) => user.email ?? '' },
      { header: 'Role', value: (user) => user.role?.roleName ?? '' },
      { header: 'Role code', value: (user) => user.role?.roleCode ?? '' },
      { header: 'Admin status', value: (user) => user.status },
      { header: 'Account status', value: (user) => user.userStatus },
      { header: 'Last login', value: (user) => user.lastLoginAt ?? '' },
      { header: 'Updated', value: (user) => user.updatedAt },
      { header: 'Created', value: (user) => user.createdAt },
    ])
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        layout="workspace"
        placement="topbar"
        title="Users"
      />

      <DataList
        activeQueue={queue}
        appliedFilterCount={appliedFilterCount}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No admin users match these filters"
        errorMessage="Could not load admin users."
        filters={
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Primary role</span>
            <select
              className={filterInputClass}
              disabled={rolesQuery.isLoading || rolesQuery.isError}
              value={roleId}
              onChange={(event) => {
                setRoleId(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All roles</option>
              {roleOptions.map((role) => (
                <option key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </option>
              ))}
            </select>
          </label>
        }
        getRowId={(user) => user.adminId}
        isError={adminUsersQuery.isError}
        isLoading={adminUsersQuery.isLoading}
        pagination={{
          page,
          pageSize: limit,
          totalItems: pagination?.totalItems ?? 0,
          totalPages: pagination?.totalPages ?? 1,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        queueTabs={queueTabs}
        rowActions={(user) => (
          <AdminUserRowActions
            canUpdateAdminUsers={canUpdateAdminUsers}
            onOpenAccess={() => openAccess(user)}
            onOpenDetail={() => openDetail(user)}
          />
        )}
        rowActionsWidth={canUpdateAdminUsers ? 140 : 80}
        rows={users}
        search={search}
        searchPlaceholder="Search name, email…"
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              Export CSV
            </Button>
          ),
        }}
        storageKey={ADMIN_USER_LIST_STORAGE_KEY}
        toolbarActions={
          <Button
            disabled={!canCreateAdminUsers}
            size="sm"
            title={
              canCreateAdminUsers
                ? 'Add admin user'
                : 'Requires admin_users:create permission'
            }
            type="button"
            onClick={() => navigate(`${routePaths.adminUsers}/new`)}
          >
            <Plus className="mr-1.5 size-4" />
            Add user
          </Button>
        }
        onQueueChange={(key) => {
          setQueue(key as AdminUserQueueKey)
          setPage(1)
        }}
        onResetFilters={() => {
          setRoleId('')
          setPage(1)
        }}
        onRetry={() => void adminUsersQuery.refetch()}
        onRowClick={openDetail}
        onSearchChange={(nextSearch) => {
          clearSeededListParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />
    </PageContainer>
  )
}
