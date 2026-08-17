import { Download, Plus, RefreshCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataList } from '../../../components/ui/DataList'
import type { DataListColumn, DataListQueueTab } from '../../../components/ui/DataList'
import { PageContainer } from '../../../components/layout/PageContainer'
import { PageContextHeader } from '../../../components/ui/PageHeader'
import { routePaths } from '../../../config/routes'
import { useAuthStore } from '../../../store/authStore'
import { cn } from '../../../utils/cn'
import { downloadCsv, timestampedFilename } from '../../../utils/exportCsv'
import { formatDate } from '../../../utils/formatDate'
import { rbacService } from '../services/rbac.service'
import type { RoleSummary } from '../types/rbac.types'

const ROLE_LIST_STORAGE_KEY = 'servicegram.roles.list.v1'
const DEFAULT_PAGE_SIZE = 50

type RoleQueueKey = 'all' | 'custom' | 'system' | 'inactive'

function formatDateSafe(value: string | null | undefined) {
  if (!value) return '—'

  try {
    return formatDate(value)
  } catch {
    return '—'
  }
}

function matchesQueue(role: RoleSummary, queue: RoleQueueKey) {
  if (queue === 'custom') return !role.isSystem
  if (queue === 'system') return role.isSystem
  if (queue === 'inactive') return !role.isActive
  return true
}

function matchesSearch(role: RoleSummary, term: string) {
  if (!term) return true

  const needle = term.toLowerCase()

  return [role.roleName, role.roleCode, role.description]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle))
}

export function RolesPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const can = useAuthStore((state) => state.can)
  const canCreateRoles = can('roles:create')

  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [queue, setQueue] = useState<RoleQueueKey>('all')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const rolesQuery = useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: () => rbacService.getRoles(),
  })

  const allRoles = useMemo(() => rolesQuery.data?.data ?? [], [rolesQuery.data])

  /**
   * The roles endpoint returns the full set in one call, so filtering, counting
   * and paging are all client-side — and therefore exact, unlike the
   * page-scoped filters elsewhere in the portal.
   */
  const filtered = useMemo(
    () =>
      allRoles.filter(
        (role) => matchesQueue(role, queue) && matchesSearch(role, search.trim()),
      ),
    [allRoles, queue, search],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const currentPage = Math.min(page, totalPages)
  const roles = useMemo(
    () => filtered.slice((currentPage - 1) * limit, currentPage * limit),
    [currentPage, filtered, limit],
  )

  const queueTabs: DataListQueueTab[] = [
    { key: 'all', label: 'All', count: allRoles.length },
    {
      key: 'custom',
      label: 'Custom',
      count: allRoles.filter((role) => !role.isSystem).length,
    },
    {
      key: 'system',
      label: 'System',
      count: allRoles.filter((role) => role.isSystem).length,
    },
    {
      key: 'inactive',
      label: 'Inactive',
      count: allRoles.filter((role) => !role.isActive).length,
      tone: 'warning',
    },
  ]

  const clearSeededParams = () => {
    const seededKeys = ['search', 'type', 'status']
    if (!seededKeys.some((key) => searchParams.has(key))) return

    const nextParams = new URLSearchParams(searchParams)
    seededKeys.forEach((key) => nextParams.delete(key))
    setSearchParams(nextParams, { replace: true })
  }

  const columns: DataListColumn<RoleSummary>[] = useMemo(
    () => [
      {
        id: 'role',
        label: 'Role',
        defaultWidth: 220,
        minWidth: 180,
        priority: 1,
        grow: true,
        locked: true,
        render: (role) => (
          <div
            className="flex min-w-0 items-baseline gap-2"
            title={role.description ?? role.roleName}
          >
            <span className="max-w-[60%] shrink-0 truncate font-medium text-foreground">
              {role.roleName}
            </span>
            <span className="min-w-0 truncate text-xs text-muted">
              {role.roleCode}
            </span>
          </div>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        defaultWidth: 100,
        minWidth: 88,
        priority: 1,
        render: (role) => (
          <Badge tone={role.isSystem ? 'neutral' : 'success'}>
            {role.isSystem ? 'System' : 'Custom'}
          </Badge>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        defaultWidth: 100,
        minWidth: 88,
        priority: 1,
        render: (role) => (
          <Badge tone={role.isActive ? 'success' : 'danger'}>
            {role.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        id: 'permissions',
        label: 'Permissions',
        defaultWidth: 110,
        minWidth: 96,
        priority: 2,
        align: 'right',
        render: (role) => (
          <span className={role.permissionCount ? '' : 'text-muted'}>
            {role.permissionCount || '—'}
          </span>
        ),
      },
      {
        id: 'description',
        label: 'Description',
        defaultWidth: 220,
        minWidth: 160,
        priority: 3,
        render: (role) => (
          <span
            className={cn('truncate', role.description ? 'text-muted' : 'text-muted')}
            title={role.description ?? undefined}
          >
            {role.description || '—'}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        defaultWidth: 110,
        minWidth: 96,
        priority: 4,
        defaultHidden: true,
        render: (role) => (
          <span className="text-muted">{formatDateSafe(role.updatedAt)}</span>
        ),
      },
    ],
    [],
  )

  const selectedRoles = useMemo(
    () => allRoles.filter((role) => selectedIds.includes(role.roleId)),
    [allRoles, selectedIds],
  )

  const exportSelected = () => {
    downloadCsv(timestampedFilename('roles'), selectedRoles, [
      { header: 'Role ID', value: (role) => role.roleId },
      { header: 'Role code', value: (role) => role.roleCode },
      { header: 'Role name', value: (role) => role.roleName },
      { header: 'Description', value: (role) => role.description ?? '' },
      { header: 'Type', value: (role) => (role.isSystem ? 'System' : 'Custom') },
      { header: 'Active', value: (role) => String(role.isActive) },
      { header: 'Permissions', value: (role) => role.permissionCount },
      { header: 'Created', value: (role) => role.createdAt },
      { header: 'Updated', value: (role) => role.updatedAt },
    ])
  }

  return (
    <PageContainer className="flex min-h-full flex-col !px-3 !py-3 sm:!px-4 lg:!px-6 xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PageContextHeader
        actionNode={
          <div className="flex items-center gap-2">
            <Button
              aria-label="Refresh roles"
              className="h-9"
              disabled={rolesQuery.isLoading}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void rolesQuery.refetch()}
            >
              <RefreshCcw
                className={cn(
                  'size-4 sm:mr-2',
                  rolesQuery.isFetching && 'animate-spin motion-reduce:animate-none',
                )}
              />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            {canCreateRoles ? (
              <Link to={`${routePaths.roles}/new`}>
                <Button className="h-9" size="sm" type="button" variant="primary">
                  <Plus className="size-4 sm:mr-2" />
                  <span className="hidden sm:inline">New role</span>
                </Button>
              </Link>
            ) : null}
          </div>
        }
        layout="workspace"
        placement="topbar"
        title="Roles"
      />

      <DataList
        activeQueue={queue}
        columns={columns}
        emptyHint="Try a different search term or switch queue."
        emptyMessage="No roles match these filters"
        errorMessage="Could not load roles."
        getRowId={(role) => role.roleId}
        isError={rolesQuery.isError}
        isLoading={rolesQuery.isLoading}
        pagination={{
          page: currentPage,
          pageSize: limit,
          totalItems: filtered.length,
          totalPages,
          onPageChange: setPage,
          onPageSizeChange: (nextLimit) => {
            setLimit(nextLimit)
            setPage(1)
          },
        }}
        queueTabs={queueTabs}
        rows={roles}
        search={search}
        searchPlaceholder="Search role name, code…"
        selection={{
          selectedIds,
          onSelectionChange: setSelectedIds,
          actions: (
            <Button size="sm" type="button" variant="ghost" onClick={exportSelected}>
              <Download className="mr-1.5 size-3.5" />
              Export CSV
            </Button>
          ),
        }}
        storageKey={ROLE_LIST_STORAGE_KEY}
        onQueueChange={(key) => {
          setQueue(key as RoleQueueKey)
          setPage(1)
        }}
        onRetry={() => void rolesQuery.refetch()}
        onRowClick={(role) => navigate(`${routePaths.roles}/${role.roleId}`)}
        onSearchChange={(nextSearch) => {
          clearSeededParams()
          setSearch(nextSearch)
          setPage(1)
        }}
      />
    </PageContainer>
  )
}
